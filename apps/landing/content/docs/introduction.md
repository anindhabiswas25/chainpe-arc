---
id: introduction
title: Introduction
description: ChainPe — decentralized x402 API marketplace on Arc Testnet
sidebar_position: 1
slug: /
---

# ChainPe

**ChainPe is payment + reputation infrastructure for the Arc Testnet agent economy.**

Providers monetize any HTTP API (or AI agent) per request in USDC with one command. AI agents discover, pay for, and rate those services autonomously. A non-custodial facilitator settles on **Arc Testnet**, and every paid call builds portable on-chain **ERC-8004 reputation**.

## The core insight

You build an AI agent and it needs to call a paid API. What do you do today? You hardcode an API key. You prepay a subscription. You pray it doesn't leak.

There is no way for the agent to pay per call autonomously — and no way for it to know which provider to trust. The missing layer is **payment + reputation rails built for machines**: pay-per-request, settled on-chain, with portable on-chain trust.

ChainPe is that layer, on Arc Testnet.

## Payments in three lines

```ts
import { ChainPe } from '@chainpearc/sdk'

const cp = new ChainPe({ privateKey: process.env.PRIVATE_KEY!, network: 'arc-testnet' })
const res = await cp.fetch('https://api.example.com/paid')  // auto-pays a 402 in USDC
const data = await res.json()
```

`cp.fetch` is a drop-in `fetch` replacement. On a `402 Payment Required` response it signs a USDC payment (EIP-3009), retries, and returns the successful response. The agent only needs USDC — the non-custodial facilitator pays gas.

## Key components

| Component | Description |
|---|---|
| **ChainPeRegistry** | On-chain registry of x402-gated services. Providers register; agents discover. Keyed by `keccak256(developer, name)`. |
| **ERC-8004 Reputation** | Portable agent identity + reputation. Every paid call can build score; self-feedback is blocked on-chain. |
| **PolicyVault** | Programmable, gasless spending policy. Owners set per-call caps, daily limits, and allowlists. The chain enforces every constraint. |
| **x402 Proxy** | The `@chainpearc/cli` package starts a payment-gated reverse proxy in front of any backend. No code changes to the backend. |
| **Facilitator** | Non-custodial x402 `verify`/`settle` service that submits payer-signed USDC transfers and pays Arc Testnet gas. |
| **Indexer** | Watches on-chain events → Postgres → O(1) REST discovery and reputation API. |
| **Dashboard** | Next.js marketplace to browse reputation-ranked services and register via MetaMask. |

## ChainPe vs traditional approaches

| Feature | API Keys / Stripe | ChainPe |
|---|---|---|
| Agent can sign up autonomously | No — requires a human | Yes |
| Pay per single call | No — subscriptions only | Yes |
| Provider knows counterparty | No — anonymous | Yes — on-chain identity (ERC-8004) |
| Trust is portable across apps | No — locked to one platform | Yes — cross-app, cross-chain |
| Agent spending capped on-chain | No | Yes — PolicyVault |
| Agent needs native gas token | — | No — facilitator covers gas |

## Who ChainPe is for

### Merchants (API sellers / providers)

You have an API, an LLM agent, or any HTTP service that produces value. You want to monetize it per-call without API keys, subscriptions, or credit card integrations. You run `chainpe init && chainpe start && chainpe register` and the x402 proxy gates each request. You receive USDC directly to your wallet — no intermediary holds funds.

### AI Agent Builders (buyers)

You build autonomous agents that call external services. You want those agents to pay for what they use, without hardwired API keys that can leak, and with a way to discover trustworthy services ranked by real on-chain reputation. You install `@chainpearc/sdk` or `@chainpearc/ai-tools` and your agent gains the ability to discover, pay, and rate services in the same loop.

### End Users / Operators

You deploy an agent on behalf of users and want fine-grained control over how much it can spend. You deploy a PolicyVault, deposit USDC, set per-call caps and daily limits, and grant the agent a session key. If the agent tries to exceed a limit, the Arc Testnet chain rejects the transaction outright — not a backend check, the chain.

## Infrastructure, not a single app

ChainPe is infrastructure. Claude/MCP is just one client. The same payment + reputation core powers:

| Surface | Package | Description |
|---|---|---|
| SDK | `@chainpearc/sdk` | Payments + reputation in 3 lines for any Node/TS project |
| Agent tools | `@chainpearc/ai-tools` | Vercel AI SDK + LangChain tool adapters |
| CLI | `@chainpearc/cli` | Provider proxy + consumer `fetch`/`discover` commands |
| Claude wallet | `chainpe-wallet-mcp` | MCP extension — Claude gets an Arc Testnet x402 wallet |
| Agent SDK | `@chainpearc/agent` | Standalone LLM agent loop that discovers and pays |
| Dashboard | `apps/dashboard` | Next.js marketplace UI |
| Facilitator | `services/chainpe-facilitator` | Non-custodial x402 verify/settle (self-hosted) |
| Indexer | `services/chainpe-indexer` | Events → Postgres → O(1) REST API |

## Deployment status

ChainPe is **live on Arc Testnet** (chain id 5042002) since 2026-10-13:

| | |
|---|---|
| ChainPeRegistry | [`0x79c7a22993A40A3c88355b737e6F608c6610c395`](https://explorer.testnet.arc.io/address/0x79c7a22993A40A3c88355b737e6F608c6610c395) |
| PolicyVault | [`0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81`](https://explorer.testnet.arc.io/address/0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81) |
| ERC-8004 | Arc's canonical Identity / Reputation / Validation registries |

Every package defaults to these addresses. The facilitator and indexer are
self-hosted: you run your own (see [Self-hosting the facilitator](./self-hosting/facilitator.md)).
Full details are on the [Smart Contracts](./smart-contracts/overview.md#deployments) page.

## Next steps

- [Quickstart](./getting-started/quickstart.md) — make your first paid API call in minutes
- [Concepts](./concepts/overview.md) — understand x402, ERC-8004, and PolicyVault
- [SDK Reference](./sdk-reference/chainpe-sdk.md) — full API documentation
- [Smart Contracts](./smart-contracts/overview.md) — contract addresses and ABI reference
