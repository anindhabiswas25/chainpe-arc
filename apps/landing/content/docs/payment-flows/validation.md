---
id: payment-validation
title: Payment Validation
sidebar_position: 3
---

# Payment Validation

After the proxy receives a request with a `PAYMENT-SIGNATURE` header, it calls the facilitator's `/verify` endpoint, then `/settle`.

## Verify endpoint

```
POST $CHAINPE_FACILITATOR_URL/verify
Content-Type: application/json

{
  "x402Version": 2,
  "paymentPayload": { ... signed x402 payload ... },
  "paymentRequirements": { ... the accepted offer from PAYMENT-REQUIRED ... }
}
```

### What verify checks

The facilitator runs the upstream x402 v2 `exact` EVM scheme (`@x402/evm`), plus one ChainPe rule:

1. **Request shape**: the body must parse as an x402 v2 verify request (`invalid_payload` otherwise)
2. **ChainPe rule**: only Arc USDC (`0x3600…0000`) on `eip155:5042002` is accepted
3. **Scheme / network**: `exact` on the offer's network
4. **Recipient and amount**: `authorization.to` must equal `payTo`, and `value` must equal `amount`
5. **Validity window**: `validAfter` / `validBefore` must bracket the current time
6. **Signature**: the EIP-712 signature must recover `authorization.from` under USDC's domain (`USDC` / `2`, chain 5042002)
7. **Simulation**: an on-chain simulation of `transferWithAuthorization` catches a used nonce and an insufficient balance

### Response

```json
{ "isValid": true, "payer": "0xPayer" }
```

Or on failure:
```json
{ "isValid": false, "invalidReason": "invalid_exact_evm_signature", "payer": "0xPayer" }
```

Other reasons include `invalid_exact_evm_insufficient_balance`, `invalid_exact_evm_nonce_already_used`, `invalid_exact_evm_recipient_mismatch` and `invalid_exact_evm_payload_authorization_valid_before`.

## On-chain verification (USDC contract)

The final verification happens on-chain when the facilitator calls `transferWithAuthorization`. The USDC contract independently verifies:

1. The EIP-3009 signature (using `ecrecover`)
2. That `from` has sufficient USDC balance
3. That `validAfter <= block.timestamp < validBefore`
4. That the nonce has not been used (the USDC contract maintains a bitmap of used authorization nonces)

If any of these fail, the `transferWithAuthorization` call reverts and the settlement fails. The proxy then returns `402` again instead of the content, and the SDK surfaces it as a `ChainPePaymentError`.
