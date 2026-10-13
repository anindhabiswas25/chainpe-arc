# @chainpearc/sdk

**x402 USDC payments + on-chain ERC-8004 reputation for the Arc Testnet agent economy — in 3 lines.**

Give any app or AI agent the ability to **discover, pay for, and rate** HTTP APIs
per request in USDC, settled on Arc Testnet. The provider's facilitator pays
the gas, so your wallet only needs USDC.

```bash
npm install @chainpearc/sdk
```

> `@chainpearc/*` is not published to npm yet. Until it is, build this repo (`npm install && npm run build`) and install by path: `npm install /path/to/ChainPe/packages/chainpe-sdk`.

## Quickstart (the 3 lines)

```ts
import { ChainPe } from '@chainpearc/sdk'

const cp = new ChainPe({ privateKey: process.env.PRIVATE_KEY! }) // Arc Testnet, live contracts
const res = await cp.fetch('https://api.example.com/paid') // auto-pays a 402
const data = await res.json()
```

`cp.fetch` is a drop-in `fetch`: it makes the request, and if the server answers
`402 Payment Required`, it signs a USDC payment (EIP-3009), retries with the
`PAYMENT-SIGNATURE` header (x402 v2), and returns the final `Response`.

## Discover + pay an agent (ranked by reputation)

```ts
const cp = new ChainPe({ privateKey })

// Ranked: scored services first, highest ⭐ first.
const services = await cp.discover('summarize')

const best = services[0]
const result = await cp.pay(best.endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: '…' }),
  autoFeedback: true // leave on-chain ERC-8004 feedback after paying
})

console.log(result.data)        // parsed response body
console.log(result.payment)     // { amount, recipient, network, txHash }
console.log(result.reputation)  // { agentId, score, txHash } when autoFeedback
```

## API

`new ChainPe(options)`

| option | default | purpose |
|---|---|---|
| `privateKey` | — (required) | EOA key that signs payments + feedback |
| `network` | `'arc-testnet'` | `'arc-testnet'` (the only supported network) |
| `registryAddress` | `CHAINPE_REGISTRY_ADDRESS`, else the live registry `0x79c7a229…c395` | ChainPeRegistry address |
| `reputationRegistry` | `ERC8004_REPUTATION_REGISTRY`, else Arc's canonical `0x8004B663…8713` | ERC-8004 Reputation Registry |
| `maxPerCall` | `'1'` | max USDC to auto-pay for one 402 |
| `autoFeedback` | `false` | post positive feedback after a paid call |
| `facilitatorUrl` | — | reserved for facilitator-routed flows; payers do not need it |

Methods:

- **`fetch(url, opts?)` → `Response`** — drop-in fetch that auto-pays a 402.
- **`pay(url, opts?)` → `PaidResult`** — same, but returns parsed `data` plus
  `payment` and (optional) `reputation` details.
- **`discover(query?)` → `RankedService[]`** — read the on-chain registry,
  annotate each service with its ERC-8004 reputation, ranked best-first.
  `query` is a search string or `{ query, tags, maxPrice }`.
- **`getReputation(agentId)` → `ReputationSummary | null`** — aggregate score.
- **`giveFeedback(agentId, score, opts?)` → `txHash`** — post 0–100 feedback.
- **`getAddress()` → `string`** — the wallet address.
- **`config`** — the resolved `{ network, address, registryAddress, reputationRegistry, facilitatorUrl, maxPerCall }` (no secrets).
- **`balance()` → `{ usdc }`**: the wallet's USDC balance (human units). USDC is also the gas token on Arc.

Failed payments throw `ChainPePaymentError` with a `.reason` (for example
`invalid_exact_evm_insufficient_balance`, or `maxPerCall` exceeded) and, when
known, a `.txHash`.

## PolicyVault (on-chain spending caps)

```ts
import { PolicyVaultClient } from '@chainpearc/sdk'

const owner = new PolicyVaultClient({ privateKey: OWNER_KEY })   // live vault by default
await owner.deposit('5')
await owner.setPolicy({
  sessionKey: AGENT_ADDRESS, maxPerCall: '0.02', dailyCap: '1', totalBudget: '5',
  expiry: Math.floor(Date.now() / 1000) + 86_400
})

const agent = new PolicyVaultClient({ privateKey: AGENT_KEY })
const auth = await agent.signSpend({ owner: owner.getAddress(), to: PAYEE, amount: '0.01' }) // no gas
await owner.relaySpend(auth)   // any relayer submits; the chain enforces the caps
```

## Arc Testnet constants

```ts
import {
  arcTestnet, X402_NETWORK, ARC_USDC_ADDRESS,
  ARC_TESTNET_CONTRACTS, ARC_TESTNET_ERC8004, explorerTxUrl
} from '@chainpearc/sdk/arc' // viem-only subpath; also re-exported from the root
```

| | |
|---|---|
| Chain id / x402 network | `5042002` / `eip155:5042002` |
| ChainPeRegistry | `0x79c7a22993A40A3c88355b737e6F608c6610c395` |
| PolicyVault | `0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81` |
| USDC (also the gas token) | `0x3600000000000000000000000000000000000000` |

Every address has an env override: `CHAINPE_REGISTRY_ADDRESS`,
`POLICY_VAULT_ADDRESS`, `ERC8004_REPUTATION_REGISTRY`; `ARC_RPC_URL` overrides
the RPC. Get testnet USDC at <https://faucet.circle.com> (select Arc Testnet).

Run the example (lists the live registry; set `PAID_URL` to also pay an endpoint):

```bash
CHAINPE_PRIVATE_KEY=0xYOUR_PRIVATE_KEY npx tsx examples/quickstart.ts
```

## License

MIT
