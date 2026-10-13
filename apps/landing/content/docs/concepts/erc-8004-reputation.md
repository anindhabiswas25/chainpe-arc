---
id: erc-8004-reputation
title: ERC-8004 Reputation
sidebar_position: 3
---

# ERC-8004 Reputation

ERC-8004 is a proposed Ethereum standard for portable agent identity and reputation. ChainPe implements and deploys the ERC-8004 reference contracts on Arc Testnet, using them to build on-chain trust for API providers.

## What is ERC-8004?

ERC-8004 defines a set of on-chain registries for autonomous AI agents:

- **IdentityRegistry**: Each agent mints an NFT (ERC-721) that represents its identity. The token id becomes the agent's `agentId`. One wallet, one identity.
- **ReputationRegistry**: Counterparties post scored feedback (0–100) for a given `agentId`. The contract enforces that the feedback poster is distinct from the recipient — self-rating is blocked on-chain.
- **ValidationRegistry**: Attests that an agent has passed external validation checks (e.g. audits, certifications). Used for additional trust signals.

The key property is **portability**: reputation is not locked to one platform. Any app, agent, or contract that reads the ReputationRegistry can see the same score.

## How ChainPe uses ERC-8004

### Provider identity

When a provider registers a service via `chainpe register` or `register-seller.mjs`, the CLI automatically:

1. Checks whether the provider's wallet already has an ERC-8004 identity token
2. If not, calls `IdentityRegistry.register('chainpe://seller-agent')` to mint one
3. Stores the resulting `agentId` in the local config and in the on-chain `ChainPeRegistry` service record

This links the service listing to the provider's portable identity.

### Feedback after paid calls

After a successful paid call, clients can post feedback to the ReputationRegistry:

```ts
// Explicit feedback
await cp.giveFeedback('42', 100, { tag: 'x402-success' })

// Automatic feedback after every paid call
const cp = new ChainPe({ privateKey, network: 'arc-testnet', autoFeedback: true })
await cp.fetch('https://api.example.com/paid')  // posts score 100 automatically
```

The `giveFeedback` method calls `ReputationRegistry.giveFeedback(agentId, score, endpoint, tag)` on-chain.

### Discovery ranking

`cp.discover()` returns services ranked by reputation:

```ts
const services = await cp.discover()
// services[0] has the highest reputation score
// services with no agentId or no feedback appear last
```

The ranking is: scored services (highest score first) → unscored services. This incentivizes providers to register an identity and deliver good service.

### Self-feedback blocking

The ReputationRegistry's `giveFeedback` function reverts if `msg.sender == agentId.owner`. A provider cannot inflate their own score. The contract checks this on-chain — no off-chain enforcement is needed.

## Deployed contracts (Arc Testnet)

ChainPe uses **Arc's canonical ERC-8004 registries** (reference implementation v2.0.0), which other Arc agents use too:

| Registry | Address |
|---|---|
| IdentityRegistry | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://explorer.testnet.arc.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| ReputationRegistry | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://explorer.testnet.arc.io/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |
| ValidationRegistry | [`0x8004Cb1BF31DAf7788923b405b754f57acEB4272`](https://explorer.testnet.arc.io/address/0x8004Cb1BF31DAf7788923b405b754f57acEB4272) |

The SDK, CLI and dashboard default to these; override with `ERC8004_IDENTITY_REGISTRY` / `ERC8004_REPUTATION_REGISTRY`. All three sit behind UUPS (ERC-1967) proxies.

## Reading reputation

```ts
import { ChainPe } from '@chainpearc/sdk'

const cp = new ChainPe({ privateKey, network: 'arc-testnet' })

// Get reputation for a specific agentId
const rep = await cp.getReputation('42')
if (rep) {
  console.log('Score:', rep.score)  // null if no feedback yet
  console.log('Ratings:', rep.count)
}
```

Or via the indexer REST API (no wallet needed):

```bash
curl "$INDEXER_URL/services/developer:service-name/reputation"
# { "count": 15, "score": 87.3 }
```

## Reputation fields

```ts
interface ReputationSummary {
  /** Number of distinct counterparties that posted feedback */
  count: number
  /** Aggregate score 0-100, or null when no feedback exists */
  score: number | null
}
```

## Why on-chain reputation matters for agents

1. **Permissionless trust**: Any agent can read the score without an account or API key
2. **Self-feedback blocked**: Cheating the score requires a real counterparty — not just a bot loop
3. **Portable**: The same agentId works across ChainPe, future platforms, and any contract that reads the ERC-8004 registries
4. **Composable**: Smart contracts can require a minimum reputation score before serving a request

:::note
The ERC-8004 standard is a proposal. The reference contracts deployed by ChainPe implement the draft spec. The spec may evolve. ChainPe will track the canonical ERC-8004 reference implementation.
:::
