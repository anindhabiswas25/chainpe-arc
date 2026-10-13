/**
 * ChainPe Proxy Server (Arc Testnet)
 *
 * x402 v2 payment gateway built on `@x402/express`. Every proxied request is
 * gated by a USDC payment (EIP-3009) on Arc Testnet (`eip155:5042002`); once
 * verified, the request is forwarded to the provider's backend and the payment
 * is settled before the response is released.
 *
 * Facilitator modes:
 *   1. External (default): `facilitatorUrl` / `CHAINPE_FACILITATOR_URL`, e.g. a
 *      self-hosted services/chainpe-facilitator. The provider needs no key.
 *   2. Local (`--facilitator <privateKey>`): verifies and settles in-process
 *      with a funded gas wallet. No external dependency.
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { createProxyMiddleware, type Options as ProxyOptions } from "http-proxy-middleware";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient, type FacilitatorClient } from "@x402/core/server";
import { decodePaymentResponseHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";

import type { ChainPeConfig, PaymentEvent, RouteConfig } from "../types.js";
import { createRoutesConfig, formatRoutesForDisplay } from "./routeConfig.js";
import { createLocalFacilitator } from "./localFacilitator.js";
import { getNetwork } from "../chains.js";
import { analytics } from "./analytics.js";
import { logger, logPayment, logRequest, logServerStart } from "../logger.js";

export interface ProxyServerOptions {
  config: ChainPeConfig;
  additionalRoutes?: RouteConfig[];
  onPayment?: (event: PaymentEvent) => void;
  /** Optional EVM private key to run an in-process facilitator (settles on-chain). */
  facilitatorKey?: string;
}

export function createProxyServer(options: ProxyServerOptions): Express {
  const { config, additionalRoutes, onPayment, facilitatorKey } = options;
  const app = express();

  app.use(cors({ exposedHeaders: ["PAYMENT-REQUIRED", "PAYMENT-RESPONSE", "X-CHAINPE-AGENT-ID"] }));

  // Request logging / counting (raw — no body parsing, so proxying is unaffected).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    analytics.recordRequest();
    res.on("finish", () => logRequest(req.method, req.path, res.statusCode, Date.now() - start));
    next();
  });

  // Health check (not gated).
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: config.serviceName, uptime: process.uptime() });
  });

  // Admin endpoints (JSON-parsed, optionally key-protected) — not gated.
  const adminRouter = express.Router();
  adminRouter.use(express.json());
  if (config.adminKey) {
    adminRouter.use((req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers["x-admin-key"] || req.query.adminKey;
      if (apiKey !== config.adminKey) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    });
  }
  adminRouter.get("/stats", (_req: Request, res: Response) => {
    res.json({ ...analytics.getStats(), revenue: analytics.getRevenueSummary(), totalRevenue: undefined, revenueByToken: undefined });
  });
  adminRouter.get("/payments", (_req: Request, res: Response) => res.json(analytics.getRecentPayments()));
  adminRouter.get("/config", (_req: Request, res: Response) => {
    res.json({
      serviceName: config.serviceName,
      serviceDescription: config.serviceDescription,
      targetUrl: config.targetUrl,
      pricePerRequest: config.pricePerRequest,
      paymentToken: config.paymentToken,
      walletAddress: config.walletAddress,
      network: config.network,
      tags: config.tags,
    });
  });
  // Pass-through: fetch /schema from the backend so agents can self-describe
  // their routes without going through the payment gate.
  adminRouter.get("/schema", async (_req: Request, res: Response) => {
    try {
      const r = await fetch(`${config.targetUrl}/schema`);
      if (!r.ok) { res.status(404).json({ error: "Agent has no /schema endpoint" }); return; }
      res.json(await r.json());
    } catch {
      res.status(503).json({ error: "Backend unreachable" });
    }
  });
  app.use("/chainpe-admin", adminRouter);

  // Resolve the facilitator: in-process (gas key) or an external URL.
  let facilitator: FacilitatorClient | undefined;
  const facilitatorUrl = config.facilitatorUrl || process.env.CHAINPE_FACILITATOR_URL;
  if (facilitatorKey) {
    facilitator = createLocalFacilitator(facilitatorKey, config.network);
    logger.info("Using in-process facilitator (settles on-chain with the provided gas key)");
  } else if (facilitatorUrl) {
    facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
    logger.info(`Using external facilitator: ${facilitatorUrl}`);
  } else {
    logger.warn(
      "No facilitator configured. Payments cannot be settled on Arc Testnet.\n" +
        "  Set facilitatorUrl / CHAINPE_FACILITATOR_URL, or run `chainpe start --facilitator <privateKey>`."
    );
  }

  // 3b: advertise this provider's ERC-8004 agentId so consumers can leave
  // reputation feedback without scanning the registry by payTo: an
  // `X-CHAINPE-AGENT-ID` header plus `extra.agentId` in every 402 offer.
  const advertisedAgentId = config.agentId ?? process.env.CHAINPE_AGENT_ID;
  const agentId = advertisedAgentId && advertisedAgentId !== "0" ? advertisedAgentId : undefined;
  if (agentId) {
    app.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader("X-CHAINPE-AGENT-ID", agentId);
      next();
    });
  }

  // x402 routes.
  const routesConfig = createRoutesConfig(config, additionalRoutes, { agentId });
  logger.info("Configured x402 routes:");
  for (const r of formatRoutesForDisplay(routesConfig)) {
    logger.info(`  ${r.path} → ${r.price} ${r.token}`);
  }

  // Payment tracking: record settlements once the response is sent (the x402
  // middleware sets PAYMENT-RESPONSE after a successful settle).
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      const header = res.getHeader("PAYMENT-RESPONSE");
      if (!header || res.statusCode >= 400) return;
      let payer = "unknown";
      let txId: string | undefined;
      try {
        const decoded = decodePaymentResponseHeader(String(header));
        payer = decoded.payer ?? "unknown";
        txId = decoded.transaction || undefined;
      } catch {
        /* malformed header, ignore */
      }
      const event: PaymentEvent = {
        timestamp: new Date(),
        path: req.path,
        amount: config.pricePerRequest,
        token: config.paymentToken,
        payer,
        txId,
        success: true,
      };
      analytics.recordPayment(event);
      logPayment(event.amount, event.token, payer, req.path);
      onPayment?.(event);
    });
    next();
  });

  // Payment middleware (gates everything after it).
  const resourceServer = new x402ResourceServer(facilitator).register(
    getNetwork(config.network).x402Network,
    new ExactEvmScheme()
  );
  // Sync /supported in the background; a down facilitator must not crash the proxy.
  app.use(paymentMiddleware(routesConfig, resourceServer, { appName: config.serviceName }, undefined, !!facilitator));

  // Reverse proxy to the provider backend.
  const proxyOptions: ProxyOptions = {
    target: config.targetUrl,
    changeOrigin: true,
    ws: true,
    on: {
      proxyReq: (_proxyReq, req) => logger.verbose(`Proxying ${req.method} ${req.url} → ${config.targetUrl}`),
      proxyRes: (proxyRes, req) => logger.verbose(`Response ${config.targetUrl}${req.url}: ${proxyRes.statusCode}`),
      error: (err, _req, res) => {
        logger.error(`Proxy error: ${err.message}`);
        if (res && "writeHead" in res && typeof (res as Response).status === "function") {
          (res as Response).status(502).json({ error: "Bad Gateway", message: "Failed to reach upstream server" });
        }
      },
    },
  };
  app.use("/", createProxyMiddleware(proxyOptions));

  return app;
}

export async function startProxyServer(
  options: ProxyServerOptions
): Promise<{ app: Express; server: ReturnType<Express["listen"]> }> {
  const { config } = options;
  const app = createProxyServer(options);
  return new Promise((resolve) => {
    const server = app.listen(config.proxyPort, () => {
      logServerStart(config.proxyPort, config.serviceName);
      resolve({ app, server });
    });
  });
}

export { analytics };
