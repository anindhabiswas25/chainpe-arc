---
id: payment-settlement
title: Payment Settlement
sidebar_position: 4
---

# Payment Settlement

Settlement is the on-chain phase where USDC moves from the agent's wallet to the provider's wallet. It happens in a single Arc Testnet transaction submitted by the facilitator.

## Settle endpoint

```
POST $CHAINPE_FACILITATOR_URL/settle
Content-Type: application/json

{
  "x402Version": 2,
  "paymentPayload": { ... signed x402 payload ... },
  "paymentRequirements": { ... offer from 402 ... }
}
```

## What happens on-chain

The facilitator calls `USDC.transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)` where:

- `from` = agent's wallet address
- `to` = provider's `payTo` address (from the `accepts` offer)
- `value` = the exact amount in atomic units (e.g. `10000` for 0.01 USDC, 6 decimals)
- `validAfter` / `validBefore` = validity window from the signed authorization
- `nonce` = the random bytes32 from the signed authorization
- `v, r, s` = the agent's EIP-3009 signature

The USDC contract supports EIP-3009 (`transferWithAuthorization`). Its EIP-712 domain on Arc Testnet is `name: "USDC"`, `version: "2"`, `chainId: 5042002`, `verifyingContract: 0x3600000000000000000000000000000000000000`. You can check this: the hash of that domain equals the contract's `DOMAIN_SEPARATOR()`.

## Gas

The facilitator's key pays all gas, in USDC (Arc's gas token). The agent needs only the USDC it pays with.

## Settlement response

```json
{
  "success": true,
  "transaction": "0xabc123def456...",
  "network": "eip155:5042002",
  "payer": "0xPayer"
}
```

The proxy attaches the settlement result (base64 JSON) in the `PAYMENT-RESPONSE` header:

```
PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJ0cmFuc2FjdGlvbiI6IjB4YWJjLi4uIn0=
```

## PolicyVault settlement

When using a PolicyVault, settlement is different:

1. The agent signs an EIP-712 `Spend` authorization off-chain
2. A relayer calls `PolicyVault.spend(owner, to, amount, deadline, sig)`
3. The contract verifies the session signature and all policy constraints
4. The contract calls `USDC.safeTransfer(to, amount)` directly from the vault balance

The vault holds USDC on-chain (deposited by the owner via `deposit()`). No EIP-3009 is involved — the vault itself owns the USDC and transfers it directly.

## Prometheus metrics

The facilitator exposes settlement counters at `/metrics`:

```
chainpe_settle_total{result="success"} 42
chainpe_settle_total{result="error"} 1
chainpe_gas_balance_native{network="arc-testnet",facilitator="0x8cC8..."} 0.312
```

Monitor these to track settlement health and gas balance.
