/**
 * @chainpearc/sdk — x402 USDC payments + on-chain ERC-8004 reputation for the
 * agent economy on Arc Testnet, in a few lines.
 *
 * @example
 * ```ts
 * import { ChainPe } from '@chainpearc/sdk'
 *
 * const cp = new ChainPe({ privateKey: process.env.PRIVATE_KEY!, network: 'arc-testnet' })
 * const res = await cp.fetch('https://api.example.com/paid')
 * console.log(await res.json())
 * ```
 */
export { ChainPe } from './chainpe.js'

export {
  RegistryClient,
  filterServices,
  rankByReputation,
  decodeService
} from './registry.js'
export type { RawService } from './registry.js'

export {
  getReputation,
  giveFeedback,
  summaryToScore
} from './reputation.js'
export type { GiveFeedbackParams } from './reputation.js'

export { PolicyVaultClient } from './policyvault.js'
export type {
  PolicyVaultOptions,
  PolicyParams,
  SpendAuthorization
} from './policyvault.js'

export {
  publicClientFor,
  resolveRegistryAddress,
  resolvePolicyVaultAddress,
  resolveReputationRegistry,
  getUsdcAddress,
  getX402Network,
  rpcUrlFor
} from './networks.js'

// Arc Testnet constants (also available as '@chainpearc/sdk/arc').
export * from './arc.js'

export { ChainPePaymentError } from './types.js'
export type {
  ChainPeOptions,
  FetchOptions,
  ChainPeService,
  DiscoverOptions,
  ReputationSummary,
  RankedService,
  PaymentInfo,
  PaidResult,
  Balances
} from './types.js'
