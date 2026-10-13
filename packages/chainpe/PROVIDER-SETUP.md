# ChainPe provider setup

**Monetize an HTTP API with x402 payments and earn USDC on every call, on Arc Testnet.**

This walks through the whole provider path: facilitator, proxy, registration and
a first paid request. Every command below was run against the live Arc Testnet
deployment.

## What you need

- Node.js 18+
- A wallet **address** to receive payments. The proxy never needs its private key.
- A little testnet USDC from <https://faucet.circle.com> (select Arc Testnet):
  about 0.5 USDC for the facilitator's gas key and 1.1 USDC in the provider
  wallet if you register on-chain. USDC is also the gas token on Arc, so it is
  the only asset involved.

## 1. Install the CLI

```bash
npm install -g @chainpearc/cli
```

> `@chainpearc/*` is not published to npm yet. Until it is, build this repo (`npm install && npm run build`) and install by path: `npm install -g /path/to/ChainPe/packages/chainpe`.

## 2. Run a facilitator

The proxy needs a facilitator to verify and settle payments. ChainPe does not
host one; run your own:

```bash
cd services/chainpe-facilitator
cp .env.example .env      # FACILITATOR_PRIVATE_KEY = a dedicated gas key holding a little USDC
npm install && npm run build && npm start      # http://localhost:4500
curl http://localhost:4500/health              # "status":"ok" once the gas key is funded
export CHAINPE_FACILITATOR_URL=http://localhost:4500
```

To deploy it publicly see [`services/chainpe-facilitator/DEPLOY.md`](../../services/chainpe-facilitator/DEPLOY.md).
For a quick local test you can skip this step and run
`chainpe start --facilitator 0xGAS_KEY`, which settles in-process.

## 3. Configure

```bash
chainpe init
```

```
◆  Your API URL (the backend ChainPe will proxy)      http://localhost:3001
◆  Service name (for registry listing)                Weather API
◆  Service description                                Real-time weather data
◆  Tags (comma-separated, for discovery)              weather, data
◆  Price per request (USDC)                           0.01
◆  Network                                            Arc Testnet
◆  Your wallet address (0x…, receives payments)       0xYourPayToAddress
◆  Proxy port                                         4402
◆  x402 facilitator URL                               http://localhost:4500
```

This writes `~/.chainpe/config.json`:

```json
{
  "serviceName": "Weather API",
  "serviceDescription": "Real-time weather data",
  "tags": ["weather", "data"],
  "targetUrl": "http://localhost:3001",
  "pricePerRequest": "0.01",
  "paymentToken": "USDC",
  "walletAddress": "0xYOUR_WALLET_ADDRESS",
  "proxyPort": 4402,
  "network": "arc-testnet",
  "facilitatorUrl": "http://localhost:4500",
  "logLevel": "normal"
}
```

| Field | Description |
|-------|-------------|
| `serviceName`, `serviceDescription`, `tags` | What agents see when they discover you |
| `targetUrl` | Your backend API |
| `pricePerRequest` | Price in USDC (human units) |
| `walletAddress` | Address that receives the USDC |
| `proxyPort` | Port of the payment proxy |
| `network` | `arc-testnet` (the only supported network) |
| `facilitatorUrl` | Your facilitator; falls back to `CHAINPE_FACILITATOR_URL` |
| `registryAddress` | Optional. Defaults to the live registry `0x79c7a22993A40A3c88355b737e6F608c6610c395` |
| `agentId` | ERC-8004 identity, saved by `chainpe register` |
| `adminKey` | Optional. Protects `/chainpe-admin/*` with an `x-admin-key` header |
| `logLevel` | `verbose`, `normal` or `quiet` |

## 4. Start your backend and the proxy

Any HTTP backend works. The repo ships a zero-dependency one:

```bash
node examples/weather-api/server.mjs      # :3001
chainpe start                              # :4402
```

```
  Configuration:
    Service:  Weather API
    Target:   http://localhost:3001
    Price:    0.01 USDC
    Wallet:   0xAbCd…57A4
    Network:  arc-testnet
    Facilitator: http://localhost:4500

● Using external facilitator: http://localhost:4500
● Configured x402 routes:
●   /* → $0.01 USDC
◆ ChainPe proxy started
   ● Listening on: http://localhost:4402
```

Check the gate:

```bash
curl -i "http://localhost:4402/weather?city=London"
# HTTP/1.1 402 Payment Required
# PAYMENT-REQUIRED: <base64 JSON: x402Version 2, network eip155:5042002, amount, payTo, …>
```

`GET /health` on the proxy is free. `/chainpe-admin/stats` and
`/chainpe-admin/payments` report request and revenue counters.

## 5. Register on-chain

```bash
chainpe register
```

You are asked for the public endpoint agents should call and how to sign:

- **Browser wallet (MetaMask):** approve the fee and the registration in the
  page that opens.
- **Paste private key:** signs in the terminal and also mints an ERC-8004
  identity for the wallet (the proxy then advertises it in the
  `X-CHAINPE-AGENT-ID` header so buyers can rate you).

Registration costs **1 USDC** plus gas. Afterwards:

```bash
chainpe status      # config, USDC balance, "✓ registered"
chainpe list        # every service on the registry
chainpe discover weather
```

`chainpe register` on an existing listing updates it; `chainpe deregister`
removes it.

## 6. Make a paid call

From any wallet holding a little USDC:

```bash
CHAINPE_PRIVATE_KEY=0xBUYER_KEY chainpe fetch --feedback "http://localhost:4402/weather?city=London"
```

```
  ✓ 200
    Paid:     0.01 USDC → 0xAbCd…57A4 on arc-testnet
    Tx:       https://explorer.testnet.arc.io/tx/0x…
    Rated:    agent 897287 +100 (ERC-8004)
```

The USDC is in your wallet as soon as that transaction confirms.

## How the payment works

1. The client calls your endpoint; the proxy answers `402` with a
   `PAYMENT-REQUIRED` header (x402 v2).
2. The client signs a USDC EIP-3009 `transferWithAuthorization` and retries with
   a `PAYMENT-SIGNATURE` header.
3. The proxy asks the facilitator to `/verify` and `/settle`. The facilitator
   submits the transfer on Arc Testnet and pays the gas.
4. The proxy forwards the request to your backend and returns its response with
   a `PAYMENT-RESPONSE` header carrying the settlement transaction.

Funds move directly from the payer to your wallet. Neither the proxy nor the
facilitator ever holds them.

## Per-route prices

The CLI charges one price for every path. To price paths differently, start the
proxy from code and pass `additionalRoutes`:

```ts
import { startProxyServer } from '@chainpearc/cli'

await startProxyServer({
  config: {
    serviceName: 'Financial Data API', serviceDescription: 'Quotes and news', tags: ['finance'],
    targetUrl: 'http://localhost:3001',
    pricePerRequest: '0.10', paymentToken: 'USDC',     // default for every other path
    walletAddress: process.env.WALLET_ADDRESS!,
    proxyPort: 4402, network: 'arc-testnet',
    facilitatorUrl: process.env.CHAINPE_FACILITATOR_URL
  },
  additionalRoutes: [
    { path: '/news', pricePerRequest: '0.03', paymentToken: 'USDC' },
    { path: '/analytics', pricePerRequest: '0.15', paymentToken: 'USDC' }
  ]
})
```

[`examples/proxy-railway`](../../examples/proxy-railway) is an env-configured
version of this, ready to deploy.

## Security

- The proxy holds no keys and signs nothing. Payments settle straight to your wallet.
- Use a dedicated receiving address and a separate, lightly funded facilitator gas key.
- Rate-limit and validate inputs in your backend as you would without ChainPe.
- Serve the proxy over HTTPS in production.

## Going live

- [ ] Run the facilitator publicly, set `facilitatorUrl`, and alert on `/status` → `lowGas`
- [ ] Put the proxy behind HTTPS and register its public URL (`chainpe register`)
- [ ] Set `ARC_RPC_URL` to a dedicated RPC if you outgrow the public one (it rate-limits bursts)
- [ ] Remember this is a testnet: Arc Testnet is the only supported network

Run it under any process manager, for example:

```ini
[Unit]
Description=ChainPe x402 gateway

[Service]
Environment=CHAINPE_FACILITATOR_URL=https://facilitator.example.com
ExecStart=/usr/local/bin/chainpe start
Restart=always

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Proxy returns 502 / cannot reach backend | Check `targetUrl`; test the backend directly with `curl` |
| `EADDRINUSE` | Change `proxyPort` or run `chainpe start -p <port>` |
| Client gets `could not settle (invalid_exact_evm_insufficient_balance)` | The paying wallet lacks USDC; fund it at <https://faucet.circle.com> |
| Facilitator `/health` says `degraded` / `low_gas` | Top up the gas key shown in `/status` with USDC |
| `chainpe register` fails with insufficient funds | The signing wallet needs 1 USDC for the fee plus a few cents of gas |
| Service not discoverable | `chainpe status` should say `✓ registered`; `chainpe list` shows the registry |
