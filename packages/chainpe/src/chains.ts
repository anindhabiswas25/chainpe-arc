/**
 * Network definitions for ChainPe.
 *
 * Arc Testnet is the only supported network. Every constant comes from
 * `@chainpearc/sdk/arc`, the single Arc definition shared across ChainPe.
 */
import type { Chain } from "viem";
import {
  CHAINPE_NETWORK,
  ARC_TESTNET_EXPLORER_URL,
  ARC_USDC_ADDRESS,
  X402_NETWORK,
  arcRpcUrl,
  arcTestnet,
  explorerTxUrl as arcExplorerTxUrl,
  fromX402Network,
  USDC_DECIMALS,
  type ChainPeNetwork,
  type X402Network,
} from "@chainpearc/sdk/arc";

export { arcTestnet, fromX402Network, USDC_DECIMALS, X402_NETWORK };
export type { ChainPeNetwork, X402Network };

export const DEFAULT_NETWORK: ChainPeNetwork = CHAINPE_NETWORK;

export interface NetworkInfo {
  /** ChainPe-facing network name. */
  name: ChainPeNetwork;
  /** EVM chain id. */
  chainId: number;
  /** viem chain object. */
  chain: Chain;
  /** RPC URL (`ARC_RPC_URL` or the public default). */
  rpcUrl: string;
  /** USDC ERC-20 interface (6 decimals). */
  usdc: `0x${string}`;
  /** x402 network identifier (CAIP-2). */
  x402Network: X402Network;
  /** Explorer base URL (no trailing slash). */
  explorer: string;
}

export const NETWORKS: Record<ChainPeNetwork, NetworkInfo> = {
  "arc-testnet": {
    name: CHAINPE_NETWORK,
    chainId: arcTestnet.id,
    chain: arcTestnet,
    rpcUrl: arcRpcUrl(),
    usdc: ARC_USDC_ADDRESS,
    x402Network: X402_NETWORK,
    explorer: ARC_TESTNET_EXPLORER_URL,
  },
};

export function isChainPeNetwork(value: string): value is ChainPeNetwork {
  return Object.prototype.hasOwnProperty.call(NETWORKS, value);
}

export function getNetwork(network: ChainPeNetwork): NetworkInfo {
  const info = NETWORKS[network];
  if (!info) throw new Error(`Unknown network: ${network} (expected "arc-testnet").`);
  return info;
}

export function explorerTxUrl(_network: ChainPeNetwork, txHash: string): string {
  return arcExplorerTxUrl(txHash);
}
