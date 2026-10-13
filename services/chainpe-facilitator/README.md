# ChainPe Facilitator

A standalone, **non-custodial** [x402](https://x402.org) v2 facilitator for USDC
payments on **Arc Testnet** (x402 network `eip155:5042002`). It verifies
payment authorizations and settles them on-chain (paying the gas), so ChainPe
providers don't have to run their own.

## Why x402 v2

`x402@1.x` hardcodes its networks in a zod enum and has no Arc entry, so it
rejects Arc at runtime. `@x402/core` + `@x402/evm` (v2) ship Arc Testnet and its
USDC EIP-712 domain (`USDC` / `2`) built in, use CAIP-2 network ids, and
interoperate with any stock x402 v2 client. Verification is the upstream
`exact` scheme: EIP-712 signature against the token domain, `payTo`,
`validAfter`/`validBefore`, the exact amount, and an on-chain simulation of
`transferWithAuthorization` (which catches a used nonce and an insufficient
balance). ChainPe adds one rule on top: **only Arc USDC**
(`0x3600…0000`) on `eip155:5042002` is accepted.

## Non-custodial by design

The facilitator key **only pays gas and relays the payer's already-signed
EIP-3009 `transferWithAuthorization`**. It never holds user funds and cannot
move money the payer did not authorize. If the key leaks, an attacker can only
burn its gas balance. Gas on Arc is USDC, so fund the key with a small amount of
testnet USDC and nothing else.

## Endpoints (x402 v2 facilitator contract)

| Method | Path | Purpose |
|---|---|---|
| GET | `/supported` | `{ kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:5042002" }], signers }` |
| POST | `/verify` | body `{ x402Version: 2, paymentPayload, paymentRequirements }` → `{ isValid, invalidReason?, payer? }` |
| POST | `/settle` | same body → `{ success, transaction, network, payer?, errorReason? }` |
| GET | `/health` | Liveness (no RPC); `degraded` + `warning: "low_gas"` when the cached gas balance is low |
| GET | `/status` | Live gas balance in USDC |
| GET | `/metrics` | Prometheus counters + gas gauge |

Malformed bodies get `400` with `invalidReason`/`errorReason` `invalid_payload`.
`/verify` and `/settle` are rate-limited (60/min per IP); CORS denies browsers
unless `ALLOWED_ORIGINS` is set.

## Run locally

```bash
cp .env.example .env   # set FACILITATOR_PRIVATE_KEY (a gas wallet funded with testnet USDC)
npm install
npm run dev            # or: npm run build && npm start   → listens on :4500
curl localhost:4500/supported
```

## Run with Docker

The image is built from the **repo root**, because it bundles the shared Arc
constants from `packages/chainpe-sdk/src/arc.ts`:

```bash
docker build -f services/chainpe-facilitator/Dockerfile -t chainpe-facilitator .
docker run --rm -p 4500:4500 -e FACILITATOR_PRIVATE_KEY=0x... chainpe-facilitator
```

## Point clients at it

```bash
export CHAINPE_FACILITATOR_URL=http://localhost:4500
chainpe start          # the provider proxy now verifies + settles here
```

See [DEPLOY.md](./DEPLOY.md) for Railway.

## Env

| Var | Default | Notes |
|---|---|---|
| `FACILITATOR_PRIVATE_KEY` | — | required; gas-paying settlement key |
| `ARC_RPC_URL` | `https://rpc.testnet.arc.io` | optional (`RPC_URL` also accepted); startup fails if the chain id isn't 5042002 |
| `PORT` | `4500` | Railway injects this |
| `ALLOWED_ORIGINS` | empty (deny) | comma-separated CORS allowlist |
| `LOW_GAS_THRESHOLD_USDC` | `0.5` | below this `/health` is `degraded` |
| `LOG_LEVEL` | `info` | pino level |

## Tests

`npm test` runs the HTTP contract against an in-memory Arc USDC (real ECDSA
recovery, nonce and balance state) with payloads signed by the stock
`@x402/evm` client: valid payment, bad signature, expired authorization,
underpayment, wrong `payTo`, insufficient balance, non-USDC asset, a full settle,
and a replayed nonce.
