// Server-side reads of the ChainPe indexer + self-hosted facilitator. Fetched
// on the server so the facilitator's CORS policy (deny browsers by default)
// and the browser CSP don't need to know these hosts.

import { readServiceOnChain, readServicesOnChain } from './registry'

const trim = (u: string | undefined) => (u ? u.replace(/\/$/, '') : null)

export const INDEXER_URL = trim(process.env.INDEXER_URL)
export const FACILITATOR_URL = trim(process.env.CHAINPE_FACILITATOR_URL)

export type Fetched<T> =
  | { state: 'unconfigured' }
  | { state: 'error'; message: string }
  | { state: 'ok'; data: T }

async function getJson<T>(base: string | null, path: string): Promise<Fetched<T>> {
  if (!base) return { state: 'unconfigured' }
  try {
    const res = await fetch(`${base}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { state: 'error', message: `${path} returned HTTP ${res.status}` }
    return { state: 'ok', data: (await res.json()) as T }
  } catch (e) {
    return { state: 'error', message: e instanceof Error ? e.message : 'unreachable' }
  }
}

export interface ReputationSummary {
  count: number
  score: number | null
  /** On-chain reads only: clients left out because their feedback is too large to summarise in one call. */
  skipped?: number
}

/** Mirrors ServiceDto in services/chainpe-indexer/src/api.ts. */
export interface Service {
  id: string
  name: string
  description: string
  tags: string[]
  endpoint: string
  pricePerRequest: string
  paymentToken: string
  walletAddress: string
  developer: string
  network: string
  agentId?: string
  reputation: ReputationSummary | null
}

export interface ServicesPage {
  total: number
  items: Service[]
}

export interface FacilitatorHealth {
  status: 'ok' | 'degraded'
  network: string
  x402Network: string
  facilitator: string
  custodial: boolean
  warning?: string
}

export interface IndexerHealth {
  status: string
  network: string
  lastIndexedBlock: string | null
  chainHead: string
}

export const getServices = (query?: string) =>
  getJson<ServicesPage>(INDEXER_URL, `/services${query ? `?query=${encodeURIComponent(query)}` : ''}`)
export const getService = (id: string) => getJson<Service>(INDEXER_URL, `/services/${encodeURIComponent(id)}`)
export const getIndexerHealth = () => getJson<IndexerHealth>(INDEXER_URL, '/health')
export const getFacilitatorHealth = () => getJson<FacilitatorHealth>(FACILITATOR_URL, '/health')

/** Where a page's service data came from; `chain` = read from the registry directly. */
export type ServiceSource = { kind: 'indexer' } | { kind: 'chain'; indexer: 'unconfigured' | string }

async function withFallback<T>(
  fromIndexer: () => Promise<Fetched<T>>,
  fromChain: () => Promise<T>,
): Promise<{ result: Fetched<T>; source: ServiceSource }> {
  const indexed = await fromIndexer()
  if (indexed.state === 'ok') return { result: indexed, source: { kind: 'indexer' } }
  const source: ServiceSource = { kind: 'chain', indexer: indexed.state === 'unconfigured' ? 'unconfigured' : indexed.message }
  try {
    return { result: { state: 'ok', data: await fromChain() }, source }
  } catch (e) {
    return { result: { state: 'error', message: `Arc RPC: ${e instanceof Error ? e.message.split('\n')[0] : 'unreachable'}` }, source }
  }
}

/** Marketplace listing: the indexer when it answers, else the registry on Arc. */
export const listServices = (query?: string) => withFallback(() => getServices(query), () => readServicesOnChain(query))

/** One service: the indexer when it answers, else the registry on Arc (null = not registered). */
export const findService = (id: string) => withFallback<Service | null>(() => getService(id), () => readServiceOnChain(id))
