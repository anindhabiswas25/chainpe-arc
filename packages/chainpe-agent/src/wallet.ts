/**
 * Wallet Module (Arc Testnet)
 *
 * Derives an EVM account from a private key; the viem account is the x402
 * signer for EIP-3009 payments. USDC is also Arc's gas token, so the wallet has
 * a single balance.
 *
 * SECURITY: Private keys are retrieved from the OS keychain, never stored in files.
 */

import {
  createPublicClient,
  http,
  erc20Abi,
  formatUnits,
  parseUnits,
  getAddress,
  type PublicClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

import type { ChainPeNetwork } from "./types.js";
import { CHAINS, RPC_URLS, USDC_ADDRESS, USDC_DECIMALS } from "./types.js";
import { getPrivateKey } from "./keychain.js";

function normalizeKey(key: string): `0x${string}` {
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
}

// ============================================================================
// Wallet Creation
// ============================================================================

export interface WalletInstance {
  address: string;
  /** viem account; signs x402 (EIP-3009) payments. */
  signer: PrivateKeyAccount;
  network: ChainPeNetwork;
}

/** Creates a wallet instance from a private key for the given network. */
export async function createWalletFromPrivateKey(
  privateKey: string,
  network: ChainPeNetwork = "arc-testnet"
): Promise<WalletInstance> {
  const account = privateKeyToAccount(normalizeKey(privateKey));
  return { address: account.address, signer: account, network };
}

/** Creates a wallet instance by retrieving the private key from the OS keychain. */
export async function createWalletFromAddress(
  address: string,
  network: ChainPeNetwork = "arc-testnet"
): Promise<WalletInstance> {
  const privateKey = await getPrivateKey(address);
  if (!privateKey) {
    throw new Error(
      `Wallet private key not found in OS keychain for address: ${address}\n` +
        `Run 'chainpe-agent init' to set up your wallet.`
    );
  }
  return createWalletFromPrivateKey(privateKey, network);
}

/** Derives the EVM address from a private key. */
export function addressFromPrivateKey(privateKey: string): string {
  return privateKeyToAccount(normalizeKey(privateKey)).address;
}

// ============================================================================
// Clients
// ============================================================================

export function createClient(network: ChainPeNetwork): PublicClient {
  return createPublicClient({ chain: CHAINS[network], transport: http(RPC_URLS[network]) });
}

// ============================================================================
// Balances
// ============================================================================

export interface WalletBalance {
  /** USDC (ERC-20 interface, 6 decimals). Also the gas balance on Arc. */
  usdc: bigint;
}

export async function getWalletBalance(
  address: string,
  network: ChainPeNetwork
): Promise<WalletBalance> {
  try {
    const usdc = (await createClient(network).readContract({
      address: USDC_ADDRESS[network],
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [getAddress(address)],
    })) as bigint;
    return { usdc };
  } catch {
    return { usdc: 0n };
  }
}

export function hasSufficientUsdc(balance: WalletBalance, amountAtomic: bigint): boolean {
  return balance.usdc >= amountAtomic;
}

// ============================================================================
// Formatting
// ============================================================================

/** Formats atomic USDC (6 decimals) to a human string. */
export function formatAmount(atomic: bigint, decimals: number = USDC_DECIMALS): string {
  return formatUnits(atomic, decimals);
}

/** Parses a human USDC string to atomic units. */
export function parseAmount(amount: string, decimals: number = USDC_DECIMALS): bigint {
  return parseUnits(amount, decimals);
}

export function formatBalance(balance: WalletBalance): { usdc: string } {
  return { usdc: formatUnits(balance.usdc, USDC_DECIMALS) };
}
