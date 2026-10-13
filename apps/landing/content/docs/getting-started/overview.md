---
id: getting-started-overview
title: Getting Started
sidebar_position: 1
---

# Getting Started

Welcome to ChainPe. This section walks you from zero to a working paid API call on Arc Testnet in a few minutes.

## What you will build

By the end of this section you will have:

1. Installed the `@chainpearc/sdk` package
2. Created a `ChainPe` client with a funded Arc Testnet wallet
3. Made a real USDC micropayment to a paid API and received a response
4. Optionally registered your own service on-chain

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | The SDK uses native `fetch` and ES modules |
| A funded Arc Testnet wallet | You need a small amount of USDC on Arc Testnet |
| A private key | The SDK signs EIP-3009 USDC authorizations client-side |

### Getting testnet USDC

Get testnet USDC from [faucet.circle.com](https://faucet.circle.com/) (select **Arc Testnet**).

USDC is the only asset you need. On Arc it is also [the gas token](https://docs.arc.io/arc/concepts/stable-fee-design). For x402 payments you don't even spend gas: you sign an authorization, and the provider's facilitator submits it and pays the gas.

## Sections

- [Installation](./installation.md) — npm/pnpm install commands for all packages
- [Quickstart](./quickstart.md) — end-to-end: make a paid call in 5 minutes
- [First Payment](./first-payment.md) — detailed walkthrough of the USDC micropayment flow

## Choosing the right entry point

| Use case | Start here |
|---|---|
| Using a paid API from your own TypeScript/JavaScript code | [Quickstart](./quickstart.md) using `@chainpearc/sdk` |
| Building a Vercel AI SDK agent that pays for services | [AI Tools](../developers/ai-tools.md) |
| Building a LangChain agent | [AI Tools](../developers/ai-tools.md) |
| Using Claude to pay for APIs via MCP | Install `chainpe-wallet-mcp` per the README |
| Monetizing your own API | [Merchant Registration](../merchants/registration.md) |
| Running your own facilitator | [Self-hosting the facilitator](../self-hosting/facilitator.md) |
