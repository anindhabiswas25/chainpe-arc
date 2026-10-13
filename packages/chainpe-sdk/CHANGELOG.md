# @chainpearc/sdk changelog

## 0.3.0 — 2026-10-13

First release for Circle's **Arc Testnet** (chain id `5042002`, x402 network `eip155:5042002`).

### Breaking
- Arc Testnet is the only network; USDC is the gas token.
- Payments use x402 v2 (`@x402/core`, `@x402/evm` 2.28): `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` headers.
- `balance()` returns `{ usdc }` only.
- `ARC_TESTNET_CONTRACTS` values are concrete addresses (no longer `| undefined`) and gain `timelock`.

### Added
- Defaults to the live Arc Testnet deployment, so no address configuration is needed:
ChainPeRegistry `0x79c7a22993A40A3c88355b737e6F608c6610c395`, PolicyVault
`0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`, and Arc's canonical ERC-8004 registries.
`CHAINPE_REGISTRY_ADDRESS`, `POLICY_VAULT_ADDRESS`, `ERC8004_IDENTITY_REGISTRY` and
`ERC8004_REPUTATION_REGISTRY` still override them.
- `@chainpearc/sdk/arc` subpath with every Arc constant and the `arcTestnet` viem chain.
- `PolicyVaultClient` decodes vault custom errors by name (for example `OverPerCallCap`).

### Changed
- A rejected settlement now reports the facilitator's reason (for example
  `invalid_exact_evm_insufficient_balance`), says "Arc Testnet" and points to
  <https://faucet.circle.com>.
- An invalid address override fails with an error naming the setting.

Earlier history: [`docs/CHANGELOG.md`](../../docs/CHANGELOG.md).
