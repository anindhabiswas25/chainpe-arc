/**
 * HTTP layer of the ChainPe facilitator: the x402 v2 facilitator contract
 * (`/verify`, `/settle`, `/supported`) plus health, status and metrics.
 *
 * Dependencies are injected so tests can run against a fake chain.
 */
import express, { type Request, type Response } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { Logger } from "pino";
import type { x402Facilitator } from "@x402/core/facilitator";
import { PaymentPayloadV2Schema, PaymentRequirementsV2Schema } from "@x402/core/schemas";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import {
  CHAINPE_NETWORK,
  X402_NETWORK,
  formatNativeUsdc,
} from "../../../packages/chainpe-sdk/src/arc.js";

export const ERR_INVALID_PAYLOAD = "invalid_payload";

export interface AppDeps {
  facilitator: x402Facilitator;
  /** Address of the gas key that submits settlements. */
  facilitatorAddress: `0x${string}`;
  /** Live native (18-decimal) USDC balance of the gas key. */
  getGasBalance: () => Promise<bigint>;
  /** Most recent cached gas balance, or null if never read. */
  cachedGasBalance: () => bigint | null;
  /** `/health` reports `degraded` below this native balance. */
  lowGasThreshold: bigint;
  logger: Logger;
  /** CORS allowlist; empty denies all cross-origin browser requests. */
  allowedOrigins?: string[];
  /** Per-IP limit for /verify and /settle per minute (default 60). */
  rateLimitPerMinute?: number;
}

type ParsedRequest =
  | { ok: true; paymentPayload: PaymentPayload; paymentRequirements: PaymentRequirements }
  | { ok: false; message: string };

/** Validates a `/verify` or `/settle` body against the x402 v2 schemas. */
function parseRequest(body: unknown): ParsedRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const payload = PaymentPayloadV2Schema.safeParse(b.paymentPayload);
  if (!payload.success) {
    return { ok: false, message: `paymentPayload: ${payload.error.issues[0]?.message ?? "invalid"}` };
  }
  const requirements = PaymentRequirementsV2Schema.safeParse(b.paymentRequirements);
  if (!requirements.success) {
    return {
      ok: false,
      message: `paymentRequirements: ${requirements.error.issues[0]?.message ?? "invalid"}`,
    };
  }
  return {
    ok: true,
    paymentPayload: payload.data as PaymentPayload,
    paymentRequirements: requirements.data as PaymentRequirements,
  };
}

export function createApp(deps: AppDeps) {
  const { facilitator, facilitatorAddress, logger: log } = deps;
  const counters = { verify_success: 0, verify_error: 0, settle_success: 0, settle_error: 0 };

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: deps.rateLimitPerMinute ?? 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limit_exceeded" },
  });

  const origins = deps.allowedOrigins ?? [];
  const app = express();
  // No origins configured → deny browser cross-origin requests. Server-to-server
  // calls (no Origin header) still work.
  app.use(origins.length === 0 ? cors({ origin: false }) : cors({ origin: origins, credentials: true }));
  // x402 payloads are well under 10 KB.
  app.use(express.json({ limit: "50kb" }));

  const isLowGas = () => {
    const bal = deps.cachedGasBalance();
    return bal !== null && bal < deps.lowGasThreshold;
  };

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      service: "chainpe-facilitator",
      description: "Non-custodial x402 verify + settle for USDC on Arc Testnet.",
      network: CHAINPE_NETWORK,
      x402Network: X402_NETWORK,
      x402Version: 2,
      custodial: false,
      endpoints: ["/health", "/status", "/supported", "/metrics", "/verify", "/settle"],
    });
  });

  // Liveness probe: always 200 while the process runs. Low gas shows up as
  // `degraded` so Railway does not crash-loop on a low balance.
  app.get("/health", (_req: Request, res: Response) => {
    const lowGas = isLowGas();
    if (lowGas) {
      log.warn(
        { facilitator: facilitatorAddress, gasBalanceUsdc: formatNativeUsdc(deps.cachedGasBalance()!) },
        "health check: USDC gas balance low, top up required"
      );
    }
    res.json({
      status: lowGas ? "degraded" : "ok",
      service: "chainpe-facilitator",
      network: CHAINPE_NETWORK,
      x402Network: X402_NETWORK,
      facilitator: facilitatorAddress,
      custodial: false,
      ...(lowGas ? { warning: "low_gas" } : {}),
    });
  });

  // Operational status including a live gas balance read.
  app.get("/status", async (_req: Request, res: Response) => {
    const balance = await deps.getGasBalance().catch(() => null);
    res.json({
      service: "chainpe-facilitator",
      network: CHAINPE_NETWORK,
      x402Network: X402_NETWORK,
      facilitator: facilitatorAddress,
      // Gas is native USDC (18 decimals); shown in USDC units.
      gasBalanceUsdc: balance != null ? formatNativeUsdc(balance) : "unavailable",
      lowGasThresholdUsdc: formatNativeUsdc(deps.lowGasThreshold),
      lowGas: balance != null ? balance < deps.lowGasThreshold : null,
    });
  });

  app.get("/supported", (_req: Request, res: Response) => {
    res.json(facilitator.getSupported());
  });

  // Prometheus text format. Counters reset on restart.
  app.get("/metrics", (_req: Request, res: Response) => {
    const bal = deps.cachedGasBalance();
    const lines = [
      "# HELP chainpe_verify_total Total /verify requests handled",
      "# TYPE chainpe_verify_total counter",
      `chainpe_verify_total{result="success"} ${counters.verify_success}`,
      `chainpe_verify_total{result="error"} ${counters.verify_error}`,
      "# HELP chainpe_settle_total Total /settle requests handled",
      "# TYPE chainpe_settle_total counter",
      `chainpe_settle_total{result="success"} ${counters.settle_success}`,
      `chainpe_settle_total{result="error"} ${counters.settle_error}`,
      "# HELP chainpe_gas_balance_usdc Gas key balance in USDC (native gas token on Arc)",
      "# TYPE chainpe_gas_balance_usdc gauge",
      `chainpe_gas_balance_usdc{network="${X402_NETWORK}",facilitator="${facilitatorAddress}"} ${bal !== null ? formatNativeUsdc(bal) : 0}`,
    ].join("\n") + "\n";
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(lines);
  });

  app.post("/verify", apiLimiter, async (req: Request, res: Response) => {
    const parsed = parseRequest(req.body);
    if (!parsed.ok) {
      counters.verify_error++;
      res.status(400).json({ isValid: false, invalidReason: ERR_INVALID_PAYLOAD, invalidMessage: parsed.message });
      return;
    }
    try {
      const result = await facilitator.verify(parsed.paymentPayload, parsed.paymentRequirements);
      if (result.isValid) counters.verify_success++;
      else counters.verify_error++;
      log.info({ event: "verify", isValid: result.isValid, reason: result.invalidReason, payer: result.payer }, "verify");
      res.json(result);
    } catch (err) {
      counters.verify_error++;
      log.error({ event: "verify_error", err }, "verify failed");
      res.status(500).json({ isValid: false, invalidReason: "unexpected_verify_error" });
    }
  });

  app.post("/settle", apiLimiter, async (req: Request, res: Response) => {
    const parsed = parseRequest(req.body);
    if (!parsed.ok) {
      counters.settle_error++;
      res.status(400).json({
        success: false,
        errorReason: ERR_INVALID_PAYLOAD,
        errorMessage: parsed.message,
        transaction: "",
        network: X402_NETWORK,
      });
      return;
    }
    try {
      const result = await facilitator.settle(parsed.paymentPayload, parsed.paymentRequirements);
      if (result.success) counters.settle_success++;
      else counters.settle_error++;
      log.info(
        { event: "settle", success: result.success, reason: result.errorReason, transaction: result.transaction, payer: result.payer },
        "settle"
      );
      res.json(result);
    } catch (err) {
      counters.settle_error++;
      const message = err instanceof Error ? err.message : String(err);
      // Guard hooks abort with "Settlement aborted: <reason>".
      const aborted = /^Settlement aborted: (.+)$/.exec(message);
      log.error({ event: "settle_error", err }, "settle failed");
      res.status(aborted ? 400 : 500).json({
        success: false,
        errorReason: aborted ? aborted[1] : "unexpected_settle_error",
        transaction: "",
        network: parsed.paymentRequirements.network,
      });
    }
  });

  return app;
}
