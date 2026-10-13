/**
 * EVM helpers for the ChainPe provider (Arc Testnet).
 *
 * Address validation, the USDC balance, and amount formatting, all via viem.
 * On Arc USDC is also the gas token, so the ERC-20 balance is the only figure.
 */
import {
  createPublicClient,
  http,
  isAddress,
  getAddress,
  formatUnits,
  parseUnits,
  erc20Abi,
  type PublicClient,
} from "viem";
import { getNetwork, USDC_DECIMALS, type ChainPeNetwork } from "./chains.js";

/** Creates a read-only viem public client for the given network. */
export function createClient(network: ChainPeNetwork): PublicClient {
  const info = getNetwork(network);
  return createPublicClient({ chain: info.chain, transport: http(info.rpcUrl) });
}

/** Validates an EVM address (0x + 40 hex, checksum-tolerant). */
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

/** Normalises to a checksummed address; throws if invalid. */
export function toChecksum(address: string): `0x${string}` {
  return getAddress(address);
}

export interface AccountBalances {
  /** USDC (ERC-20 interface, 6 decimals). Also the gas balance on Arc. */
  usdc: bigint;
}

/** Fetches the USDC balance for an address. */
export async function getAccountBalances(
  network: ChainPeNetwork,
  address: string
): Promise<AccountBalances> {
  const usdc = (await createClient(network).readContract({
    address: getNetwork(network).usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [getAddress(address)],
  })) as bigint;
  return { usdc };
}

/** Formats atomic USDC (6 decimals) to a human string. */
export function formatUsdc(atomic: bigint): string {
  return formatUnits(atomic, USDC_DECIMALS);
}

/** Parses a human USDC string to atomic units. */
export function parseUsdc(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}
