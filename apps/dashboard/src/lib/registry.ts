// Direct reads of the ChainPeRegistry and ERC-8004 ReputationRegistry. The
// marketplace uses these when no indexer is configured (or it is down), so the
// dashboard works against Arc Testnet alone. Runs on the server or the browser.

import { BaseError, ContractFunctionRevertedError, getAddress, isAddress, type Address } from 'viem'
import { chainPeRegistryAbi, reputationRegistryAbi } from '@/abi'
import { CONTRACTS } from './arc'
import { publicClient } from './client'
import type { ReputationSummary, Service } from './services'

/** getServices() rejects pages larger than MAX_SERVICES_PER_PAGE (100). */
const PAGE = 100n
/** getSummary() loops over every client in one eth_call; keep each call small. */
const SUMMARY_CHUNK = 200

type RawService = Awaited<ReturnType<typeof readRawServices>>[number]

async function readRawServices(registry: Address) {
  const total = await publicClient.readContract({ address: registry, abi: chainPeRegistryAbi, functionName: 'getServiceCount' })
  const out = []
  for (let offset = 0n; offset < total; offset += PAGE) {
    const page = await publicClient.readContract({
      address: registry,
      abi: chainPeRegistryAbi,
      functionName: 'getServices',
      args: [offset, total - offset < PAGE ? total - offset : PAGE],
    })
    out.push(...page)
  }
  return out
}

/** Same id the indexer uses: `<developer>:<name>`. */
export const serviceId = (developer: string, name: string) => `${getAddress(developer)}:${name}`

export function parseServiceId(id: string): { developer: Address; name: string } | null {
  const developer = id.slice(0, 42)
  if (!isAddress(developer) || id[42] !== ':' || id.length === 43) return null
  return { developer: getAddress(developer), name: id.slice(43) }
}

function toService(raw: RawService, reputation: ReputationSummary | null): Service {
  return {
    id: serviceId(raw.developer, raw.name),
    name: raw.name,
    description: raw.description,
    tags: raw.tags.split(',').map(t => t.trim()).filter(Boolean),
    endpoint: raw.endpoint,
    pricePerRequest: raw.pricePerRequest,
    paymentToken: raw.paymentToken || 'USDC',
    walletAddress: raw.payTo,
    developer: raw.developer,
    network: raw.network || 'arc-testnet',
    agentId: raw.agentId > 0n ? raw.agentId.toString() : undefined,
    reputation,
  }
}

/**
 * Sums getSummary over `clients`. The registry is shared and anyone can post
 * feedback, so one client with tens of thousands of entries makes the call run
 * out of gas: on a revert, split the chunk and retry, and skip a client that
 * cannot be summarised even alone.
 */
async function summarise(reputation: Address, agentId: bigint, clients: readonly Address[]): Promise<{ n: number; sum: number; skipped: number }> {
  try {
    const [count, value, decimals] = await publicClient.readContract({
      address: reputation,
      abi: reputationRegistryAbi,
      functionName: 'getSummary',
      args: [agentId, clients, '', ''],
    })
    return { n: Number(count), sum: (Number(value) / 10 ** decimals) * Number(count), skipped: 0 }
  } catch (e) {
    if (!(e instanceof BaseError) || !e.walk(err => err instanceof ContractFunctionRevertedError)) throw e
    if (clients.length === 1) return { n: 0, sum: 0, skipped: 1 }
    const mid = clients.length >> 1
    const [l, r] = [await summarise(reputation, agentId, clients.slice(0, mid)), await summarise(reputation, agentId, clients.slice(mid))]
    return { n: l.n + r.n, sum: l.sum + r.sum, skipped: l.skipped + r.skipped }
  }
}

/**
 * ERC-8004 reputation for an agent: number of clients that left feedback and
 * the average score (getSummary needs an explicit client list, so read
 * getClients first and summarise in chunks).
 */
export async function readReputation(agentId: bigint): Promise<ReputationSummary | null> {
  const reputation = CONTRACTS.reputation
  if (!reputation) return null
  const clients = await publicClient.readContract({ address: reputation, abi: reputationRegistryAbi, functionName: 'getClients', args: [agentId] })
  if (clients.length === 0) return { count: 0, score: null }
  let n = 0
  let sum = 0
  let skipped = 0
  for (let i = 0; i < clients.length; i += SUMMARY_CHUNK) {
    const part = await summarise(reputation, agentId, clients.slice(i, i + SUMMARY_CHUNK))
    n += part.n
    sum += part.sum
    skipped += part.skipped
  }
  return { count: clients.length - skipped, score: n ? Math.round((sum / n) * 100) / 100 : null, ...(skipped ? { skipped } : {}) }
}

/** Listing pages must not hang on one agent with a huge feedback history. */
const LIST_REPUTATION_TIMEOUT_MS = 6_000

const reputationOrNull = (agentId: bigint): Promise<ReputationSummary | null> =>
  agentId > 0n
    ? Promise.race([
        readReputation(agentId).catch(() => null),
        new Promise<null>(resolve => setTimeout(() => resolve(null), LIST_REPUTATION_TIMEOUT_MS)),
      ])
    : Promise.resolve(null)

/** Every registered service, read straight from the registry, ranked like the indexer does. */
export async function readServicesOnChain(query?: string): Promise<{ total: number; items: Service[] }> {
  const registry = CONTRACTS.registry
  if (!registry) return { total: 0, items: [] }
  const raw = (await readRawServices(registry)).filter(s => s.exists)
  let items = await Promise.all(raw.map(async s => toService(s, await reputationOrNull(s.agentId))))
  if (query) {
    const q = query.toLowerCase()
    items = items.filter(
      s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q)),
    )
  }
  items.sort((a, b) => {
    const sa = a.reputation?.score ?? null
    const sb = b.reputation?.score ?? null
    if ((sa != null) !== (sb != null)) return sa != null ? -1 : 1
    if (sa != null && sb != null && sa !== sb) return sb - sa
    const ca = a.reputation?.count ?? 0
    const cb = b.reputation?.count ?? 0
    if (ca !== cb) return cb - ca
    return parseFloat(a.pricePerRequest) - parseFloat(b.pricePerRequest)
  })
  return { total: items.length, items }
}

/** One service by id, or null if it isn't registered. */
export async function readServiceOnChain(id: string): Promise<Service | null> {
  const registry = CONTRACTS.registry
  const parsed = parseServiceId(id)
  if (!registry || !parsed) return null
  const exists = await publicClient.readContract({
    address: registry,
    abi: chainPeRegistryAbi,
    functionName: 'hasService',
    args: [parsed.developer, parsed.name],
  })
  if (!exists) return null
  const raw = await publicClient.readContract({
    address: registry,
    abi: chainPeRegistryAbi,
    functionName: 'getService',
    args: [parsed.developer, parsed.name],
  })
  return toService(raw, await reputationOrNull(raw.agentId))
}

/** Services registered by one developer address (for the "Your services" list). */
export async function readServicesBy(developer: Address) {
  const registry = CONTRACTS.registry
  if (!registry) return []
  return (await readRawServices(registry)).filter(s => s.exists && getAddress(s.developer) === getAddress(developer))
}

export type { RawService }
