/**
 * x402 v2 client wiring for the wallet tools (Arc Testnet, eip155:5042002).
 * Signs EIP-3009 `transferWithAuthorization` with the Arc USDC domain that
 * x402 attaches to each offer (`extra.name` / `extra.version`).
 */
import { x402Client, x402HTTPClient } from '@x402/core/client'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { X402_NETWORK } from '@chainpearc/sdk/arc'
import type { AppConfig } from '@/types.js'
import { buildSigner } from '@/clients.js'

export function createX402HttpClient(config: AppConfig): x402HTTPClient {
  const client = new x402Client()
    .register(X402_NETWORK, new ExactEvmScheme(buildSigner(config.network, config)))
    // Same per-call cap as the SpendingTracker, enforced again inside x402.
    .setSpendControls({ maxAmountPerPayment: `$${config.budget.maxPerCall}` })
  return new x402HTTPClient(client)
}
