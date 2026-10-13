# chainpe-wallet-mcp changelog

## 0.4.0 — 2026-10-13

First release for Circle's **Arc Testnet** (chain id `5042002`).

### Breaking
- Arc Testnet is the only network; USDC is the gas token.
- `transfer_native` was removed (it moved the same USDC as `transfer_usdc`). The server exposes 8 tools.
- `check_balance` returns `{ address, network, mode, usdc, gasNote }`.
- `pay` returns a `PAYMENT-SIGNATURE` header (x402 v2).

### Added
- `search_bazaar` and `x402_fetch` default to the live ChainPeRegistry
  (`0x79c7a22993A40A3c88355b737e6F608c6610c395`); `CHAINPE_REGISTRY_ADDRESS` overrides it.

### Changed
- The server reports its real package version to MCP clients.

Earlier history: [`docs/CHANGELOG.md`](../../docs/CHANGELOG.md).
