/**
 * ChainPe Agent SDK Types
 * Types for the consumer-side AI agent with x402 payment capabilities (Arc Testnet)
 */

import {
  ARC_TESTNET_EXPLORER_URL,
  ARC_USDC_ADDRESS,
  X402_NETWORK as ARC_X402_NETWORK,
  arcRpcUrl,
  arcTestnet,
  USDC_DECIMALS,
} from "@chainpearc/sdk/arc";

export { arcTestnet, USDC_DECIMALS };

// ============================================================================
// LLM Configuration
// ============================================================================

export type LLMMode = "api" | "local";
export type LLMProvider = "openai" | "anthropic" | "gemini" | "groq";

export interface LLMConfig {
  mode?: LLMMode; // Defaults to "api" for backwards compatibility
  provider: LLMProvider;
  model: string;
  apiKey?: string; // Optional for local mode
  baseURL?: string; // Optional custom base URL (e.g., for Ollama)
}

// ============================================================================
// Network / Payment Configuration
// ============================================================================

/** Arc Testnet is the only supported network. */
export type ChainPeNetwork = "arc-testnet";

export const DEFAULT_NETWORK: ChainPeNetwork = "arc-testnet";

// x402 "exact" on EVM settles in USDC.
export type PaymentToken = "USDC";

export interface WalletConfig {
  address: string; // EVM wallet address (0x), derived from the private key
  useKeychain?: boolean; // Whether the private key is stored in the OS keychain (default: true)
}

export interface PaymentConfig {
  preferredToken: PaymentToken;
  maxPricePerRequest?: string; // Optional spending limit
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  llm: LLMConfig;
  wallet: WalletConfig;
  payment: PaymentConfig;
  registryPath?: string;
  network?: ChainPeNetwork;
  registryAddress?: string; // Deployed ChainPeRegistry contract address (0x)
  reputationRegistry?: string; // ERC-8004 Reputation Registry address (0x)
}

// ============================================================================
// Registry Types
// ============================================================================

export interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  tags: string[];
  endpoint: string;
  pricePerRequest: string;
  paymentToken: PaymentToken;
  walletAddress: string;
  network: ChainPeNetwork;
  agentId?: string; // ERC-8004 agent identity
  createdAt?: string;
  updatedAt?: string;
}

export interface Registry {
  version: string;
  services: ServiceInfo[];
}

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentReceipt {
  txId?: string;
  amount: string;
  token: PaymentToken;
  recipient: string;
  timestamp: Date;
  service: string;
  path: string;
}

export interface PaymentSummary {
  totalSpent: Record<PaymentToken, string>;
  transactionCount: number;
  receipts: PaymentReceipt[];
}

// ============================================================================
// Task Types
// ============================================================================

export interface RunOptions {
  provider?: string; // Service name to use
  maxSteps?: number; // Max agentic loop iterations
  verbose?: boolean;
  onStep?: (step: StepInfo) => void;
  onPayment?: (receipt: PaymentReceipt) => void;
}

export interface StepInfo {
  stepNumber: number;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  text?: string;
  thinking?: string;
}

export interface TaskResult {
  text: string;
  success: boolean;
  steps: StepInfo[];
  payments: PaymentSummary;
  error?: string;
  duration: number;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultInfo {
  name: string;
  result: unknown;
}

// ============================================================================
// HTTP Client Types
// ============================================================================

export interface HttpRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  paid?: boolean;
  paymentReceipt?: PaymentReceipt;
}

// ============================================================================
// Constants — Arc Testnet (single source: @chainpearc/sdk/arc)
// ============================================================================

export const CHAINS = { "arc-testnet": arcTestnet } as const;

export const CHAIN_IDS: Record<ChainPeNetwork, number> = {
  "arc-testnet": arcTestnet.id,
};

export const RPC_URLS: Record<ChainPeNetwork, string> = {
  "arc-testnet": arcRpcUrl(),
};

// USDC ERC-20 interface (6 decimals).
export const USDC_ADDRESS: Record<ChainPeNetwork, `0x${string}`> = {
  "arc-testnet": ARC_USDC_ADDRESS,
};

// x402 network identifiers (CAIP-2).
export const X402_NETWORK: Record<ChainPeNetwork, typeof ARC_X402_NETWORK> = {
  "arc-testnet": ARC_X402_NETWORK,
};

export const EXPLORER: Record<ChainPeNetwork, string> = {
  "arc-testnet": ARC_TESTNET_EXPLORER_URL,
};


export const DEFAULT_REGISTRY_PATH = "~/.chainpe/registry.json";
export const CONFIG_PATH = "~/.chainpe/agent.json";
