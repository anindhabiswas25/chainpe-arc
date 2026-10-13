---
id: common-issues
title: Common Issues
sidebar_position: 2
---

# Common Issues

## 1. Wrong chain

**Symptoms**
- The SDK error says `server accepts [...] but wallet is on arc-testnet`: the endpoint offers no `eip155:5042002` USDC option.
- MetaMask shows a different network, or the dashboard shows a "Wrong network" banner.
- `NETWORK` or `CHAINPE_NETWORK` is set to anything other than `arc-testnet`. The facilitator, indexer and proxies exit on start in that case.

**Fixes**
- ChainPe supports exactly one network: **Arc Testnet**, network id `arc-testnet`, chain id `5042002` (`0x4cef52`).
- In the SDK, omit `network` or pass `network: 'arc-testnet'`. In `~/.chainpe/config.json`, `"network": "arc-testnet"`.
- To add the network to a wallet manually:

  | Field | Value |
  |---|---|
  | Network name | Arc Testnet |
  | RPC URL | `https://rpc.testnet.arc.io` |
  | Chain ID | `5042002` |
  | Currency symbol | `USDC` (18 decimals at the native level) |
  | Explorer | `https://explorer.testnet.arc.io` |

  The dashboard's `/wallet` page does this for you with **Switch to Arc Testnet**. It calls `wallet_addEthereumChain` when the wallet doesn't know the chain yet.

---

## 2. No USDC for gas

**Symptoms**: `insufficient funds for gas`, a transaction that never gets sent, or a facilitator whose `/health` shows `"status": "degraded"` with `"warning": "low_gas"`.

On Arc, **gas is paid in USDC**. There is no second coin to buy. A wallet's native balance (18 decimals) and its USDC ERC-20 balance (`0x3600…0000`, 6 decimals) are the **same funds**, so topping up USDC tops up gas.

**Who needs USDC, and for what?**

| Wallet | Needs USDC for |
|---|---|
| Payer / agent (x402 calls) | The payments only. The facilitator pays the gas. |
| Facilitator gas key | Gas for every settlement |
| Provider registering a service | The registration fee plus gas for `approve` and `register` (and the ERC-8004 identity mint) |
| PolicyVault relayer | Gas for `spend()` |

**Fix**: get testnet USDC from [faucet.circle.com](https://faucet.circle.com/) (select **Arc Testnet**) and send it to the wallet that is short. Check balances with `cp.balance()`, `chainpe status`, the dashboard's `/wallet` page, or the facilitator's `/status`.

---

## 3. Facilitator unreachable

**Symptoms**: the provider proxy logs `No facilitator configured` or fetch errors to the facilitator, and paid calls end with `402` again after the client has paid.

**Checks**
```bash
curl "$CHAINPE_FACILITATOR_URL/health"     # is it up?
curl "$CHAINPE_FACILITATOR_URL/supported"  # x402 v2, exact / eip155:5042002?
curl "$CHAINPE_FACILITATOR_URL/status"     # gasBalanceUsdc, lowGas
```

**Fixes**
- There is **no shared hosted facilitator**. Run your own; see [Self-hosting the facilitator](../self-hosting/facilitator.md).
- Make sure the proxy actually uses it. The CLI uses `facilitatorUrl` from `~/.chainpe/config.json`, falling back to `CHAINPE_FACILITATOR_URL`. `examples/proxy-railway` and the seller agents read `CHAINPE_FACILITATOR_URL`.
- If the proxy runs in a container, `localhost` refers to the container itself. Use the facilitator's reachable host name.
- Browser calls straight to the facilitator are blocked by CORS unless the origin is in `ALLOWED_ORIGINS`. Proxies and servers are not affected.
- For local development you can skip the separate service with `chainpe start --facilitator 0xGAS_KEY` (an in-process facilitator).

---

## 4. Service not found in the registry

**Symptom**: `cp.discover()` returns nothing, or the indexer's `/services` is empty.

**Fixes**
- Check the address: `CHAINPE_REGISTRY_ADDRESS` must be the Arc Testnet ChainPeRegistry from [Deployments](../smart-contracts/overview.md#deployments).
- Confirm on-chain with `chainpe list`, which reads the contract directly and bypasses the indexer.
- The indexer may still be catching up. Compare `lastIndexedBlock` and `chainHead` in `curl "$INDEXER_URL/health"`.

---

## 5. PolicyVault spending limit exceeded

**Symptom**: `PolicyVaultClient.relaySpend()` throws `over per-call cap`, `over daily cap` or `over total budget`.

**Fixes**
- Preview first:
  ```ts
  const [ok, reason] = await publicClient.readContract({
    address: vaultAddress, abi: PolicyVaultAbi,
    functionName: 'previewSpend',
    args: [owner, to, amountAtomic]
  })
  if (!ok) console.error('Would fail:', reason)
  ```
- Check `dailyRemaining(owner)` and `budgetRemaining(owner)`. Raise the caps with `setPolicy()`, or deposit more USDC.

---

## 6. `register()` or `spend()` reverts during gas estimation

**Fixes**
- Most often the USDC approval is missing. Approve the registry for `registrationFee()` (or the vault for the deposit) first. The CLI does this for you.
- Read the fee from the contract (`registrationFee()`) instead of assuming a value.
- Make sure the wallet also has a little USDC left for gas (see #2).

---

## 7. Indexer showing stale data

The indexer polls chain events every `POLL_INTERVAL_MS` (default 5 s). Wait a cycle, compare `lastIndexedBlock` to `chainHead` on `/health`, or read the contract directly with `chainpe list`. On a cold start, set `START_BLOCK` to the registry's deploy block.

---

## 8. Dashboard issues

- **"Indexer not configured" on `/marketplace`**: set `INDEXER_URL` (server-side) to your indexer.
- **ChainPeRegistry is missing or wrong on `/network`**: set `NEXT_PUBLIC_CHAINPE_REGISTRY_ADDRESS=0x79c7a22993A40A3c88355b737e6F608c6610c395` and rebuild (`NEXT_PUBLIC_*` values are baked in at build time). ERC-8004 rows default to Arc's canonical registries.
- **Wallet won't connect**: you need an injected wallet such as MetaMask. Use **Switch to Arc Testnet** on `/wallet` (see #1).
- **Balances fail to load with a custom RPC**: set `NEXT_PUBLIC_ARC_RPC_URL` before building. It is added to the CSP `connect-src` automatically.

---

## 9. Build fails with `Cannot find module @rollup/rollup-linux-x64-gnu`

This is a known npm bug with optional native dependencies. Install the matching binary without saving it, then build again:

```bash
npm i --no-save @rollup/rollup-linux-x64-gnu@$(node -p "require('rollup/package.json').version")
npm run build:sdk && npm run build
```
