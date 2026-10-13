/**
 * Network helpers for the SDK. All constants come from ./arc.ts, the single
 * Arc Testnet definition shared across ChainPe.
 */
import { createPublicClient, http, getAddress, type PublicClient } from 'viem'
import {
  ARC_TESTNET_CONTRACTS,
  ARC_TESTNET_ERC8004,
  ARC_USDC_ADDRESS,
  X402_NETWORK,
  arcRpcUrl,
  arcTestnet,
  type X402Network
} from './arc.js'
import type { ChainPeNetwork } from './types.js'

export { USDC_DECIMALS, arcTestnet } from './arc.js'

export function getX402Network(_network: ChainPeNetwork): X402Network {
  return X402_NETWORK
}

export function rpcUrlFor(_network: ChainPeNetwork): string {
  return arcRpcUrl()
}

export function getUsdcAddress(_network: ChainPeNetwork): `0x${string}` {
  return ARC_USDC_ADDRESS
}

export function chainFor(_network: ChainPeNetwork) {
  return arcTestnet
}

export function publicClientFor(network: ChainPeNetwork): PublicClient {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrlFor(network))
  })
}

/** Resolves the ChainPeRegistry address: explicit arg → env → deployed Arc Testnet default. */
export function resolveRegistryAddress(
  _network: ChainPeNetwork,
  explicit?: string
): `0x${string}` {
  return checkedAddress(
    explicit ||
      process.env.CHAINPE_REGISTRY_ADDRESS ||
      ARC_TESTNET_CONTRACTS.chainPeRegistry,
    'ChainPeRegistry address on Arc Testnet'
  )
}

/** Resolves the PolicyVault: explicit arg → env → deployed default. */
export function resolvePolicyVaultAddress(
  _network: ChainPeNetwork,
  explicit?: string
): `0x${string}` {
  return checkedAddress(
    explicit || process.env.POLICY_VAULT_ADDRESS || ARC_TESTNET_CONTRACTS.policyVault,
    'PolicyVault address on Arc Testnet'
  )
}

/** Resolves the ERC-8004 Reputation Registry (defaults to Arc's canonical one). */
export function resolveReputationRegistry(
  _network: ChainPeNetwork,
  explicit?: string
): `0x${string}` {
  return checkedAddress(
    explicit ||
      process.env.ERC8004_REPUTATION_REGISTRY ||
      ARC_TESTNET_ERC8004.reputationRegistry,
    'ERC-8004 Reputation Registry address on Arc Testnet'
  )
}

/** getAddress() with an error that names the setting instead of viem's generic one. */
function checkedAddress(value: string, label: string): `0x${string}` {
  try {
    return getAddress(value)
  } catch {
    throw new Error(`Invalid ${label}: "${value}" is not a valid 0x address.`)
  }
}

export function normalizeKey(key: string): `0x${string}` {
  return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`
}
