# ChainPe dashboard

Next.js app for the ChainPe x402 economy on **Arc Testnet** (chain `5042002`).
The ChainPe contracts are live there, and the dashboard reads and writes them
directly. Gas on Arc is paid in USDC, so a wallet only needs USDC.

| Route | What it does | Data source |
|---|---|---|
| `/` | Product page | static |
| `/marketplace` | Registered x402 services, ranked by ERC-8004 reputation, priced in USDC | indexer (`INDEXER_URL`); falls back to reading the ChainPeRegistry on-chain when the indexer is unset or unreachable |
| `/services/[id]` | Endpoint, price, pay-to, developer, live ERC-8004 reputation, give feedback | indexer or registry (same fallback) + ReputationRegistry (browser) |
| `/register` | Merchant flow: approve the USDC fee, register a service, edit, deregister, mint an ERC-8004 identity | wallet + Arc RPC |
| `/vault` | Agent flow: deposit / withdraw USDC, set or revoke a session-key spending policy, manage the allowlist | wallet + Arc RPC |
| `/wallet` | Connect an injected wallet, add/switch to Arc Testnet, USDC balance, recent USDC transfers, faucet link, tx lookup | Arc RPC (browser) |
| `/tx/[hash]` | Decode a transaction: x402 settlement, USDC moved, and every ChainPe registry / PolicyVault / ERC-8004 / USDC event and call | Arc RPC (browser) |
| `/network` | Arc parameters, every contract address with explorer links, live on-chain state, facilitator + indexer health | Arc RPC + server-side fetch |
| `/docs` | Redirects to `DOCS_URL` | — |

## Contracts (Arc Testnet)

Defaults are baked into [`src/lib/arc.ts`](./src/lib/arc.ts) and mirror
[`docs/DEPLOYMENTS.md`](../../docs/DEPLOYMENTS.md). Each can be overridden by env.

| Contract | Address | Env override |
|---|---|---|
| ChainPeRegistry (UUPS proxy, deploy block 66993614) | `0x79c7a22993A40A3c88355b737e6F608c6610c395` | `NEXT_PUBLIC_CHAINPE_REGISTRY_ADDRESS` |
| PolicyVault (UUPS proxy) | `0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81` | `NEXT_PUBLIC_POLICY_VAULT_ADDRESS` |
| ChainPeTimelock (48h, not yet owner of anything) | `0x5071794F30C32604Be115c00Ed041c403fB2f302` | `NEXT_PUBLIC_CHAINPE_TIMELOCK_ADDRESS` |
| ERC-8004 IdentityRegistry (Arc canonical) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY` |
| ERC-8004 ReputationRegistry (Arc canonical) | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | `NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY` |
| ERC-8004 ValidationRegistry (Arc canonical) | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` | `NEXT_PUBLIC_ERC8004_VALIDATION_REGISTRY` |
| USDC (ERC-20 interface, 6 decimals; also the gas token) | `0x3600000000000000000000000000000000000000` | — |

### ABIs are generated, not hand-written

`src/abi/*.ts` is generated from the compiled contracts so it cannot drift:

```bash
(cd ../../contracts && npm ci && npx hardhat compile)
npm run sync-abis          # node scripts/sync-abis.mjs
```

ChainPeRegistry, PolicyVault and ChainPeTimelock come from
`contracts/artifacts`; the ERC-8004 registries from `contracts/abis/erc8004`.
Re-run it whenever a contract changes, and commit the result.

## Wallet and transactions

The dashboard uses viem with the injected EIP-1193 wallet (no wagmi). It calls
`eth_requestAccounts`, `wallet_switchEthereumChain`, and (if the wallet doesn't
know Arc yet) `wallet_addEthereumChain` with chain id `0x4cef52`, RPC
`https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io`, and
native currency USDC (18 decimals).

`/wallet` and `/tx` are read-only. `/register`, `/vault` and the feedback form
on `/services/[id]` send transactions. Every write:

1. is disabled until the wallet is connected **and** on Arc Testnet;
2. is checked client-side first (USDC balance, allowance, field limits);
3. is simulated with `eth_call`, so a revert is shown with its reason
   (for example `ServiceAlreadyExists`, `EnforcedPause`) before the wallet opens;
4. reports rejection in the wallet, on-chain reverts, and success with links to
   the explorer and to `/tx/[hash]`.

What each flow calls:

- **Register a service**: `USDC.approve(registry, fee)` when the allowance is
  below `registrationFee()` (1 USDC today), then `register(ServiceInput)`.
  `update(ServiceInput)` (charges `updateFee()`, 0 today) and
  `deregister(name)` for services you own. The name is the key and cannot be
  changed. Optional: `IdentityRegistry.register(agentURI)` to mint an agent id.
- **Policy Vault**: `USDC.approve(vault, amount)` + `deposit(amount)`,
  `withdraw(amount)` (works even when the vault is paused),
  `setPolicy(sessionKey, maxPerCall, dailyCap, totalBudget, expiry, allowlistOnly)`,
  `revokeSession()`, `setAllowlist(to, allowed)`. Reads `balanceOf`, `policyOf`,
  `dailyRemaining`, `budgetRemaining`, `totalSpent`. `spend()` is not exposed:
  it is called by a relayer with the agent's session-key signature.
- **Feedback**: `ReputationRegistry.giveFeedback(agentId, score, 0, tag1, tag2, endpoint, feedbackURI, 0x0)`
  with a 0–100 score. The registry rejects feedback from the agent's owner or
  operators, so the form is hidden for those wallets.

Your native balance and your USDC ERC-20 balance are the same funds at
different decimals, so the dashboard shows a single USDC figure.

### Known limits

- The public Arc RPC rejects `eth_getLogs` over 10,000+ blocks and rate-limits
  bursts. Reads are sent as JSON-RPC batches, and "recent activity" lists scan
  only the last few 9,999-block windows (about 1.4 hours each). Use the indexer
  for full history.
- Reputation is read with `getClients` + `getSummary`. The registry is shared
  and permissionless, so a client with tens of thousands of feedback entries
  makes `getSummary` run out of gas; such clients are left out of the average
  and the page says how many.
- The on-chain marketplace fallback reads every service with `getServices`
  (100 per call). That is fine for a small registry; run the indexer once it grows.

## Configure

See [`.env.example`](./.env.example). Everything is optional:

- `NEXT_PUBLIC_*_ADDRESS` / `NEXT_PUBLIC_ERC8004_*`: contract overrides (table above).
- `INDEXER_URL`: a running [indexer](../../services/chainpe-indexer). Without
  it `/marketplace` and `/services/[id]` read the registry on-chain.
- `CHAINPE_FACILITATOR_URL`: your [self-hosted facilitator](../../services/chainpe-facilitator).
  It is read server-side, so you don't need to add the dashboard to the
  facilitator's `ALLOWED_ORIGINS`.
- `NEXT_PUBLIC_ARC_RPC_URL`: optional RPC override. It is added to the CSP
  `connect-src` at build time.
- `DOCS_URL`: where `/docs` redirects (the docs site in `apps/landing`).

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

Need testnet USDC? Use the [Circle faucet](https://faucet.circle.com) and select
Arc Testnet.

## Deploy

Standard Next.js app. Deploy it to Vercel (root directory `apps/dashboard`) or
any Node host, and set the env vars above. `NEXT_PUBLIC_*` values are baked in at
build time.

## Verify

```bash
npm run typecheck
npm run build
```
