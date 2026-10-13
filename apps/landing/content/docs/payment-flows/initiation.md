---
id: payment-initiation
title: Payment Initiation
sidebar_position: 2
---

# Payment Initiation

The initiation phase covers everything from the agent's first request to the moment it signs the USDC authorization.

## Initial request

The agent sends a standard HTTP request with no payment header:

```http
GET /api/data HTTP/1.1
Host: api.example.com
Accept: application/json
```

## Server response: 402

The x402-protected endpoint returns `402 Payment Required` with a `PAYMENT-REQUIRED` header: base64 JSON listing what it accepts.

```json
{
  "x402Version": 2,
  "resource": { "url": "https://api.example.com/api/data", "description": "Weather data, per query" },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:5042002",
      "asset": "0x3600000000000000000000000000000000000000",
      "amount": "10000",
      "payTo": "0xProviderWalletAddress",
      "maxTimeoutSeconds": 300,
      "extra": { "name": "USDC", "version": "2", "agentId": "42" }
    }
  ]
}
```

ChainPe's proxy also sets `X-CHAINPE-AGENT-ID` with the provider's ERC-8004 agent id, so the SDK can post feedback without a registry scan.

## Offer selection

The SDK keeps only offers for Arc Testnet (`eip155:5042002`) paid in Arc USDC. If none match, it throws `x402: server accepts [...] but wallet is on arc-testnet (eip155:5042002, USDC)`.

## maxPerCall guard

Before signing, the SDK checks the offer's `amount` against `maxPerCall`, and the x402 client enforces the same cap again:

```ts
const required = BigInt(accept.amount)
if (required > this.maxPerCallAtomic) {
  throw new ChainPePaymentError(`x402: payment of ${formatUnits(required, 6)} USDC exceeds maxPerCall ...`)
}
```

This prevents unexpected spend if a service raises its price.

## Signing the EIP-3009 authorization

The SDK signs (off-chain, EIP-712, USDC domain `USDC` / `2` on chain 5042002) a `TransferWithAuthorization` message:

```ts
{
  from: agentWallet,        // who authorizes the transfer
  to: accept.payTo,         // provider's wallet
  value: accept.amount,     // exact amount
  validAfter,               // now (minus a small clock-skew margin)
  validBefore,              // now + maxTimeoutSeconds
  nonce: randomBytes32()    // single-use
}
```

The private key never leaves the agent's process. The signature authorizes exactly this amount to exactly this recipient, so the facilitator cannot redirect funds.

## The PAYMENT-SIGNATURE header

The signed payload is base64-encoded into the `PAYMENT-SIGNATURE` request header, and the SDK retries the original request:

```http
GET /api/data HTTP/1.1
Host: api.example.com
PAYMENT-SIGNATURE: <base64-encoded signed x402 payload>
```

## Timeout behavior

Each request has a configurable timeout (default: 30 seconds). The SDK wraps each `fetch` call with an `AbortController`:

```ts
const ctrl = new AbortController()
const timer = setTimeout(() => ctrl.abort(), timeout)
fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer))
```

Pass `timeout` in `FetchOptions` to override per-request.
