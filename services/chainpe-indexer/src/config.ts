import 'dotenv/config'
import { getAddress } from 'viem'
import {
  ARC_TESTNET_CONTRACTS,
  ARC_TESTNET_ERC8004,
  ARC_TESTNET_RPC_URL,
  arcTestnet
} from '../../../packages/chainpe-sdk/src/arc.js'

/** Arc Testnet is the only supported network. */
export type Network = 'arc-testnet'

if (process.env.NETWORK && process.env.NETWORK !== 'arc-testnet') {
  throw new Error(`Unsupported NETWORK "${process.env.NETWORK}" (expected "arc-testnet").`)
}
export const NETWORK: Network = 'arc-testnet'

/** Arc Testnet viem chain (single source: packages/chainpe-sdk/src/arc.ts). */
export const CHAIN = arcTestnet

export const RPC_URL = process.env.ARC_RPC_URL || process.env.RPC_URL || ARC_TESTNET_RPC_URL

// ChainPeRegistry from the deployment record; reputation is Arc's canonical
// ERC-8004 Reputation Registry (shared by every Arc agent, so the indexer sees
// all feedback for ChainPe agents, not only feedback from ChainPe clients).
const DEFAULT_REGISTRY: Record<Network, string> = {
  'arc-testnet': ARC_TESTNET_CONTRACTS.chainPeRegistry
}
const DEFAULT_REPUTATION: Record<Network, string> = {
  'arc-testnet': ARC_TESTNET_ERC8004.reputationRegistry
}

function resolve(envValue: string | undefined, fallback: string, label: string): `0x${string}` {
  const candidate = envValue || fallback
  try {
    return getAddress(candidate)
  } catch {
    throw new Error(`Invalid ${label} address on Arc Testnet: "${candidate}".`)
  }
}

export const REGISTRY_ADDRESS = resolve(
  process.env.CHAINPE_REGISTRY_ADDRESS,
  DEFAULT_REGISTRY[NETWORK],
  'ChainPeRegistry'
)
export const REPUTATION_ADDRESS = resolve(
  process.env.ERC8004_REPUTATION_REGISTRY,
  DEFAULT_REPUTATION[NETWORK],
  'ERC-8004 Reputation Registry'
)

/** Postgres connection string — required at runtime (not for typecheck/tests). */
export const DATABASE_URL = process.env.DATABASE_URL ?? ''

export const PORT = Number(process.env.PORT ?? 4600)
/** First block to index: env, else the ChainPeRegistry deployment block. */
export const START_BLOCK = BigInt(
  process.env.START_BLOCK || ARC_TESTNET_CONTRACTS.deployBlock.toString()
)
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000)
/** Max block span per getLogs request (public RPCs cap this). */
export const LOG_CHUNK = BigInt(process.env.LOG_CHUNK ?? '2000')
