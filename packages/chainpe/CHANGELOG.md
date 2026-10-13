# @chainpearc/cli changelog

## 3.0.0 — 2026-10-13

First release for Circle's **Arc Testnet** (chain id `5042002`).

### Breaking
- Arc Testnet is the only network; USDC is the gas token.
- The proxy runs on `@x402/express` v2: the 402 challenge is in the
  `PAYMENT-REQUIRED` header and clients retry with `PAYMENT-SIGNATURE`.
- No shared hosted facilitator. Point the proxy at your own
  `services/chainpe-facilitator` with `CHAINPE_FACILITATOR_URL`, or settle
  in-process with `chainpe start --facilitator <gas key>`.
- `AccountBalances` is `{ usdc }`; `formatNative` was removed.

### Added
- Defaults to the live Arc Testnet deployment, so no address configuration is needed:
ChainPeRegistry `0x79c7a22993A40A3c88355b737e6F608c6610c395`, PolicyVault
`0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`, and Arc's canonical ERC-8004 registries.
`CHAINPE_REGISTRY_ADDRESS`, `POLICY_VAULT_ADDRESS`, `ERC8004_IDENTITY_REGISTRY` and
`ERC8004_REPUTATION_REGISTRY` still override them.

### Fixed
- `chainpe list` works without running `chainpe init` first (it is a public read).
- `chainpe status` always shows the registry contract and registration state.
- `chainpe --version` reports the package version (it was pinned to a stale constant).

Earlier history: [`docs/CHANGELOG.md`](../../docs/CHANGELOG.md).
