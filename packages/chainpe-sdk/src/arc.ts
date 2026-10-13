/**
 * Arc Testnet — the single source of truth for chain constants across ChainPe.
 *
 * Import from `@chainpearc/sdk/arc` (lightweight: depends only on viem) or from
 * the `@chainpearc/sdk` root. Every value here was verified on-chain against
 * https://rpc.testnet.arc.io and docs.arc.io (see ARC_INTEGRATION.md).
 *
 * Gas on Arc is paid in USDC. The native balance (18 decimals) and the USDC
 * ERC-20 interface at 0x3600…0000 (6 decimals) are the SAME funds viewed at
 * two precisions — never add them together.
 */
import { defineChain, formatUnits, getAddress } from 'viem'

/** ChainPe-facing network name. `arc-testnet` is the only supported network. */
export type ChainPeNetwork = 'arc-testnet'
export const CHAINPE_NETWORK: ChainPeNetwork = 'arc-testnet'

export const ARC_TESTNET_CHAIN_ID = 5042002

/**
 * The x402 network id (CAIP-2) ChainPe's facilitator, proxy and clients use.
 * x402 v2 (`@x402/*`) knows Arc Testnet natively under this id.
 */
export const X402_NETWORK = 'eip155:5042002' as const
export type X402Network = typeof X402_NETWORK

/** Default public RPC. Override with `ARC_RPC_URL`. */
export const ARC_TESTNET_RPC_URL = 'https://rpc.testnet.arc.io'

/** Block explorer (testnet.arcscan.app redirects here). No trailing slash. */
export const ARC_TESTNET_EXPLORER_URL = 'https://explorer.testnet.arc.io'

/** USDC ERC-20 interface (6 decimals). Same balance as native USDC gas. */
export const ARC_USDC_ADDRESS: `0x${string}` =
  '0x3600000000000000000000000000000000000000'
export const USDC_DECIMALS = 6
/** Decimals of the native USDC balance (what `eth_getBalance` returns). */
export const NATIVE_USDC_DECIMALS = 18

/**
 * EIP-712 domain of Arc USDC (FiatTokenV2_2), used to sign EIP-3009
 * `transferWithAuthorization`. Recomputes to the on-chain DOMAIN_SEPARATOR
 * 0x361191522483d32a83e70ae7183b4b9629442c13a78bc9921d6f707911c8c6b0.
 */
export const ARC_USDC_EIP712_DOMAIN = {
  name: 'USDC',
  version: '2',
  chainId: ARC_TESTNET_CHAIN_ID,
  verifyingContract: ARC_USDC_ADDRESS
} as const

/**
 * Arc's canonical ERC-8004 registries (published at docs.arc.io →
 * Contract addresses; reference implementation v2.0.0).
 */
export const ARC_TESTNET_ERC8004 = {
  identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  reputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
  validationRegistry: '0x8004Cb1BF31DAf7788923b405b754f57acEB4272'
} as const satisfies Record<string, `0x${string}`>

/**
 * ChainPe's own contracts on Arc Testnet (deployed 2026-10-13). Mirrors
 * contracts/deployments/arc-testnet*.json (a test keeps them in sync).
 * Every package defaults to these; env vars / explicit options override them.
 */
export const ARC_TESTNET_CONTRACTS = {
  /** ChainPeRegistry UUPS proxy (registration fee: 1 USDC). */
  chainPeRegistry: '0x79c7a22993A40A3c88355b737e6F608c6610c395',
  /** PolicyVault UUPS proxy. */
  policyVault: '0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81',
  /** ChainPeTimelock (48h delay). */
  timelock: '0x5071794F30C32604Be115c00Ed041c403fB2f302',
  /** First block worth indexing (ChainPeRegistry deployment block). */
  deployBlock: 66993614n
} as const satisfies {
  chainPeRegistry: `0x${string}`
  policyVault: `0x${string}`
  timelock: `0x${string}`
  deployBlock: bigint
}

/** Arc Testnet as a viem chain (not a viem built-in). */
export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: NATIVE_USDC_DECIMALS },
  rpcUrls: { default: { http: [ARC_TESTNET_RPC_URL] } },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: ARC_TESTNET_EXPLORER_URL }
  },
  testnet: true
})

/** The RPC URL to use: `ARC_RPC_URL` when set, else the public default. */
export function arcRpcUrl(): string {
  const env =
    typeof process !== 'undefined' ? process.env?.ARC_RPC_URL : undefined
  return env || ARC_TESTNET_RPC_URL
}

export function explorerTxUrl(txHash: string): string {
  return `${ARC_TESTNET_EXPLORER_URL}/tx/${txHash}`
}

export function explorerAddressUrl(address: string): string {
  return `${ARC_TESTNET_EXPLORER_URL}/address/${getAddress(address)}`
}

/** Maps an x402 network id (CAIP-2) to the ChainPe network name. */
export function fromX402Network(network: string): ChainPeNetwork | undefined {
  return network === X402_NETWORK ? CHAINPE_NETWORK : undefined
}

/**
 * Formats a native (18-decimal) USDC balance for display, e.g. "1.234567".
 * Truncates to 6 decimals so it reads like the ERC-20 balance; use the raw
 * bigint when crediting or recording amounts.
 */
export function formatNativeUsdc(wei: bigint): string {
  return formatUnits(wei / 10n ** 12n, USDC_DECIMALS)
}
