/**
 * ChainPe - Provider SDK
 * Monetize any API with x402 micropayments on Arc Testnet.
 */

// Types
export * from "./types.js";

// Networks
export {
  NETWORKS,
  DEFAULT_NETWORK,
  arcTestnet,
  isChainPeNetwork,
  getNetwork,
  fromX402Network,
  explorerTxUrl,
  USDC_DECIMALS,
  X402_NETWORK,
} from "./chains.js";
export type { ChainPeNetwork, NetworkInfo, X402Network } from "./chains.js";

// Shared Arc Testnet constants (single source: @chainpearc/sdk/arc).
export {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_EXPLORER_URL,
  ARC_USDC_ADDRESS,
  ARC_USDC_EIP712_DOMAIN,
  ARC_TESTNET_ERC8004,
  ARC_TESTNET_CONTRACTS,
  NATIVE_USDC_DECIMALS,
  arcRpcUrl,
  explorerAddressUrl,
  formatNativeUsdc,
} from "@chainpearc/sdk/arc";

// Proxy Server
export {
  createProxyServer,
  startProxyServer,
  analytics,
  Analytics,
  createRoutesConfig,
  formatRoutesForDisplay,
} from "./proxy/index.js";
export type { RoutesConfig } from "./proxy/index.js";

// EVM helpers
export {
  createClient,
  isValidAddress,
  toChecksum,
  getAccountBalances,
  formatUsdc,
  parseUsdc,
} from "./evm.js";
export type { AccountBalances } from "./evm.js";

// On-Chain Registry
export {
  ChainPeRegistryClient,
  onChainToServiceRegistration,
  resolveRegistryAddress,
  CHAINPE_REGISTRY_ABI,
} from "./registry.js";
export type { RegistrationResult, OnChainService } from "./registry.js";

// Browser / MetaMask registration handoff
export { registerViaBrowser } from "./wallet-connect-browser.js";
export type { BrowserRegisterParams, BrowserRegisterResult } from "./wallet-connect-browser.js";

// Logger
export { logger, setLogLevel, getLogLevel, logPayment, logRequest, logServerStart } from "./logger.js";
