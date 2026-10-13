/**
 * ChainPe x402 Proxy — env-configured deployment (Arc Testnet)
 *
 * Wraps any HTTP backend in an x402 USDC paywall. It runs the same proxy as
 * `chainpe start` (`startProxyServer` from @chainpearc/cli), configured entirely
 * from environment variables so it deploys to Railway, Docker or any Node host.
 *
 *   TARGET_URL               Backend API to proxy (required)
 *   WALLET_ADDRESS           0x address that receives USDC payments (required)
 *   CHAINPE_FACILITATOR_URL  Your self-hosted facilitator (services/chainpe-facilitator)
 *                            that verifies + settles payments (required to settle)
 *   PRICE                    USDC per request, e.g. "0.02" (default "0.02")
 *   SERVICE_NAME             Display name (default "ChainPe Service")
 *   SERVICE_DESCRIPTION      Optional description
 *   NETWORK                  "arc-testnet" (default; the only supported network)
 *   CHAINPE_AGENT_ID         Optional ERC-8004 agent id advertised on 402s
 *   PORT                     HTTP port (default 4402; Railway injects this)
 *
 * Payments are USDC via x402 (EIP-3009). The payer signs the authorization; the
 * facilitator submits it on Arc Testnet and pays the gas (in USDC).
 */

import { startProxyServer } from '@chainpearc/cli'

const env = process.env

for (const key of ['TARGET_URL', 'WALLET_ADDRESS']) {
  if (!env[key]) {
    console.error(`Missing env: ${key}`)
    process.exit(1)
  }
}

const NETWORK = env.NETWORK ?? 'arc-testnet'
if (NETWORK !== 'arc-testnet') {
  console.error(`Unsupported NETWORK "${NETWORK}" (expected "arc-testnet").`)
  process.exit(1)
}

if (!env.CHAINPE_FACILITATOR_URL) {
  console.warn('⚠ CHAINPE_FACILITATOR_URL not set — 402s are served but payments cannot be settled.')
  console.warn('  Run services/chainpe-facilitator and set CHAINPE_FACILITATOR_URL to its URL.')
}

await startProxyServer({
  config: {
    serviceName: env.SERVICE_NAME ?? 'ChainPe Service',
    serviceDescription: env.SERVICE_DESCRIPTION ?? '',
    tags: [],
    targetUrl: env.TARGET_URL,
    pricePerRequest: env.PRICE ?? '0.02',
    paymentToken: 'USDC',
    walletAddress: env.WALLET_ADDRESS,
    proxyPort: parseInt(env.PORT ?? '4402', 10),
    network: NETWORK,
    facilitatorUrl: env.CHAINPE_FACILITATOR_URL || undefined,
    logLevel: 'normal',
  },
})
