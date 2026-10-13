# Deploying the ChainPe facilitator (public URL)

The facilitator is a stateless HTTP service. Integrators point their provider
proxy at it via `CHAINPE_FACILITATOR_URL`. It is **non-custodial**: its key only
pays settlement gas and relays the payer's signed authorization.

## Prerequisites

- A dedicated EOA as the **gas key** (`FACILITATOR_PRIVATE_KEY`). Do **not** reuse
  a key that holds user funds.
- Fund it with **testnet USDC** (USDC is the gas token on Arc) from
  <https://faucet.circle.com>, choosing Arc Testnet. A settlement
  (`transferWithAuthorization`) costs a few thousandths of a USDC at Arc's
  20 gwei minimum base fee. Watch `/status` and top up.

## Docker (any host)

```bash
# from the repo root
docker build -f services/chainpe-facilitator/Dockerfile -t chainpe-facilitator .
docker run -d --name chainpe-facilitator --restart unless-stopped \
  -p 4500:4500 \
  -e FACILITATOR_PRIVATE_KEY=0x... \
  -e ALLOWED_ORIGINS=https://your-dashboard.example \
  chainpe-facilitator
```

## Railway

`railway.json` builds with the Dockerfile and health-checks `/health`. Because
the image needs `packages/chainpe-sdk/src/arc.ts`, the service must build from
the **repo root**:

1. New Project → Deploy from GitHub repo. Leave **Root Directory** empty (repo
   root) and set **Config file path** to `services/chainpe-facilitator/railway.json`.
2. Variables: `FACILITATOR_PRIVATE_KEY` (and optionally `ARC_RPC_URL`,
   `ALLOWED_ORIGINS`, `LOW_GAS_THRESHOLD_USDC`). Railway injects `PORT`.
3. Networking → **Generate Domain**.

CLI equivalent, run from the repo root:

```bash
railway init
railway variables --set FACILITATOR_PRIVATE_KEY=0x...
RAILWAY_CONFIG_FILE=services/chainpe-facilitator/railway.json railway up
railway domain
```

## Verify

```bash
curl https://<your-domain>/health      # { status: "ok", custodial: false, x402Network: "eip155:5042002" }
curl https://<your-domain>/supported   # exact / eip155:5042002, x402Version 2
curl https://<your-domain>/status      # gasBalanceUsdc + lowGas
```

Then point a provider at it:

```bash
export CHAINPE_FACILITATOR_URL=https://<your-domain>
chainpe start
```

## Operating notes

- **Liveness:** `/health` reads only the cached balance (refreshed every 60 s), so it's safe for health checks.
- **Gas monitoring:** alert on `/status` → `lowGas: true` or the `chainpe_gas_balance_usdc` metric.
- **Scaling:** settle retries are de-duplicated in memory per instance. Run a single instance, or add a shared `PendingSettlementStore` before scaling out.
- **Security:** keep the key only in the platform secret store; never commit it.
