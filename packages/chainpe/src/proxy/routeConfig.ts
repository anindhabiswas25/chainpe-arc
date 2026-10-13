/**
 * Route Configuration
 *
 * Builds the x402 v2 RoutesConfig from a ChainPeConfig. Prices are USD strings
 * ("$0.01"); `@x402/evm` resolves them on `eip155:5042002` to Arc USDC
 * (0x3600…0000, 6 decimals) with its EIP-712 domain (`USDC` / `2`). A catch-all
 * "/*" gates every proxied path, and per-path overrides may be supplied.
 */
import type { RoutesConfig, RouteConfig as X402RouteConfig } from "@x402/core/server";
import { getNetwork } from "../chains.js";
import type { ChainPeConfig, RouteConfig as ChainPeRouteConfig } from "../types.js";

/** Converts a human USDC price ("0.01") to the x402 Money string ("$0.01"). */
function toMoney(price: string): string {
  const clean = price.trim().replace(/^\$/, "");
  return `$${clean}`;
}

export type { RoutesConfig };

export interface RoutesOptions {
  /** ERC-8004 agent id advertised in each offer's `extra.agentId`. */
  agentId?: string;
}

export function createRoutesConfig(
  config: ChainPeConfig,
  additionalRoutes?: ChainPeRouteConfig[],
  options: RoutesOptions = {}
): Record<string, X402RouteConfig> {
  const { x402Network } = getNetwork(config.network);
  const extra = options.agentId ? { agentId: options.agentId } : undefined;

  const build = (price: string, description?: string): X402RouteConfig => ({
    accepts: {
      scheme: "exact",
      price: toMoney(price),
      network: x402Network,
      payTo: config.walletAddress,
      ...(extra ? { extra } : {}),
    },
    description: description ?? `Pay ${price} USDC per request`,
  });

  const routes: Record<string, X402RouteConfig> = {};

  // Specific routes first.
  if (additionalRoutes) {
    for (const r of additionalRoutes) {
      routes[r.path] = build(r.pricePerRequest || config.pricePerRequest, r.description);
    }
  }

  // Catch-all: "/*" matches every path beginning with "/".
  routes["/*"] = build(config.pricePerRequest);

  return routes;
}

/** Human-readable summary of the configured routes for CLI display. */
export function formatRoutesForDisplay(
  routes: Record<string, X402RouteConfig>
): Array<{ path: string; price: string; token: string }> {
  return Object.entries(routes).map(([path, cfg]) => {
    const first = Array.isArray(cfg.accepts) ? cfg.accepts[0] : cfg.accepts;
    const price = first?.price;
    const value =
      typeof price === "string" || typeof price === "number"
        ? String(price)
        : price && typeof price === "object" && "amount" in price
          ? String(price.amount)
          : "dynamic";
    return { path, price: value, token: "USDC" };
  });
}
