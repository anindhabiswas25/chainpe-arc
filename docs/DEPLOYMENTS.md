# ChainPe — Deployments

## Arc Testnet (chainId 5042002)

**Status: deployed 2026-10-13.** ChainPeRegistry, PolicyVault and ChainPeTimelock are live; ERC-8004 uses Arc's canonical registries.
Addresses are copied from `contracts/deployments/arc-testnet*.json` and baked into `@chainpearc/sdk/arc` (`ARC_TESTNET_CONTRACTS`). Env vars still override them.
Owner of the registry and vault: deployer EOA `0x91cF2b2FC03E8feFC8669B767C5eaaaBefFA0291` (testnet only; move to a Safe/timelock before any mainnet use).

| Key | Value |
|---|---|
| Network name | `arc-testnet` (the only supported network) |
| Chain ID | `5042002` (CAIP-2 `eip155:5042002`) |
| RPC | `https://rpc.testnet.arc.io` (override with `ARC_RPC_URL`) |
| x402 network id | `eip155:5042002` |
| Explorer | [Arc Testnet explorer](https://explorer.testnet.arc.io) |
| Gas token | USDC (native, 18 decimals at the native-balance level) |
| USDC ERC-20 interface | `0x3600000000000000000000000000000000000000` (6 decimals) |
| Faucet | <https://faucet.circle.com> (select Arc Testnet) |
| Facilitator | self-hosted: `services/chainpe-facilitator` (`CHAINPE_FACILITATOR_URL`) |

| Contract | Env var | Proxy address | Implementation | Deploy block |
|---|---|---|---|---|
| ChainPeRegistry | `CHAINPE_REGISTRY_ADDRESS` | [`0x79c7a22993A40A3c88355b737e6F608c6610c395`](https://explorer.testnet.arc.io/address/0x79c7a22993A40A3c88355b737e6F608c6610c395) | `0xE528F6731D345634d98B408475A1e6A4b8242eDB` | 66993614 |
| PolicyVault | `POLICY_VAULT_ADDRESS` | [`0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`](https://explorer.testnet.arc.io/address/0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81) | `0xcebEd51c2D30E4053A387eAD80c43a5dD03343f1` | 66993676 |
| ChainPeTimelock (48h, not yet owner) | — | [`0x5071794F30C32604Be115c00Ed041c403fB2f302`](https://explorer.testnet.arc.io/address/0x5071794F30C32604Be115c00Ed041c403fB2f302) | — | — |
| ERC-8004 IdentityRegistry (Arc canonical) | `ERC8004_IDENTITY_REGISTRY` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | — | — |
| ERC-8004 ReputationRegistry (Arc canonical) | `ERC8004_REPUTATION_REGISTRY` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | — | — |
| ERC-8004 ValidationRegistry (Arc canonical) | — | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` | — | — |

Link each address as `https://explorer.testnet.arc.io/address/<address>`. Use the
registry's deploy block as the indexer's `START_BLOCK`.

The ERC-8004 registries are Arc's canonical deployments of the reference
implementation (v2.0.0, `getVersion()`), verified on-chain on 2026-10-13. ChainPe
uses them instead of deploying its own; SDK, CLI and dashboard default to them.

## Client configuration

Nothing to configure. The addresses above are baked into `@chainpearc/sdk/arc`
(`ARC_TESTNET_CONTRACTS`, `ARC_TESTNET_ERC8004`) and every package, service and
script defaults to them:

```ts
import { ARC_TESTNET_CONTRACTS, ARC_TESTNET_ERC8004 } from '@chainpearc/sdk/arc'

ARC_TESTNET_CONTRACTS.chainPeRegistry // 0x79c7a22993A40A3c88355b737e6F608c6610c395
ARC_TESTNET_CONTRACTS.policyVault     // 0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81
ARC_TESTNET_CONTRACTS.timelock        // 0x5071794F30C32604Be115c00Ed041c403fB2f302
ARC_TESTNET_CONTRACTS.deployBlock     // 66993614n
```

To point at a different deployment (your own contracts, a local fork), override with env:

```bash
# SDK, CLI (also ~/.chainpe/config.json → registryAddress), agent, wallet MCP, indexer:
export CHAINPE_REGISTRY_ADDRESS=0x79c7a22993A40A3c88355b737e6F608c6610c395
export POLICY_VAULT_ADDRESS=0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81
export ERC8004_IDENTITY_REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e
export ERC8004_REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713

# Dashboard (baked in at build time):
NEXT_PUBLIC_CHAINPE_REGISTRY_ADDRESS=0x79c7a22993A40A3c88355b737e6F608c6610c395
NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e
NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713
```

Deploy scripts write raw deployment records to `contracts/deployments/<network>*.json`;
`packages/chainpe-sdk/__tests__/arc.test.ts` fails if the SDK constants drift from them.

## Registered services

`npm run register-demo` (in `contracts/`) registered three demo listings from the
deployer on 2026-10-13. Their endpoints are placeholders that do not resolve yet,
so they are discoverable but not payable until real services are deployed there.

| Service | Price | Endpoint | Registration tx |
|---|---|---|---|
| Weather Oracle | 0.01 USDC | `https://weather.chainpe.app` | [`0x9259e950…ec410`](https://explorer.testnet.arc.io/tx/0x9259e950a952e14e5f6effbc27652c4213250184f80871bff1fb529d23eec410) |
| Price Feed | 0.005 USDC | `https://prices.chainpe.app` | [`0x8d04d1dc…9301b`](https://explorer.testnet.arc.io/tx/0x8d04d1dc6ebd719669ae9480657b12df44f7f905133ec63f047219726a59301b) |
| Summarizer AI | 0.02 USDC | `https://summarize.chainpe.app` | [`0xe81e3b9c…c0830`](https://explorer.testnet.arc.io/tx/0xe81e3b9c0a0ebf0b20f8adb664160b21319e7017aac5f2b8e50df05215bc0830) |

List the live registry at any time with `chainpe list` or `chainpe discover`.

## Deploy runbook (Arc Testnet)

**Prerequisites:**
- `DEPLOYER_PRIVATE_KEY` — EOA funded with testnet USDC (USDC pays gas on Arc)
- `OWNER_ADDRESS` — multisig / timelock address that will own the upgradeable contracts

```bash
cd contracts

# 1. ERC-8004: nothing to deploy, ChainPe uses Arc's canonical registries (above).
#    (npm run deploy:erc8004 deploys a private copy, e.g. for a local chain.)

# 2. Deploy ChainPeRegistry (UUPS upgradeable proxy; fee token defaults to the Arc USDC interface)
OWNER_ADDRESS=0xYourSafe npm run deploy:arc-testnet

# 3. Deploy PolicyVault (UUPS upgradeable proxy)
OWNER_ADDRESS=0xYourSafe npm run deploy:policyvault

# 4. Run key safety check
npm run check-keys

# 5. Transfer ownership (initiates two-step handover; the new owner calls acceptOwnership())
SAFE_ADDRESS=0xYourSafe npm run transfer-ownership

```

## Explorer verification

`npm run verify` (in `contracts/`) verifies every contract on the Arc Testnet
explorer (Blockscout) through `hardhat-verify`. Blockscout rate-limits its API
(HTTP 429), so the script spaces requests out and retries; when it is still
limited, narrow and slow the run:

```bash
VERIFY_ONLY=proxy,timelock VERIFY_SPACING_MS=60000 npm run verify
```

Status on 2026-10-13 (`is_fully_verified` from `GET /api/v2/smart-contracts/<address>`):

| Contract | Address | Verified as |
|---|---|---|
| ChainPeRegistry proxy | [`0x79c7a22993A40A3c88355b737e6F608c6610c395`](https://explorer.testnet.arc.io/address/0x79c7a22993A40A3c88355b737e6F608c6610c395#code) | `ERC1967Proxy` ✓ |
| ChainPeRegistry implementation | [`0xE528F6731D345634d98B408475A1e6A4b8242eDB`](https://explorer.testnet.arc.io/address/0xE528F6731D345634d98B408475A1e6A4b8242eDB#code) | `ChainPeRegistryUpgradeable` ✓ |
| PolicyVault proxy | [`0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`](https://explorer.testnet.arc.io/address/0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81#code) | `ERC1967Proxy` ✓ |
| PolicyVault implementation | [`0xcebEd51c2D30E4053A387eAD80c43a5dD03343f1`](https://explorer.testnet.arc.io/address/0xcebEd51c2D30E4053A387eAD80c43a5dD03343f1#code) | `PolicyVaultUpgradeable` ✓ |
| ChainPeTimelock | [`0x5071794F30C32604Be115c00Ed041c403fB2f302`](https://explorer.testnet.arc.io/address/0x5071794F30C32604Be115c00Ed041c403fB2f302#code) | `ChainPeTimelock` ✓ |

Two things to know when verifying a redeploy:

- hardhat-verify reports a proxy as "already verified" because Blockscout's
  etherscan-style API answers for an ERC-1967 proxy with its implementation's
  source. `npm run verify` therefore force-submits proxies.
- When the etherscan-style API stays rate-limited, `npm run verify:blockscout`
  submits the proxies and the timelock through Blockscout's native v2 API
  (standard JSON input), which has a separate limit. That is how the proxies and
  the timelock above were verified.

## Facilitator (self-hosted)

There is no shared ChainPe facilitator. Each operator runs
`services/chainpe-facilitator` with a dedicated gas key funded with USDC:

```bash
# Env: FACILITATOR_PRIVATE_KEY=<dedicated gas key>, ALLOWED_ORIGINS=<optional>
# Health check: GET /health (always 200; reports "degraded" when gas is low)
# Alerting:     GET /status → lowGas
```

See `services/chainpe-facilitator/DEPLOY.md` and the docs page "Self-hosting the facilitator".

## Settlements recorded on Arc Testnet

End-to-end proof run on 2026-10-13 against the live contracts and a locally
run `services/chainpe-facilitator` (x402 v2). `e2e/run.mjs` finished 33 passed,
0 failed (3 indexer checks skipped because no indexer was running);
`e2e/agent-to-agent.mjs` finished 28 passed, 0 failed. Test listings were
deregistered afterwards.

| Source | What happened | Transaction |
|---|---|---|
| `e2e/run.mjs` | x402 payment, 0.001 USDC settled by the facilitator (EIP-3009) | [`0x4078b246…5cf90`](https://explorer.testnet.arc.io/tx/0x4078b2468257496989c65af4eebe99828ff5a03d9dcdbc78af0fc085f2d5cf90) |
| `e2e/run.mjs` | ERC-8004 identity mint (agent #897284) | [`0xc3de499b…9a73b`](https://explorer.testnet.arc.io/tx/0xc3de499bcfe3d6d6fae652ce390ce16b71b2bde972f0de900ebac3857869a73b) |
| `e2e/run.mjs` | ERC-8004 `giveFeedback` (score 85) | [`0xacdac8da…91d49`](https://explorer.testnet.arc.io/tx/0xacdac8dae0e9bf241d856eeee7a78ac0d2030f7d0c68de088f39b981fc791d49) |
| `e2e/run.mjs` | ChainPeRegistry `register` (1 USDC fee) | [`0x04490854…9ca67`](https://explorer.testnet.arc.io/tx/0x0449085474f2563b6d69404660413ddc2b21ad304c065c06ffaf0e567769ca67) |
| `e2e/run.mjs` | ChainPeRegistry `deregister` | [`0xcc2f5556…dccfb`](https://explorer.testnet.arc.io/tx/0xcc2f5556267558680dc6aeb1aa254654be1dccb3b372b0b068179de69aedccfb) |
| `e2e/run.mjs` | PolicyVault gasless `spend` (session-signed, relayer-submitted, 0.01 USDC) | [`0x9eb31f96…2feeb`](https://explorer.testnet.arc.io/tx/0x9eb31f96d3ae57dd26aaa676978c814f0f6ed80e95a297d9aa7edbb0c7d2feeb) |
| `e2e/agent-to-agent.mjs` | Research seller mints its ERC-8004 identity (#897285) | [`0x2138110c…3030a`](https://explorer.testnet.arc.io/tx/0x2138110c5288b6320aadababf088dacaef62b739cce8e0f4db9264cd2a93030a) |
| `e2e/agent-to-agent.mjs` | Digest seller mints its ERC-8004 identity (#897286) | [`0xcfd72a45…edced`](https://explorer.testnet.arc.io/tx/0xcfd72a4562eb502faf561dc0d5db167bd83593a8f7893cd3f55692f7e8fedced) |
| `e2e/agent-to-agent.mjs` | Register Research seller | [`0x58ea7975…f09de`](https://explorer.testnet.arc.io/tx/0x58ea7975f798cc9226154de598556e7631325a967e74368bfa6ca062453f09de) |
| `e2e/agent-to-agent.mjs` | Register Digest seller | [`0x9112098a…1ab40`](https://explorer.testnet.arc.io/tx/0x9112098a93569d3ade2992077f37b813c2b44053cf7cdbc598824c66cd31ab40) |
| `e2e/agent-to-agent.mjs` | Buyer pays Research seller 0.002 USDC (x402) | [`0xd4858db8…3f560`](https://explorer.testnet.arc.io/tx/0xd4858db863cd98d3c613110e78005ee2a88b52d9514364964dd420b91c63f560) |
| `e2e/agent-to-agent.mjs` | Buyer pays Digest seller 0.002 USDC (x402) | [`0x5275fc7e…969df`](https://explorer.testnet.arc.io/tx/0x5275fc7e3340265bfd14c1c666b59e69c6c0a04eb9d316f90bbfbb3bd55969df) |
| `e2e/agent-to-agent.mjs` | Buyer rates Research seller (90) | [`0x9e382fc2…cc29d`](https://explorer.testnet.arc.io/tx/0x9e382fc290c2249e96855fd91490e53864dab44d75f922f1cc084cab5accc29d) |
| `e2e/agent-to-agent.mjs` | Buyer rates Digest seller (85) | [`0xca70c1ce…3a947`](https://explorer.testnet.arc.io/tx/0xca70c1ce07c84a4a6a5de08a62243d6bd59b76d3b0cf20a30bc00f1985d3a947) |
| `chainpe register` | ERC-8004 identity auto-mint (#897287) | [`0xb8553994…602f6`](https://explorer.testnet.arc.io/tx/0xb8553994667faa4d47b56492a26ab09702ed238633540e5a0e98272fd4c602f6) |
| `chainpe register` | ChainPeRegistry `register` for `examples/weather-api` | [`0xe4204804…052b4`](https://explorer.testnet.arc.io/tx/0xe420480418cb0e12b1d30801f3bd20e40b5d9c9c2cf3591c8e81cac7b83052b4) |
| `chainpe fetch --feedback` | x402 payment, 0.001 USDC through the `chainpe start` proxy | [`0x7f8c948d…dabc8`](https://explorer.testnet.arc.io/tx/0x7f8c948d4b1c6b9271c5a5c3f6e2054225ffa90e59a3c4730ad56e76301dabc8) |
| `chainpe fetch --feedback` | ERC-8004 feedback (+100) for agent #897287 | [`0x44af54eb…29d2e`](https://explorer.testnet.arc.io/tx/0x44af54ebc03343f3de4bc21b4fa2a16395b678424fd5f8259d2a87af6f129d2e) |
| Wallet MCP `x402_fetch` | x402 payment, 0.001 USDC | [`0x3ee2fd95…f73b1`](https://explorer.testnet.arc.io/tx/0x3ee2fd95d3adb4f4461227e68e38c50fc10270fed987b1fc81981babd1ff73b1) |
| `chainpe deregister` | ChainPeRegistry `deregister` | [`0x4bbaaca6…3d4d1`](https://explorer.testnet.arc.io/tx/0x4bbaaca6097a04b041727192220360cc47d9c799ea488292c2afb3356063d4d1) |

Reproduce with `npm run test:e2e` and `npm run test:e2e:a2a` (see the README, "End-to-end on live Arc Testnet").
