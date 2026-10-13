---
title: Self-hosting the facilitator
description: Run your own non-custodial x402 facilitator for USDC on Arc Testnet.
---

# Self-hosting the facilitator

A provider's x402 proxy needs a **facilitator**: a small HTTP service that verifies the payer's signed USDC authorization and submits it on-chain. ChainPe does not run a shared facilitator. You run one (`services/chainpe-facilitator`) and point your providers at it with `CHAINPE_FACILITATOR_URL`.

The facilitator is **non-custodial**. Its key only pays settlement gas and relays the payer's signed EIP-3009 `transferWithAuthorization`. USDC moves directly from the payer to the provider's `payTo` address. The facilitator never holds user funds and cannot move funds the payer didn't authorize. If the key leaks, an attacker can spend its gas balance, but user funds stay safe.

## 1. Create and fund a gas key

- Generate a **dedicated** EOA for the facilitator. Don't reuse a key that holds other funds.
- Fund it with testnet USDC from the [Circle faucet](https://faucet.circle.com) (select **Arc Testnet**). On Arc, [gas is paid in USDC](https://docs.arc.io/arc/concepts/stable-fee-design), so USDC is all the key needs. Each settlement costs a small amount of USDC gas. Watch `/status` and top up as needed.

## 2. Configure

```bash
cd services/chainpe-facilitator
cp .env.example .env
```

| Variable | Default | Notes |
|---|---|---|
| `FACILITATOR_PRIVATE_KEY` | — | **Required.** The gas key from step 1. Keep it in your platform's secret store and never commit it. |
| `NETWORK` | `arc-testnet` | `arc-testnet` or `eip155:5042002`. Any other value stops the service on start. |
| `LOW_GAS_THRESHOLD_USDC` | `0.5` | `/health` reports `degraded` and `/status` sets `lowGas` below this balance. |
| `ARC_RPC_URL` | `https://rpc.testnet.arc.io` | Optional RPC override (`RPC_URL` is also accepted). |
| `PORT` | `4500` | Most platforms inject this. |
| `ALLOWED_ORIGINS` | *(empty)* | Comma-separated browser origins for CORS. Empty means no browser access. Server-to-server calls always work. |
| `LOG_LEVEL` | `info` | pino log level. |

## 3. Run

### Node

```bash
npm install
npm run build
npm start                  # listens on :4500
```

### Docker

```bash
# from the repo root (the image bundles packages/chainpe-sdk/src/arc.ts)
docker build -f services/chainpe-facilitator/Dockerfile -t chainpe-facilitator .
docker run --env-file services/chainpe-facilitator/.env -p 4500:4500 chainpe-facilitator
```

### Railway (optional)

`services/chainpe-facilitator` ships a `railway.json` (Dockerfile build plus a `/health` health check):

```bash
# from the repo root: leave Railway's Root Directory empty
railway init
railway variables --set FACILITATOR_PRIVATE_KEY=0xYOUR_GAS_KEY
RAILWAY_CONFIG_FILE=services/chainpe-facilitator/railway.json railway up
railway domain             # public https URL
```

Any host that runs a Docker image or Node 18+ works the same way.

## 4. Verify

```bash
export CHAINPE_FACILITATOR_URL=http://localhost:4500   # or your public URL
curl "$CHAINPE_FACILITATOR_URL/health"      # { "status": "ok", "custodial": false, ... }
curl "$CHAINPE_FACILITATOR_URL/supported"   # x402 v2, exact / eip155:5042002
curl "$CHAINPE_FACILITATOR_URL/status"      # gasBalanceUsdc + lowGas
```

## 5. Point providers at it

**ChainPe CLI proxy.** `chainpe init` reads `CHAINPE_FACILITATOR_URL` (or asks for it) and saves it as `facilitatorUrl` in `~/.chainpe/config.json`. `chainpe start` uses `facilitatorUrl`, falling back to `CHAINPE_FACILITATOR_URL`.

```bash
export CHAINPE_FACILITATOR_URL=https://facilitator.example.com
chainpe init
chainpe start
```

To switch facilitators later, edit `facilitatorUrl` (or clear it and set the env var).

**Standalone proxy example.** `examples/proxy-railway` reads `CHAINPE_FACILITATOR_URL` from its environment.

**Local development without a separate service.** `chainpe start --facilitator <gasKey>` mounts the same verify/settle logic inside the proxy process.

## Operating notes

- **Liveness:** `/health` makes no RPC call and always returns 200. When gas falls below `LOW_GAS_THRESHOLD_USDC` it reports `"status": "degraded"` and `"warning": "low_gas"` rather than failing, so health checks don't restart the service in a loop.
- **Gas alerts:** poll `/status` and alert when `lowGas` is `true`, or scrape `/metrics` (`chainpe_gas_balance_native`).
- **One network per instance:** each instance serves Arc Testnet only.
- **Explorer:** every settlement is a normal Arc transaction. Open it at `https://explorer.testnet.arc.io/tx/<hash>`, or decode it in the dashboard's `/wallet` page.

See the [Facilitator API](../api-reference/facilitator.md) for request and response formats.
