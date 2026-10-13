---
id: changelog
title: Changelog
sidebar_position: 11
---

# Changelog

All notable changes to ChainPe are documented here.

## [3.0.0] — 2026-10-13 — Arc Testnet launch

ChainPe is live on Circle's **Arc Testnet** (chain id `5042002`), where USDC is the gas token.
ChainPeRegistry (`0x79c7a22993A40A3c88355b737e6F608c6610c395`), PolicyVault
(`0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`) and ChainPeTimelock
(`0x5071794F30C32604Be115c00Ed041c403fB2f302`) were deployed on 2026-10-13, and the full flow
(x402 payment, registration, ERC-8004 reputation, PolicyVault spend) was proven end to end
against them the same day. Addresses and transactions: [Deployments](./smart-contracts/overview.md#deployments).

Package versions: `@chainpearc/sdk` 0.3.0, `@chainpearc/ai-tools` 0.3.0, `@chainpearc/cli` 3.0.0,
`@chainpearc/agent` 3.0.0, `chainpe-wallet-mcp` 0.4.0.

### Breaking changes (upgrade notes)
- **Network:** `arc-testnet` (Arc Testnet, chain id `5042002`, x402 id `eip155:5042002`) is the only network. `NETWORK` / `CHAINPE_NETWORK` accept only `arc-testnet`; RPC overrides use `ARC_RPC_URL`. Any other value fails fast.
- **npm scope:** packages are now `@chainpearc/sdk`, `@chainpearc/ai-tools`, `@chainpearc/cli`, `@chainpearc/agent`. Update imports and dependencies.
- **Gas is USDC:** there is no separate gas coin. Fund every wallet with USDC only.
- **x402 v2:** payments use x402 v2 (`@x402/*`). The x402 network id is `eip155:5042002`; the 402 challenge is the `PAYMENT-REQUIRED` header (offers carry `amount`, not `maxAmountRequired`); clients retry with `PAYMENT-SIGNATURE`; receipts come back in `PAYMENT-RESPONSE`. Any x402 v2 client can pay ChainPe endpoints.
- **SDK `Balances`:** `balance()` returns `{ usdc }` only. The chain-specific gas-token field is gone (gas *is* USDC on Arc). `getX402Network()` returns `'eip155:5042002'`.
- **CLI / agent:** `AccountBalances` and `WalletBalances` report USDC only.
- **Wallet MCP (`chainpe-wallet-mcp`):**
  - The chain-specific native-coin transfer tool is removed; use `transfer_usdc`. The wallet has 8 tools.
  - `check_balance` returns `{ address, network, mode, usdc, gasNote }`.
  - The paying mode is `PAYMENTS` (alongside `READ_ONLY`).
- **Contract addresses:** every package, service and script defaults to the live Arc Testnet deployment and to Arc's canonical ERC-8004 registries, so no address configuration is needed. `CHAINPE_REGISTRY_ADDRESS`, `POLICY_VAULT_ADDRESS`, `ERC8004_IDENTITY_REGISTRY` and `ERC8004_REPUTATION_REGISTRY` override them. `ARC_TESTNET_CONTRACTS` values are concrete addresses and gain `timelock`.
- **Facilitator:** there is no shared hosted facilitator. Self-host `services/chainpe-facilitator` and set `CHAINPE_FACILITATOR_URL` (read by `chainpe init`, `chainpe start` and the examples).

### Removed
- Support for the previous network, its cross-chain messaging contracts and its deployment records. Releases before this one targeted a different EVM network; their records are in git history (before commit `2d20349`).
- The chain-specific demo seller agents and their investment orchestrator.
- Stale prebuilt docs bundles in `apps/landing/public/docs` and `apps/dashboard/public/docs`. The live docs are the fumadocs site in `apps/landing`.
- The non-upgradeable `ChainPeRegistry.sol` and `PolicyVault.sol`. Only the UUPS contracts are deployed; the behavioural test suites now run against them through a proxy.

### Fixed
- `chainpe list` and `chainpe-agent services` no longer require `init`; they read the public registry.
- `contracts/scripts/register-demo-services.ts` sent a `networkName` field the contract does not have and could never run.
- `e2e/run.mjs` crashed on start because it loaded a build artifact of the removed non-upgradeable PolicyVault.
- A rejected x402 settlement now reports the facilitator's reason and where to get testnet USDC.
- `--version` of both CLIs and the wallet MCP's server version now come from `package.json`.

### Added
- Explorer verification that spaces out and retries requests and force-submits proxies (`npm run verify` in `contracts/`), plus `npm run verify:blockscout` for Blockscout's native v2 API. Both proxies, both implementations and the timelock are verified.
- Three demo listings on the live registry (`npm run register-demo`).
- Dashboard: Arc Testnet wallet page (connect, switch/add chain, USDC balance, faucet link, recent USDC activity), settlement decoder (`/tx/[hash]`), marketplace via the indexer, and a network/contract status page.
- Docs: "Self-hosting the facilitator"; rewritten quickstart, troubleshooting and FAQ for Arc.

---

## [2.0.0] — 2026-06

Feature set carried over to Arc. Network-specific deployment details from this release are in git history.

- **SDK:** `ChainPe` with `fetch()`, `pay()`, `discover()`, `getReputation()`, `giveFeedback()`, `balance()`; `RegistryClient`; `PolicyVaultClient` (owner/agent/relayer roles, EIP-712); `ChainPePaymentError`.
- **AI tools:** Vercel AI SDK adapter (`createChainPeTools()`), LangChain adapter (`createChainPeLangChainTools()`), framework-agnostic core.
- **CLI:** `chainpe init`, `start`, `register`, `deregister`, `list`, `status`, `fetch`, `discover`; x402 proxy with in-process facilitator mode (`--facilitator <key>`); admin endpoints; ERC-8004 `agentId` advertised on 402 responses (`X-CHAINPE-AGENT-ID`).
- **Seller agents:** LLM seller agents + buyer orchestrator, `register-seller.mjs` with ERC-8004 identity auto-mint, `launch.sh`.
- **Facilitator:** non-custodial x402 verify/settle, rate limiting, Prometheus metrics, cached gas balance.
- **Indexer:** events → Postgres → REST (`/services`, `/services/:id`, `/services/:id/reputation`, `/stats`, `/health`).
- **PolicyVault:** per-call cap, daily cap, total budget, expiry, allowlist; EIP-712 `Spend`; `previewSpend()`; UUPS variant.
- **ERC-8004:** Identity, Reputation and Validation registries (UUPS).

---

## [1.0.0] — 2024-07

- Initial `chainpe` x402 reverse proxy gateway: `chainpe init` / `chainpe start`, per-route pricing via `routes.json`, admin endpoints, in-memory rate limiting, graceful shutdown, structured logging (`CHAINPE_LOG_LEVEL`), programmatic `startProxyServer()`, TypeScript types.
