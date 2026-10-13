# proxy-railway — env-configured x402 proxy

Wraps any HTTP backend in a USDC paywall on Arc Testnet. It runs the same proxy
as `chainpe start` (via `startProxyServer` from `@chainpearc/cli`), configured only
through environment variables, so you can deploy it to Railway, Docker or any
Node host without an interactive `chainpe init`.

## Run locally

```bash
# once, from the repo root: build the local packages
npm install && npm run build

cd examples/proxy-railway
npm install
cp .env.example .env          # set WALLET_ADDRESS and CHAINPE_FACILITATOR_URL
set -a; . ./.env; set +a
npm start                     # :4402
```

You'll need two more processes running:

- a backend, e.g. `node examples/weather-api/server.mjs` (port 3001)
- your facilitator, see [Self-hosting the facilitator](../../apps/landing/content/docs/self-hosting/facilitator.md)

```bash
curl -i http://localhost:4402/weather?city=London   # → 402 + PAYMENT-REQUIRED (x402 v2, USDC on eip155:5042002)
```

Pay it with the SDK (`cp.fetch(url)`) or `chainpe fetch <url>`.

## Env

| Var | Required | Notes |
|---|---|---|
| `TARGET_URL` | yes | Backend to proxy |
| `WALLET_ADDRESS` | yes | Receives the USDC |
| `CHAINPE_FACILITATOR_URL` | to settle | Your self-hosted facilitator |
| `PRICE` | no | USDC per request (default `0.02`) |
| `SERVICE_NAME`, `SERVICE_DESCRIPTION` | no | Shown on the 402 |
| `CHAINPE_AGENT_ID` | no | ERC-8004 agent id advertised on 402s |
| `NETWORK` | no | `arc-testnet` (the only supported value) |
| `PORT` | no | Default `4402` |

`@chainpearc/cli` is linked from `packages/chainpe`, so build it before
`npm install`. Once the package is on npm, swap the `file:` dependency for a
version range.
