---
id: faq
title: FAQ
sidebar_position: 10
---

# Frequently Asked Questions

## General

### What is ChainPe?

ChainPe is payment + reputation infrastructure for AI agents on Arc Testnet. It lets providers monetize any HTTP API per-call in USDC (via the x402 protocol), and lets AI agents discover, pay for, and rate those services autonomously — all on Arc Testnet.

### Is ChainPe custodial?

No. The facilitator is non-custodial. It only relays payer-signed USDC authorizations (EIP-3009) and cannot redirect or steal funds. Its key holds only the USDC it spends on gas (USDC is Arc's gas token). Payer USDC goes directly from the payer's wallet to the provider's wallet.

### What blockchain does ChainPe use?

Circle's Arc Testnet (chain id 5042002). It is the only supported network today; there is no mainnet deployment. USDC is the payment token and also [the gas token on Arc](https://docs.arc.io/arc/concepts/stable-fee-design).

### Is this just for Claude/AI?

No. Claude/MCP is one client. The same payment core drives an SDK (`@chainpearc/sdk`), Vercel AI SDK tools, LangChain tools, a CLI, and a standalone agent SDK. Any application that can make HTTP requests can use ChainPe.

---

## Payments

### Does the agent need a separate gas token?

No. On Arc, gas is paid in USDC, so there's no second coin. For x402 payments the agent doesn't pay gas at all: it signs an authorization, and the provider's facilitator submits it and pays the gas. For direct transactions (registering a service, a PolicyVault relayer, transfers), gas comes out of the same USDC balance.

### What is the minimum payment amount?

There is no minimum set in the protocol. In practice, the minimum meaningful amount is 0.000001 USDC (1 atomic unit, 6 decimals). Service prices are set by the provider. The registry's registration fee is set by its owner. Read it with `registrationFee()`.

### What if the facilitator goes down?

Payments cannot settle while the facilitator is down. The agent will receive a `402` after payment (the facilitator could not settle). The agent can retry. ChainPe doesn't run a shared facilitator. Providers run their own: see [Self-hosting the facilitator](./self-hosting/facilitator.md). For local development, `chainpe start --facilitator <key>` runs one in-process.

### Do I need anything besides USDC?

No. Get testnet USDC from [faucet.circle.com](https://faucet.circle.com) (select Arc Testnet). It pays for API calls and for gas.

### What is EIP-3009?

EIP-3009 (`transferWithAuthorization`) is a standard for gasless USDC transfers. The token holder signs a message off-chain authorizing a specific transfer (amount, recipient, validity window). A third party submits the signed message on-chain. This is how agents pay without spending gas.

---

## Registry

### How much does it cost to register a service?

**1 USDC** on the live Arc Testnet registry. The fee is set by the registry owner via `setRegistrationFee()`. Read the live value with `registrationFee()` (atomic USDC, 6 decimals), or see it printed by `chainpe register`. Updates have their own fee (`updateFee()`, which may be 0).

### Can I update my service listing after registering?

Yes. Call `chainpe register` again (the CLI detects an existing listing and calls `update()`), or call `ChainPeRegistry.update(ServiceInput)` directly. Updates cost `updateFee()` (0 means free).

### What is the service key?

Each service is identified by `keccak256(abi.encode(developer, name))`. This is a `bytes32` storage key. The indexer also uses `developer:name` as a human-readable id (e.g. `0xAbc...:My Service`).

### Can multiple providers have the same service name?

Yes — the key includes the developer address. `0xAlice:Weather` and `0xBob:Weather` are distinct listings.

---

## ERC-8004 Reputation

### What is ERC-8004?

A proposed Ethereum standard for portable agent identity and reputation. An IdentityRegistry mints NFT identities; a ReputationRegistry stores scored feedback from counterparties; a ValidationRegistry stores external attestations.

### Can providers inflate their own reputation?

The `ReputationRegistry` blocks self-feedback on-chain: if the feedback poster's address is the same as the identity owner's address, the transaction reverts. A provider would need a separate wallet acting as a fake buyer to post feedback — which costs gas and is detectable.

### Is ERC-8004 finalized?

It is a draft proposal. ChainPe implements the reference contracts and tracks the canonical spec. The contracts may evolve.

### What does a reputation score of 100 mean?

Each feedback call passes a `score` parameter (0-100). A score of 100 is the maximum positive rating. `cp.giveFeedback(agentId, 100)` is posted automatically when `autoFeedback: true`. The aggregate `score` in `ReputationSummary` is the mean of all feedback scores.

---

## PolicyVault

### Who pays gas for PolicyVault `spend()` calls?

The relayer — anyone who calls `PolicyVault.spend()`. The agent only signs the authorization off-chain. This is why agents can operate gaslessly even with PolicyVault.

### What happens if the session key leaks?

Call `revokeSession()` immediately from the owner wallet. After revocation, all future `spend()` calls with that session key revert with `"session inactive"`. The session key cannot move more than the policy allows — an attacker with the session key cannot exceed caps or pay unapproved recipients.

### Can I have multiple active sessions?

No. Each owner has one active `Policy`. Calling `setPolicy()` again replaces the current policy and resets `totalSpent` to zero.

---

## Development

### How do I run the tests?

```bash
# Workspace tests (SDK, ai-tools, etc.)
npm test

# Contract tests (Hardhat)
cd contracts && npm test
```

### Does ChainPe work with OpenAI models?

Yes. `@chainpearc/ai-tools` wraps the ChainPe SDK as framework-native tools, not model-native tools. The LangChain adapter works with any `ChatModel` including `ChatOpenAI`. The Vercel AI SDK adapter works with any provider that supports tool use.

### Can I run ChainPe completely locally?

Yes. Use:
1. `chainpe start --facilitator <key>`, or run `services/chainpe-facilitator` locally
2. The SDK reads from Arc Testnet RPC directly for registry/reputation
3. Skip the indexer: use `RegistryClient.listAllServices()` which reads on-chain

For a fully local environment, deploy `MockUSDC` and `ChainPeRegistry` to a local Hardhat node.

### What's the npm scope?

`@chainpearc`: `@chainpearc/sdk`, `@chainpearc/ai-tools`, `@chainpearc/agent`, `@chainpearc/cli`. They aren't published to npm yet; build them from the repo (see [Installation](./getting-started/installation.md)).
