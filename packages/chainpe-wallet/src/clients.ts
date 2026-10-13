import {
  createPublicClient,
  http,
  erc20Abi,
  formatUnits,
  getAddress,
  type PublicClient
} from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_USDC_ADDRESS,
  X402_NETWORK,
  arcRpcUrl,
  arcTestnet,
  explorerTxUrl as arcExplorerTxUrl,
  USDC_DECIMALS,
  type X402Network
} from '@chainpearc/sdk/arc'
import type { PaymentNetwork, AppConfig } from '@/types.js'

// ─── Network constants (single source: @chainpearc/sdk/arc) ─────────────────

export { arcTestnet, USDC_DECIMALS }

/** Every supported network (Arc Testnet only). */
export const PAYMENT_NETWORKS = ['arc-testnet'] as const satisfies readonly PaymentNetwork[]

export const CHAINS = { 'arc-testnet': arcTestnet }

export const CHAIN_IDS: Record<PaymentNetwork, number> = {
  'arc-testnet': ARC_TESTNET_CHAIN_ID
}

export function explorerTxUrl(_network: PaymentNetwork, hash: string): string {
  return arcExplorerTxUrl(hash)
}

/** x402 network id (CAIP-2) for the ChainPe network. */
export function getX402Network(_network: PaymentNetwork): X402Network {
  return X402_NETWORK
}

/** Maps an x402 network id back to the ChainPe network, if supported. */
export function fromX402Network(network: string): PaymentNetwork | undefined {
  return network === X402_NETWORK ? 'arc-testnet' : undefined
}

export function getUsdcAddress(_network: PaymentNetwork): `0x${string}` {
  return ARC_USDC_ADDRESS
}

export function rpcUrlFor(_network: PaymentNetwork): string {
  return arcRpcUrl()
}

export function publicClientFor(network: PaymentNetwork): PublicClient {
  return createPublicClient({
    chain: CHAINS[network],
    transport: http(rpcUrlFor(network))
  })
}

function normalizeKey(key: string): `0x${string}` {
  return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`
}

// ─── Signer / wallet ─────────────────────────────────────────────────────────

/**
 * The viem account that signs x402 (EIP-3009) payments. x402 v2's exact EVM
 * client scheme takes it directly.
 */
export function buildSigner(network: PaymentNetwork, config: AppConfig): PrivateKeyAccount {
  if (!config.privateKey) {
    throw new Error(`No private key configured for network ${network}`)
  }
  return privateKeyToAccount(normalizeKey(config.privateKey))
}

export function getWalletAddress(config: AppConfig): string {
  if (!config.privateKey) {
    throw new Error('No private key configured')
  }
  return privateKeyToAccount(normalizeKey(config.privateKey)).address
}

// ─── Balances ──────────────────────────────────────────────────────────────

export async function getUsdcBalance(
  network: PaymentNetwork,
  config: AppConfig
): Promise<string> {
  if (!config.privateKey) {
    throw new Error(`No key configured for network ${network}`)
  }
  try {
    const client = publicClientFor(network)
    const address = getAddress(getWalletAddress(config))
    const raw = (await client.readContract({
      address: getUsdcAddress(network),
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address]
    })) as bigint
    return formatUnits(raw, USDC_DECIMALS)
  } catch {
    return '0.000000'
  }
}
