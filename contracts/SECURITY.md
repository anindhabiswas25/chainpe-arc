# ChainPe Contracts — Security Notes

Scope: the custom ChainPe contracts (targeting Arc Testnet) —
`ChainPeRegistryUpgradeable`, `PolicyVaultUpgradeable`, `ChainPeTimelock`. (The `erc8004/*` registries are vendored
reference implementations of ERC-8004.)

## Static analysis (Slither)

Run per-contract (the whole-project run trips on the duplicate `ERC1967Proxy`
contract name — OZ's vs. the vendored ERC-8004 one — which is a tooling quirk,
not a code issue):

```bash
solc-select use 0.8.28
slither contracts/contracts/PolicyVaultUpgradeable.sol \
  --solc-remaps "@openzeppelin=node_modules/@openzeppelin" --exclude-dependencies
```

### Triage — all findings reviewed, none are exploitable

| Finding | Where | Disposition |
|---|---|---|
| `incorrect-exp`, `divide-before-multiply` | OZ `Math.sol` | Library code, false positive. Not ours. |
| `unused-return` on `functionDelegateCall` | OZ `ERC1967Utils` | Library code. Not ours. |
| `shadowing-local`: `owner` param shadows `Ownable.owner()` | PolicyVault `spend`/`previewSpend`/etc. | **Accepted.** The param name `owner` matches the EIP-712 `Spend(address owner,...)` schema and the event/getter names. The functions never call the `owner()` getter, so there is no behavioural shadowing. Severity: low/style. |
| `block-timestamp` used for comparisons | PolicyVault expiry/deadline/daily-cap | **Accepted & required.** All windows are multi-hour; validator timestamp drift (seconds) cannot meaningfully game them. |
| `missing-zero-address-validation` on `identityRegistry_` / `setIdentityRegistry` | ChainPeRegistry | **By design.** `identityRegistry == address(0)` is the documented "unset" state. |

The fund-custody contract (`PolicyVaultUpgradeable`) follows checks-effects-
interactions, uses `nonReentrant` on `deposit`/`spend`, EIP-712 + per-owner nonces
for replay protection, and keeps `withdraw` always available (not pausable) so a
pause cannot trap user funds.

## Arc-specific review (gas token = USDC)

Arc's native gas token is USDC (18 decimals). The same balance is exposed as an
ERC-20 at `0x3600000000000000000000000000000000000000` (6 decimals). Reviewed
against https://docs.arc.io/arc/references/evm-differences on 2026-10-13:

| Concern | Finding |
|---|---|
| `msg.value` / `payable` | None of `ChainPeRegistry(Upgradeable)`, `PolicyVault(Upgradeable)` or `ChainPeTimelock` has a `payable` function, `receive()` or `fallback()`, and none reads `msg.value`. On Arc `msg.value` would be 18-decimal USDC, so this matters: no code mixes `msg.value` with 6-decimal ERC-20 amounts. |
| Fees, budgets, caps | All amounts (`registrationFee`, `maxPerCall`, `dailyCap`, `totalBudget`, vault balances) are 6-decimal ERC-20 USDC moved with `SafeERC20` through the `0x3600…` interface. No 18-decimal math anywhere. |
| Plain native sends to the vault | Without a `receive()`, a native-value call to the vault reverts. A direct ERC-20 `transfer` to the vault (bypassing `deposit`) raises its token balance but credits nobody, the same as a stray ERC-20 transfer on any chain. The owner's rescue path does not exist for the vault by design; funds sent that way are stuck. Integrations must use `deposit`. |
| `SELFDESTRUCT` | Not used. (On Arc it would move the contract's USDC.) |
| `PREVRANDAO` / randomness | Not used (returns 0 on Arc). |
| `address(0)` value transfers | Not used (they revert on Arc). Fee recipients are validated non-zero. |
| Blocklist | Arc enforces the USDC blocklist at the protocol level for native and ERC-20 movements. A blocklisted vault, payer or recipient makes the affected transfer revert. This is the same trust assumption as Circle USDC elsewhere (below). |
| EIP-712 / chain id | PolicyVault's domain uses `block.chainid` (5042002), so Arc Testnet spend signatures cannot be replayed on other chains. |
| Fee floor | Arc's mempool requires `maxFeePerGas` ≥ 20 gwei. This affects relayers/scripts, not contract logic. |

Result: no contract changes needed for Arc.

## Trust assumptions

- **USDC is centrally administered.** It can blacklist addresses and is
  pausable/upgradeable by Circle. A blacklisted vault or recipient freezes the
  affected transfer at the token layer — outside this contract's control.
- **Relayers (PolicyVault `spend`)** are permissionless and not forced to submit
  promptly; a held authorization is recovered by re-signing with a fresh
  `deadline`.
- **Owner** controls UUPS upgrades. A deployer-owned deployment MUST be rotated to a `ChainPeTimelock` behind a multisig before significant TVL accumulates (see checklist).

## Post-deploy checklist (production)

- [ ] **Professional audit** + bug bounty now that real-money TVL is live. These notes and
      the Slither pass are a first filter, not a substitute.
- [ ] Deploy `ChainPeTimelock` (24–48h delay), proposers = Gnosis Safe.
      `scripts/deploy-timelock.ts`.
- [ ] Deploy registry + vault with `OWNER_ADDRESS=<timelock>`. The deploy scripts
      now **refuse** a deployer-EOA owner on production chains unless `ALLOW_DEPLOYER_OWNER=true`.
- [ ] Full integration test (on a mainnet fork): deposit → setPolicy → relayed spend → withdraw → pause,
      plus a proxy-upgrade rehearsal through the timelock.
- [ ] Verify the implementation and proxy contracts on the Arc explorer (Blockscout) after deploy: `npm run verify`.
