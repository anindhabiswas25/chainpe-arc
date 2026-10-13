# weather-api — a backend to monetize

A zero-dependency Node HTTP server that returns sample weather data. It is the
**backend**: you put the ChainPe x402 proxy in front of it, and agents pay
USDC on Arc Testnet per request.

```bash
node examples/weather-api/server.mjs     # :3001
curl "http://localhost:3001/weather?city=London"
```

## Charge for it (Arc Testnet)

1. Run your facilitator, following [Self-hosting the facilitator](../../apps/landing/content/docs/self-hosting/facilitator.md).
2. Put a proxy in front of the backend. Use either:
   - the CLI: `CHAINPE_FACILITATOR_URL=http://localhost:4500 chainpe init`
     (target `http://localhost:3001`), then `chainpe start`, or
   - the env-configured proxy in [`../proxy-railway`](../proxy-railway)
     (`TARGET_URL=http://localhost:3001`).
3. Call the proxy: `curl -i http://localhost:4402/weather` returns
   `402 Payment Required` with an x402 v2 `PAYMENT-REQUIRED` header: a USDC
   price on Arc Testnet (`eip155:5042002`). Pay it with
   `cp.fetch()` from `@chainpearc/sdk` or `chainpe fetch <url>`.
4. Look up the settlement tx at `https://explorer.testnet.arc.io/tx/<hash>` or in
   the dashboard's `/wallet` page.

The payer needs testnet USDC from [faucet.circle.com](https://faucet.circle.com)
(select Arc Testnet). On Arc, gas is paid in USDC by the facilitator.
