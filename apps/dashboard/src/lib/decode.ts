// Decodes Arc Testnet transactions that touch ChainPe, ERC-8004 or USDC, using
// the generated ABIs (src/abi) so labels never drift from the contracts.

import {
  decodeEventLog,
  decodeFunctionData,
  formatUnits,
  getAddress,
  parseAbiItem,
  type Abi,
  type Address,
  type Hex,
  type Log,
} from 'viem'
import {
  chainPeRegistryAbi,
  chainPeTimelockAbi,
  identityRegistryAbi,
  policyVaultAbi,
  reputationRegistryAbi,
  validationRegistryAbi,
} from '@/abi'
import { CONTRACTS, USDC_ADDRESS, USDC_DECIMALS } from './arc'
import { erc20Abi } from './client'

/** USDC's ERC-20 ABI plus the EIP-3009 events FiatTokenV2 emits. */
const usdcAbi = [
  ...erc20Abi,
  parseAbiItem('event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)'),
  parseAbiItem('event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce)'),
] as const

type Kind = 'usdc' | 'registry' | 'vault' | 'timelock' | 'identity' | 'reputation' | 'validation'

interface Known {
  kind: Kind
  label: string
  abi: Abi
}

const KNOWN: [Address | null, Known][] = [
  [USDC_ADDRESS, { kind: 'usdc', label: 'USDC', abi: usdcAbi }],
  [CONTRACTS.registry, { kind: 'registry', label: 'ChainPeRegistry', abi: chainPeRegistryAbi }],
  [CONTRACTS.policyVault, { kind: 'vault', label: 'PolicyVault', abi: policyVaultAbi }],
  [CONTRACTS.timelock, { kind: 'timelock', label: 'ChainPeTimelock', abi: chainPeTimelockAbi }],
  [CONTRACTS.identity, { kind: 'identity', label: 'ERC-8004 Identity', abi: identityRegistryAbi }],
  [CONTRACTS.reputation, { kind: 'reputation', label: 'ERC-8004 Reputation', abi: reputationRegistryAbi }],
  [CONTRACTS.validation, { kind: 'validation', label: 'ERC-8004 Validation', abi: validationRegistryAbi }],
]

export function knownContract(address: string | null | undefined): Known | null {
  if (!address) return null
  const a = getAddress(address)
  return KNOWN.find(([k]) => k && k === a)?.[1] ?? null
}

/** Argument names that carry 6-decimal USDC amounts, per contract. */
const USDC_ARGS: Partial<Record<Kind, string[]>> = {
  usdc: ['value'],
  registry: ['amount', 'oldFee', 'newFee'],
  vault: ['amount', 'maxPerCall', 'dailyCap', 'totalBudget'],
}

export interface DecodedArg {
  name: string
  value: string
  kind: 'address' | 'usdc' | 'text'
}

function formatArgs(kind: Kind, names: readonly string[], values: readonly unknown[]): DecodedArg[] {
  return names.map((name, i) => fmt(kind, name || `arg${i}`, values[i]))
}

function fmt(kind: Kind, name: string, v: unknown): DecodedArg {
  if (typeof v === 'bigint' && USDC_ARGS[kind]?.includes(name)) return { name, value: `${formatUnits(v, USDC_DECIMALS)} USDC`, kind: 'usdc' }
  if (typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v)) return { name, value: v, kind: 'address' }
  if (typeof v === 'bigint') return { name, value: v.toString(), kind: 'text' }
  if (v && typeof v === 'object') return { name, value: JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)), kind: 'text' }
  return { name, value: String(v), kind: 'text' }
}

export interface DecodedEvent {
  contract: string
  address: Address
  name: string
  args: DecodedArg[]
}

/** Decodes every log emitted by a known contract; unknown logs are counted, not shown. */
export function decodeLogs(logs: Log[]): { events: DecodedEvent[]; unknown: number } {
  const events: DecodedEvent[] = []
  let unknown = 0
  for (const log of logs) {
    const known = knownContract(log.address)
    if (!known) {
      unknown++
      continue
    }
    try {
      const ev = decodeEventLog({ abi: known.abi, data: log.data, topics: log.topics })
      const item = known.abi.find(x => x.type === 'event' && x.name === ev.eventName) as { inputs: readonly { name: string }[] } | undefined
      const names = item?.inputs.map(i => i.name) ?? []
      const args = ev.args as Record<string, unknown> | readonly unknown[] | undefined
      const values = Array.isArray(args) ? args : names.map(n => (args as Record<string, unknown>)?.[n])
      events.push({ contract: known.label, address: getAddress(log.address), name: ev.eventName ?? 'event', args: formatArgs(known.kind, names, values) })
    } catch {
      unknown++
    }
  }
  return { events, unknown }
}

export interface DecodedCall {
  contract: string
  functionName: string
  args: DecodedArg[]
}

/** Decodes the calldata of a transaction sent to a known contract. */
export function decodeCall(to: Address | null, input: Hex): DecodedCall | null {
  const known = knownContract(to)
  if (!known || input === '0x') return null
  try {
    const { functionName, args } = decodeFunctionData({ abi: known.abi, data: input })
    const item = known.abi.find(
      x => x.type === 'function' && x.name === functionName && x.inputs.length === (args?.length ?? 0),
    ) as { inputs: readonly { name: string }[] } | undefined
    const names = item?.inputs.map(i => i.name) ?? []
    return { contract: known.label, functionName, args: formatArgs(known.kind, names, args ?? []) }
  } catch {
    return null
  }
}
