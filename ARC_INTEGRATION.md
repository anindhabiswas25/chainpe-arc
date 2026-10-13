# ChainPe on Arc Testnet — integration reference

Everything a developer needs to build against ChainPe on Circle's Arc Testnet:
network constants, where they live in code, the x402 v2 wire format, contract
addresses, the self-hosted facilitator and the public API of each package.

Status: **live.** ChainPeRegistry, PolicyVault and ChainPeTimelock were deployed
on 2026-10-13 by `0x91cF2b2FC03E8feFC8669B767C5eaaaBefFA0291` and the full
payment flow was proven end to end the same day (transactions in
[`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md)).

---

## 1. Network constants (verified on-chain 2026-10-13)

| Key | Value | How verified |
|---|---|---|
| ChainPe network name | `arc-testnet` | — |
| **x402 network id** | **`eip155:5042002`** (CAIP-2) | `@x402/evm@2.28.0` ships it as a built-in network |
| Chain ID | `5042002` | `cast chain-id` → `5042002` |
| RPC (default) | `https://rpc.testnet.arc.io`, override with `ARC_RPC_URL` | docs.arc.io; `https://rpc.testnet.arc.network` (old spec value) still serves the same chain |
| Explorer | `https://explorer.testnet.arc.io` (`/tx/<hash>`, `/address/<addr>`) | `https://testnet.arcscan.app/*` now 301-redirects here |
| Explorer API (Blockscout) | `https://explorer.testnet.arc.io/api` (etherscan-compatible), `/api/v2/*` | `GET /api?module=block&action=eth_block_number` works |
| Gas token | native USDC, 18 decimals | `eth_getBalance` 339052858302454232645 vs `balanceOf` 339052858 on the same address |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000`, 6 decimals | `decimals()` → 6, `symbol()` → `USDC` |
| USDC EIP-712 domain | `{ name: "USDC", version: "2", chainId: 5042002, verifyingContract: 0x3600…0000 }` | recomputed hash equals on-chain `DOMAIN_SEPARATOR()` `0x3611…c6b0` |
| EIP-3009 | supported (FiatTokenV2_2): `transferWithAuthorization` (v,r,s and `bytes sig`), `receiveWithAuthorization`, `authorizationState` | revert reasons `ECRecover: invalid signature`, `FiatTokenV2: authorization is expired`, `FiatTokenV2: caller must be the payee` |
| Min base fee | 20 gwei (`maxFeePerGas` floor) | docs.arc.io/arc/references/gas-and-fees; `cast gas-price` → 25 gwei |
| Faucet | https://faucet.circle.com (pick Arc Testnet) | — |

**Gas is USDC.** Native balance (18 dp) and ERC-20 balance (6 dp) are the same
money. Show the ERC-20 balance and never add the two. A wallet needs nothing
but USDC: there is no separate gas asset to acquire.

## 2. Import paths (single source of truth)

Everything Arc-specific is defined once in `packages/chainpe-sdk/src/arc.ts`:

```ts
// lightweight (viem only), good for apps/dashboard and examples
import {
  CHAINPE_NETWORK,          // 'arc-testnet'
  X402_NETWORK,             // 'eip155:5042002'
  ARC_TESTNET_CHAIN_ID,     // 5042002
  ARC_TESTNET_RPC_URL, arcRpcUrl,   // arcRpcUrl() honours ARC_RPC_URL
  ARC_TESTNET_EXPLORER_URL, explorerTxUrl, explorerAddressUrl,
  ARC_USDC_ADDRESS, USDC_DECIMALS, NATIVE_USDC_DECIMALS,
  ARC_USDC_EIP712_DOMAIN,
  ARC_TESTNET_ERC8004,      // canonical Arc ERC-8004 registries (section 4)
  ARC_TESTNET_CONTRACTS,    // { chainPeRegistry, policyVault, timelock, deployBlock }
  arcTestnet,               // viem Chain (defineChain)
  fromX402Network, formatNativeUsdc,
} from '@chainpearc/sdk/arc'
```

The same names are re-exported from `@chainpearc/sdk` and from `@chainpearc/cli`
(packages/chainpe).

## 3. x402 v2 wire format

`x402@1.x`, `x402-express@1.x` and `x402-fetch@1.x` reject Arc at runtime
(fixed zod enum plus a hardcoded USDC domain table). ChainPe now uses
**x402 v2**: `@x402/core`, `@x402/evm`, `@x402/express`, `@x402/fetch` (all
`2.28.0`). Arc Testnet is a built-in network there.

Wire-format differences you will see:

| | x402 v1 (old) | x402 v2 (now) |
|---|---|---|
| network | `"arc-testnet"` (rejected anyway) | `"eip155:5042002"` |
| 402 challenge | JSON body `{x402Version:1, accepts:[…maxAmountRequired…]}` | `PAYMENT-REQUIRED` header (base64 JSON `{x402Version:2, resource, accepts:[{scheme, network, asset, amount, payTo, maxTimeoutSeconds, extra:{name,version}}]}`) |
| client retry header | `X-PAYMENT` | `PAYMENT-SIGNATURE` |
| settlement header | `X-PAYMENT-RESPONSE` | `PAYMENT-RESPONSE` |

A resource server on `@x402/express` v2 (this is what `examples/proxy-railway` and `chainpe start` do):

```js
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { X402_NETWORK } from '@chainpearc/sdk/arc'

const facilitator = new HTTPFacilitatorClient({ url: process.env.CHAINPE_FACILITATOR_URL })
const server = new x402ResourceServer(facilitator).register(X402_NETWORK, new ExactEvmScheme())
app.use(paymentMiddleware({
  'GET /weather': { accepts: [{ scheme: 'exact', price: '$0.01', network: X402_NETWORK, payTo }], description: '…' },
}, server))
```

Paying client (any x402 v2 client works):

```js
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
const pay = wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: X402_NETWORK, client: new ExactEvmScheme(account) }] })
```

Or use the ChainPe SDK, which wraps all of this: `new ChainPe({ privateKey }).fetch(url)`.

## 4. Contract addresses (Arc Testnet)

| Contract | Address | Source |
|---|---|---|
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | Arc canonical (docs.arc.io), v2.0.0 |
| ERC-8004 ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | Arc canonical, v2.0.0 |
| ERC-8004 ValidationRegistry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` | Arc canonical, v2.0.0 |
| ChainPeRegistry (UUPS proxy) | [`0x79c7a22993A40A3c88355b737e6F608c6610c395`](https://explorer.testnet.arc.io/address/0x79c7a22993A40A3c88355b737e6F608c6610c395) (block 66993614) | `contracts/deployments/arc-testnet.json` |
| PolicyVault (UUPS proxy) | [`0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`](https://explorer.testnet.arc.io/address/0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81) | `contracts/deployments/arc-testnet-policyvault.json` |
| ChainPeTimelock | [`0x5071794F30C32604Be115c00Ed041c403fB2f302`](https://explorer.testnet.arc.io/address/0x5071794F30C32604Be115c00Ed041c403fB2f302) (48h delay; not yet owner of anything) | `contracts/deployments/arc-testnet-timelock.json` |

The canonical ERC-8004 registries are the same reference implementation
ChainPe vendors (`getVersion()` → `2.0.0`, identical ABI). They are live and
already used by other Arc agents, so ChainPe defaults to them instead of
deploying a private copy. `contracts/deployments/arc-testnet-erc8004.json`
records them.

Every package, service and script defaults to these addresses; no configuration
is required. Env overrides: `CHAINPE_REGISTRY_ADDRESS`, `POLICY_VAULT_ADDRESS`,
`ERC8004_IDENTITY_REGISTRY`, `ERC8004_REPUTATION_REGISTRY`.

ChainPeRegistry charges a **1 USDC** registration fee (`registrationFee()`),
paid to the fee recipient with a USDC `approve` + `register`. `update` and
`deregister` are free apart from gas.

## 5. Facilitator (self-hosted)

Service: `services/chainpe-facilitator`. Clients/proxies point at it with
**`CHAINPE_FACILITATOR_URL`** (local default `http://localhost:4500`).

| Env | Required | Meaning |
|---|---|---|
| `FACILITATOR_PRIVATE_KEY` | yes | gas key that submits `transferWithAuthorization`; holds only USDC for gas |
| `ARC_RPC_URL` | no | RPC override |
| `PORT` | no | default `4500` |
| `ALLOWED_ORIGINS` | no | CORS allowlist (comma-separated); default denies browsers |
| `LOW_GAS_THRESHOLD_USDC` | no | `/health` reports `degraded` below this (default `0.5`) |

Endpoints (x402 v2 facilitator contract):

- `GET /supported` → `{ kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:5042002" }], extensions: [], signers: { "eip155:*": ["0x…"] } }`
- `POST /verify` with body `{ x402Version: 2, paymentPayload, paymentRequirements }` → `{ isValid, invalidReason?, payer? }`
- `POST /settle` with the same body → `{ success, transaction, network, payer?, errorReason? }`
- `GET /health`, `GET /status` (gas balance in USDC), `GET /metrics` (Prometheus)

## 6. Public API notes

- `@chainpearc/sdk`
  - New subpath `@chainpearc/sdk/arc` (section 2). Root also re-exports it.
  - `getX402Network()` returns `'eip155:5042002'` (was a cast `'arc-testnet'`).
  - `ChainPe.fetch/pay` speak x402 v2 (section 3). They pick the Arc USDC `exact` offer, enforce `maxPerCall`, and read the tx from `PAYMENT-RESPONSE`. `PaymentInfo.network` stays `'arc-testnet'`.
  - `Balances` is `{ usdc }`. `native` was **removed** because it is the same funds.
  - `PolicyVaultClient({ vaultAddress? })`: optional, defaults to `POLICY_VAULT_ADDRESS`, then the deployed vault. New `resolvePolicyVaultAddress()`.
  - `resolveReputationRegistry()` defaults to the canonical Arc ReputationRegistry and never returns `undefined` now.
- `@chainpearc/cli` (packages/chainpe)
  - Proxy runs on `@x402/express` v2. The facilitator comes from `facilitatorUrl` **or the `CHAINPE_FACILITATOR_URL` env var** (new); `--facilitator <key>` settles in-process.
  - The 402 challenge is in the `PAYMENT-REQUIRED` header (body is `{}`). The agent id is advertised via the `X-CHAINPE-AGENT-ID` header and `accepts[].extra.agentId`. CORS exposes `PAYMENT-REQUIRED`, `PAYMENT-RESPONSE`, `X-CHAINPE-AGENT-ID`.
  - `AccountBalances` is `{ usdc }`; `formatNative` was removed (use `formatNativeUsdc` from `/arc`). `NetworkInfo.x402Network` is the CAIP-2 id.
- Wallet MCP (`chainpe-wallet-mcp`)
  - **`transfer_native` removed.** On Arc it moved the same USDC as `transfer_usdc`, at 18 decimals, so it was redundant and error-prone. The tool count is now **8**: `x402_fetch`, `pay`, `search_bazaar`, `check_balance`, `give_feedback`, `spending_report`, `transfer_usdc`, `request_funding`.
  - `check_balance` → `{ address, network, mode, usdc, gasNote }` (no `native`).
  - `pay` returns `{ paymentHeader, headerName: "PAYMENT-SIGNATURE", … }`.
- Agent (`@chainpearc/agent`): `WalletBalance` is `{ usdc }`; `formatBalance()` → `{ usdc }`; `WalletInstance.signer` is a viem account. Payment receipts now carry the real amount and `payTo`.
- Services: facilitator and indexer Docker images build from the **repo root** (`docker build -f services/<svc>/Dockerfile .`). Their Railway configs point at those Dockerfiles, so Railway's root directory must be the repo root.

## 7. Things that commonly go wrong

| Symptom | Cause | Fix |
|---|---|---|
| `x402: payment signed but the server could not settle (invalid_exact_evm_insufficient_balance)` | The paying wallet holds less USDC than the price | Fund it at <https://faucet.circle.com> (Arc Testnet) |
| `Request exceeds defined limit.` (RPC code `-32005`) | The public RPC rate-limits bursts | Retry with backoff (`http(url, { retryCount: 8, retryDelay: 400 })`) or set `ARC_RPC_URL` to a dedicated endpoint |
| Facilitator `/health` returns `"status":"degraded","warning":"low_gas"` | The gas key is below `LOW_GAS_THRESHOLD_USDC` | Send USDC to the address in `/status` |
| A client built on `x402@1.x` / `x402-fetch@1.x` gets rejected | v1 has a fixed network enum without Arc | Use `@x402/*` 2.28+ or the ChainPe SDK |
| 402 body is `{}` | Expected in v2: the challenge is in the `PAYMENT-REQUIRED` header | Decode the header (base64 JSON) |
| `giveFeedback` reverts | ERC-8004 rejects feedback from the agent's own owner | Rate from a different wallet than the one that minted the identity |
| Explorer shows a proxy as unverified although `npm run verify` said "already verified" | Blockscout answers for a proxy with its implementation's source | `npm run verify` force-submits proxies; if the API keeps returning 429, use `npm run verify:blockscout` (native v2 API) |

## 8. Verifying a change against live Arc

```bash
npm install && npm run build && npm test          # packages
(cd contracts && npm install && npx hardhat test) # contracts
(cd services/chainpe-facilitator && npm install && FACILITATOR_PRIVATE_KEY=0x... npm run dev) &
CHAINPE_PRIVATE_KEY=0x... npm run test:e2e        # 7 flows against the live contracts
CHAINPE_PRIVATE_KEY=0x... npm run test:e2e:a2a    # buyer agent hires two seller agents
```

Both e2e scripts need a wallet with about 3.5 USDC in total and clean up the
listings they create. Registration fees go to the registry's fee recipient.
