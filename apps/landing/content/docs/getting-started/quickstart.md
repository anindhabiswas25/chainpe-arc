---
id: quickstart
title: Quickstart
sidebar_position: 2
---

# Quickstart

Make a USDC micropayment to an x402-protected API on Arc Testnet. You'll run a paid endpoint locally, then pay it from the SDK.

## Prerequisites

- Node.js 18+
- The ChainPe packages built from the repo. See [Installation](./installation.md); the `@chainpearc/*` packages aren't on npm yet.
- Two fresh test wallets:
  - a **payer** key (`CHAINPE_PRIVATE_KEY`)
  - a **facilitator gas key** (`FACILITATOR_PRIVATE_KEY`)
- Testnet USDC in both, from [faucet.circle.com](https://faucet.circle.com/) (select **Arc Testnet**). The payer spends USDC on calls. The facilitator spends USDC on gas, because [USDC is the gas token on Arc](https://docs.arc.io/arc/concepts/stable-fee-design). The payer never pays gas for x402 calls.

Use throwaway testnet keys only.

## Step 1 — Run a facilitator

The facilitator verifies signed payments and settles them on Arc Testnet. Run your own (full guide: [Self-hosting the facilitator](../self-hosting/facilitator.md)):

```bash
cd services/chainpe-facilitator
cp .env.example .env            # set FACILITATOR_PRIVATE_KEY
npm install && npm run build && npm start        # :4500
curl http://localhost:4500/health
```

## Step 2 — Run a paid endpoint

Start a sample backend and put the ChainPe x402 proxy in front of it:

```bash
# terminal 2: the backend
node examples/weather-api/server.mjs             # :3001

# terminal 3: the x402 proxy (USDC on arc-testnet)
cd examples/proxy-railway && npm install
TARGET_URL=http://localhost:3001 \
WALLET_ADDRESS=0xYOUR_PROVIDER_ADDRESS \
CHAINPE_FACILITATOR_URL=http://localhost:4500 \
PRICE=0.01 npm start                             # :4402

curl -i "http://localhost:4402/weather?city=London"   # → 402 Payment Required
```

`WALLET_ADDRESS` receives the payments. Use any address you control other than the payer.

## Step 3 — Create a ChainPe client

```ts
import { ChainPe } from '@chainpearc/sdk'

const cp = new ChainPe({
  privateKey: process.env.CHAINPE_PRIVATE_KEY!,
  network: 'arc-testnet',   // the only supported network (and the default)
  maxPerCall: '0.10'        // refuse to auto-pay more than 0.10 USDC per call
})

console.log('Paying from:', cp.getAddress())
const { usdc } = await cp.balance()
console.log(`Balance: ${usdc} USDC`)
```

## Step 4 — Make a paid call

```ts
const result = await cp.pay('http://localhost:4402/weather?city=London')

console.log('Status:', result.status)   // 200
console.log('Data:', result.data)
if (result.payment) {
  console.log('Paid:', result.payment.amount, 'USDC to', result.payment.recipient)
  console.log('Tx:', `https://explorer.testnet.arc.io/tx/${result.payment.txHash}`)
}
```

`cp.fetch(url)` does the same thing but returns a plain `Response`. On a `402`, the SDK:

1. decodes the `PAYMENT-REQUIRED` header (price, `payTo`, USDC asset, network `eip155:5042002`)
2. checks it against `maxPerCall`
3. signs a USDC `transferWithAuthorization` (EIP-3009). This is a signature, not a transaction.
4. retries with the `PAYMENT-SIGNATURE` header. The proxy has your facilitator verify and settle on-chain, then returns the response with `PAYMENT-RESPONSE`.

## Step 5 — Check the settlement

Open the tx hash in the Arc Testnet explorer (`https://explorer.testnet.arc.io/tx/<hash>`), or paste it into the dashboard's `/wallet` page. You'll see USDC move from the payer to `WALLET_ADDRESS`, submitted (and gas paid) by the facilitator.

## Step 6 — Discover registered services (optional)

Discovery reads the live ChainPeRegistry (`0x79c7a22993A40A3c88355b737e6F608c6610c395`) and ranks services by their ERC-8004 reputation. No extra configuration is needed:

```ts
for (const svc of await cp.discover({ maxPrice: '0.05' })) {
  console.log(`${svc.name} — ${svc.pricePerRequest} USDC — ${svc.endpoint}`)
}
```

To list your own API, use the CLI: `chainpe init`, then `chainpe start`, then `chainpe register`. See [Merchant Registration](../merchants/registration.md).

## Troubleshooting

**`402` again after paying.** The facilitator could not settle. Check `curl $CHAINPE_FACILITATOR_URL/health` and `/status` (`lowGas`), and make sure the payer has USDC on Arc Testnet.

**`payment of X USDC exceeds maxPerCall`.** Raise `maxPerCall`, or the endpoint costs more than you expected.

**`could not settle (invalid_exact_evm_insufficient_balance)`.** The payer holds less USDC than the price. Fund it at [faucet.circle.com](https://faucet.circle.com/) (Arc Testnet).

**`Invalid ChainPeRegistry address on Arc Testnet`.** `CHAINPE_REGISTRY_ADDRESS` (or `registryAddress`) is set to something that is not an address. Unset it to use the live registry.

**`failed to sign payment`.** `CHAINPE_PRIVATE_KEY` must be a 0x-prefixed, 64-hex-character key.

More in [Common Issues](../troubleshooting/common-issues.md).
