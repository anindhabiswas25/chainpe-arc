---
id: api-reference-facilitator
title: Facilitator API
sidebar_position: 2
---

# Facilitator API

The facilitator is a non-custodial x402 settlement service for USDC on Arc Testnet. It implements the **x402 v2** facilitator HTTP contract (`/verify`, `/settle`, `/supported`) that a provider's payment proxy calls (via `HTTPFacilitatorClient` from `@x402/core`). It settles only Arc USDC (`0x3600…0000`) on `eip155:5042002`.

ChainPe does not run a shared, hosted facilitator. You run your own (see [Self-hosting the facilitator](../self-hosting/facilitator.md)) and point providers at it with `CHAINPE_FACILITATOR_URL`.

**Base URL:** your deployment, e.g. `http://localhost:4500` locally. The examples below use `$CHAINPE_FACILITATOR_URL`:

```bash
export CHAINPE_FACILITATOR_URL=http://localhost:4500
```

---

## GET /

Service info.

```json
{
  "service": "chainpe-facilitator",
  "description": "Non-custodial x402 verify + settle for USDC on Arc Testnet.",
  "network": "arc-testnet",
  "x402Network": "eip155:5042002",
  "x402Version": 2,
  "custodial": false,
  "endpoints": ["/health", "/status", "/supported", "/metrics", "/verify", "/settle"]
}
```

---

## GET /health

Liveness probe. It makes no RPC call and always returns HTTP 200 while the process is up, so a platform health check won't restart the service just because its gas is low. The gas balance comes from a cache that refreshes every 60 seconds.

**Healthy:**
```json
{
  "status": "ok",
  "service": "chainpe-facilitator",
  "network": "arc-testnet",
  "x402Network": "eip155:5042002",
  "facilitator": "0xFACILITATOR_GAS_KEY",
  "custodial": false
}
```

**Low gas** (gas key below `LOW_GAS_THRESHOLD_USDC`, default 0.5 USDC):
```json
{
  "status": "degraded",
  "service": "chainpe-facilitator",
  "network": "arc-testnet",
  "x402Network": "eip155:5042002",
  "facilitator": "0xFACILITATOR_GAS_KEY",
  "custodial": false,
  "warning": "low_gas"
}
```

```bash
curl "$CHAINPE_FACILITATOR_URL/health"
```

---

## GET /status

Operational status. Makes a live RPC call for the gas balance, so poll it sparingly (for example from an alerting job).

```json
{
  "service": "chainpe-facilitator",
  "network": "arc-testnet",
  "x402Network": "eip155:5042002",
  "facilitator": "0xFACILITATOR_GAS_KEY",
  "gasBalanceUsdc": "0.812",
  "lowGasThresholdUsdc": "0.5",
  "lowGas": false
}
```

`gasBalanceUsdc` is the gas key's native balance. On Arc that is USDC (18 decimals at the native level). It reads `"unavailable"` if the RPC call fails. `lowGas` is `true` below `lowGasThresholdUsdc` (set with `LOW_GAS_THRESHOLD_USDC`).

---

## GET /supported

The scheme, network and signer this instance supports (x402 v2 format).

```json
{
  "kinds": [
    { "x402Version": 2, "scheme": "exact", "network": "eip155:5042002" }
  ],
  "extensions": [],
  "signers": { "eip155:*": ["0xFACILITATOR_GAS_KEY"] }
}
```

---

## GET /metrics

Prometheus text-format metrics. Counters reset when the process restarts.

```
# HELP chainpe_verify_total Total /verify requests handled
# TYPE chainpe_verify_total counter
chainpe_verify_total{result="success"} 42
chainpe_verify_total{result="error"} 1
# HELP chainpe_settle_total Total /settle requests handled
# TYPE chainpe_settle_total counter
chainpe_settle_total{result="success"} 40
chainpe_settle_total{result="error"} 2
# HELP chainpe_gas_balance_usdc Gas key balance in USDC (native gas token on Arc)
# TYPE chainpe_gas_balance_usdc gauge
chainpe_gas_balance_usdc{network="eip155:5042002",facilitator="0xYourGasKeyAddress"} 0.312
```

---

## POST /verify

Checks a signed payment against the offer without sending a transaction. Verification uses the upstream x402 `exact` EVM scheme: the EIP-712 signature against USDC's domain, `payTo`, the validity window, the exact amount, and an on-chain simulation of `transferWithAuthorization` (which catches a used nonce or an insufficient balance).

**Rate limit:** 60 requests/minute per IP, shared between `/verify` and `/settle`.

**Request body:**
```ts
interface VerifyRequest {
  x402Version: 2
  paymentPayload: PaymentPayload           // decoded PAYMENT-SIGNATURE header
  paymentRequirements: PaymentRequirements // the accepted offer from PAYMENT-REQUIRED
}
```

`paymentRequirements` (one entry of the 402's `accepts`):
```json
{
  "scheme": "exact",
  "network": "eip155:5042002",
  "asset": "0x3600000000000000000000000000000000000000",
  "amount": "10000",
  "payTo": "0xProviderPayTo",
  "maxTimeoutSeconds": 300,
  "extra": { "name": "USDC", "version": "2" }
}
```

`asset` is the USDC ERC-20 interface on Arc Testnet (6 decimals), so `"10000"` is 0.01 USDC. `extra` carries USDC's EIP-712 domain on Arc (`USDC` / `2`); its hash equals the contract's `DOMAIN_SEPARATOR()`.

`paymentPayload` carries the accepted offer plus the signed authorization:
```json
{
  "x402Version": 2,
  "accepted": { "...": "same as paymentRequirements" },
  "payload": {
    "signature": "0x...",
    "authorization": {
      "from": "0xPayer",
      "to": "0xProviderPayTo",
      "value": "10000",
      "validAfter": "1718000000",
      "validBefore": "1718000300",
      "nonce": "0x1234..."
    }
  }
}
```

**Responses:**
```json
{ "isValid": true, "payer": "0xPayer" }
```
```json
{ "isValid": false, "invalidReason": "invalid_exact_evm_signature", "payer": "0xPayer" }
```
```json
HTTP 400
{ "isValid": false, "invalidReason": "invalid_payload", "invalidMessage": "..." }
```

```bash
curl -X POST "$CHAINPE_FACILITATOR_URL/verify" \
  -H "Content-Type: application/json" \
  -d '{ "x402Version": 2, "paymentPayload": {...}, "paymentRequirements": {...} }'
```

---

## POST /settle

Verifies the payment, then submits `USDC.transferWithAuthorization` on Arc Testnet from the facilitator's gas key. The payer's USDC moves straight to `payTo`, and the facilitator pays only the gas (in USDC).

**Request body:** same as `/verify`.

**Success:**
```json
{
  "success": true,
  "transaction": "0xabc123...",
  "network": "eip155:5042002",
  "payer": "0xPayer"
}
```

**Failure:**
```json
HTTP 400
{
  "success": false,
  "errorReason": "invalid_payload",
  "transaction": "",
  "network": "eip155:5042002"
}
```

Settlement errors use the upstream x402 reason codes in `errorReason`. Unexpected failures return HTTP 500 with `unexpected_settle_error`.

```bash
curl -X POST "$CHAINPE_FACILITATOR_URL/settle" \
  -H "Content-Type: application/json" \
  -d '{ "x402Version": 2, "paymentPayload": {...}, "paymentRequirements": {...} }'
```

Open the returned transaction at `https://explorer.testnet.arc.io/tx/<transaction>`, or paste it into the dashboard's `/wallet` page to decode it.

---

## CORS

Browsers are blocked by default. Server-to-server calls (no `Origin` header) always work. To allow browser origins, set `ALLOWED_ORIGINS` to a comma-separated list.
