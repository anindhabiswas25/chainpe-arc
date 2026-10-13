# ChainPe — gasless, policy-bounded agent spending (the "wow")

An owner sets **on-chain spending limits**; their agent spends **gaslessly**
within them; the **chain blocks an overspend**. Built on `PolicyVault`
(`contracts/contracts/PolicyVaultUpgradeable.sol`, live at `0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`) + the `@chainpearc/sdk` `PolicyVaultClient`
— a non-4337 approach to gasless agent spending.

```
owner ──deposit USDC + setPolicy(sessionKey, caps)──▶ PolicyVault
agent (session key) ──signs spend (EIP-712, no gas)──▶ relayer ──spend(...)──▶ vault
                                                          releases USDC if within policy,
                                                          REVERTS if over-cap / revoked
```

## Why it matters

- **Gasless:** the agent only signs; a relayer (or the ChainPe facilitator)
  submits and pays USDC. The agent never holds gas.
- **On-chain guardrails:** `maxPerCall`, `dailyCap`, `totalBudget`, `expiry`, and
  an optional recipient allowlist — all enforced in the contract.
- **Revocable:** the owner can kill the session key instantly.

## Run

```bash
npm install && npm run build      # from the repo root, once
cd examples/policy-vault
cp .env.example .env              # 3 distinct keys + RECIPIENT
npm install
npm run demo
```

The demo uses the live PolicyVault on Arc Testnet
(`0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`). Each owner has an isolated
balance and policy inside it, so you do not need your own deployment; set
`POLICY_VAULT_ADDRESS` only to target one.

```bash
# optional: your own vault
cd ../../contracts && npm run deploy:policyvault
```

You'll see: a 0.5 USDC spend settle gaslessly, a 2 USDC spend **rejected
on-chain** (over the 1 USDC per-call cap), and another rejected after the owner
revokes the session — each visible in the Arc Testnet explorer.

> Needs: the OWNER wallet funded with USDC (to deposit) + USDC (setup gas); the
> RELAYER funded with USDC (submission gas); the SESSION key needs nothing.
> ERC-8004-style separation: keep the three keys distinct.
