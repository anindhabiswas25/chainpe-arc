# @chainpearc/ai-tools changelog

## 0.3.0 — 2026-10-13

First release for Circle's **Arc Testnet**.

### Breaking
- Built on `@chainpearc/sdk` 0.3 (Arc Testnet only, x402 v2, USDC as gas).

### Changed
- `createChainPeTools` / `createChainPeLangChainTools` need only `{ privateKey }`:
  contract addresses default to the live Arc Testnet deployment.

Earlier history: [`docs/CHANGELOG.md`](../../docs/CHANGELOG.md).
