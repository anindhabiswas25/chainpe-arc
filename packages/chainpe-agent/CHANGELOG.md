# @chainpearc/agent changelog

## 3.0.0 — 2026-10-13

First release for Circle's **Arc Testnet** (chain id `5042002`).

### Breaking
- Arc Testnet is the only network; USDC is the gas token.
- Payments use x402 v2. `WalletBalance` is `{ usdc }`.

### Added
- Defaults to the live Arc Testnet deployment, so no address configuration is needed:
ChainPeRegistry `0x79c7a22993A40A3c88355b737e6F608c6610c395`, PolicyVault
`0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`, and Arc's canonical ERC-8004 registries.
`CHAINPE_REGISTRY_ADDRESS`, `POLICY_VAULT_ADDRESS`, `ERC8004_IDENTITY_REGISTRY` and
`ERC8004_REPUTATION_REGISTRY` still override them.

### Fixed
- `chainpe-agent services` works without `chainpe-agent init` and without a
  configured registry address.
- `chainpe-agent status` shows the registry contract instead of "not set".
- `chainpe-agent init` printed the wrong package name in its usage hint.
- `chainpe-agent --version` reports the package version.

Earlier history: [`docs/CHANGELOG.md`](../../docs/CHANGELOG.md).
