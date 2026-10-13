/**
 * ChainPe x402 Facilitator — standalone, non-custodial settlement service.
 *
 * Implements the x402 v2 facilitator HTTP contract (`/verify`, `/settle`,
 * `/supported`) for USDC (EIP-3009) payments on Arc Testnet, network
 * `eip155:5042002`. Point a ChainPe provider proxy at it with
 * `CHAINPE_FACILITATOR_URL`.
 *
 * NON-CUSTODIAL: the facilitator key only pays gas and relays the payer's
 * already-signed `transferWithAuthorization`. It never holds user funds and
 * cannot move money the payer did not authorize.
 *
 * Env:
 *   FACILITATOR_PRIVATE_KEY  (required) gas-paying key that submits settlements
 *   ARC_RPC_URL              optional RPC override (RPC_URL is accepted as a fallback)
 *   PORT                     HTTP port (Railway injects this; default 4500)
 *   ALLOWED_ORIGINS          comma-separated CORS allowlist (default: deny browsers)
 *   LOW_GAS_THRESHOLD_USDC   /health turns `degraded` below this (default 0.5)
 */
import "dotenv/config";
import pino from "pino";
import { createPublicClient, createWalletClient, http, parseUnits, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { toFacilitatorEvmSigner } from "@x402/evm";
import {
  ARC_TESTNET_RPC_URL,
  NATIVE_USDC_DECIMALS,
  X402_NETWORK,
  arcTestnet,
  formatNativeUsdc,
} from "../../../packages/chainpe-sdk/src/arc.js";
import { createApp } from "./app.js";
import { createArcFacilitator } from "./facilitator.js";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

if (process.env.NETWORK && !["arc-testnet", X402_NETWORK].includes(process.env.NETWORK)) {
  log.fatal(`Unsupported NETWORK "${process.env.NETWORK}" (only arc-testnet / ${X402_NETWORK}).`);
  process.exit(1);
}

const RPC_URL = process.env.ARC_RPC_URL || process.env.RPC_URL || ARC_TESTNET_RPC_URL;
const PORT = parseInt(process.env.PORT ?? "4500", 10);
// A transferWithAuthorization costs ~0.002–0.005 USDC at Arc's 20+ gwei base
// fee, so 0.5 USDC covers roughly a hundred settlements.
const LOW_GAS_THRESHOLD = parseUnits(process.env.LOW_GAS_THRESHOLD_USDC ?? "0.5", NATIVE_USDC_DECIMALS);

const rawKey = process.env.FACILITATOR_PRIVATE_KEY;
if (!rawKey) {
  log.fatal("FACILITATOR_PRIVATE_KEY is required (gas-paying settlement key).");
  process.exit(1);
}
const account = privateKeyToAccount((rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`);

const publicClient = createPublicClient({ chain: arcTestnet, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(RPC_URL) }).extend(
  publicActions
);

const signer = toFacilitatorEvmSigner({
  address: account.address,
  readContract: (args) => walletClient.readContract(args as never),
  verifyTypedData: (args) => walletClient.verifyTypedData(args as never),
  writeContract: (args) => walletClient.writeContract(args as never),
  sendTransaction: (args) => walletClient.sendTransaction(args),
  waitForTransactionReceipt: (args) => walletClient.waitForTransactionReceipt(args),
  getCode: (args) => walletClient.getCode(args),
});

let cachedGasBalance: bigint | null = null;
const getGasBalance = async () => {
  const bal = await publicClient.getBalance({ address: account.address });
  cachedGasBalance = bal;
  return bal;
};
const refresh = () => getGasBalance().catch(() => undefined); // keep stale value on RPC errors

const app = createApp({
  facilitator: createArcFacilitator(signer),
  facilitatorAddress: account.address,
  getGasBalance,
  cachedGasBalance: () => cachedGasBalance,
  lowGasThreshold: LOW_GAS_THRESHOLD,
  logger: log,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
});

async function main() {
  const chainId = await publicClient.getChainId();
  if (chainId !== arcTestnet.id) {
    throw new Error(`RPC ${RPC_URL} is chain ${chainId}, expected Arc Testnet ${arcTestnet.id}.`);
  }
  await refresh();
  setInterval(refresh, 60_000).unref();
  app.listen(PORT, () => {
    log.info(
      {
        x402Network: X402_NETWORK,
        rpc: RPC_URL,
        facilitator: account.address,
        gasBalanceUsdc: cachedGasBalance !== null ? formatNativeUsdc(cachedGasBalance) : "unavailable",
      },
      `ChainPe facilitator listening on :${PORT}`
    );
    if (cachedGasBalance !== null && cachedGasBalance < LOW_GAS_THRESHOLD) {
      log.warn(
        `USDC gas balance below ${formatNativeUsdc(LOW_GAS_THRESHOLD)} USDC. Top up ${account.address} (faucet.circle.com).`
      );
    }
  });
}

main().catch((e) => {
  log.fatal(e, "fatal startup error");
  process.exit(1);
});
