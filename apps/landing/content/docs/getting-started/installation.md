---
id: installation
title: Installation
sidebar_position: 3
---

# Installation

ChainPe is a monorepo. Most users only need one or two packages. Install exactly what you need.

## Install from source (until the packages are on npm)

The `@chainpearc/*` packages are not published to npm yet, so the `npm install @chainpearc/...` commands below won't work until they are. In the meantime, build them from the repo:

```bash
git clone https://github.com/anindhabiswas25/chainpe-arc.git ChainPe
cd ChainPe
npm install
npm run build:sdk          # build the SDK first; the other packages depend on it
npm run build

# then, in your project:
npm install /path/to/ChainPe/packages/chainpe-sdk        # @chainpearc/sdk
npm install /path/to/ChainPe/packages/chainpe-ai-tools   # @chainpearc/ai-tools
npm install -g /path/to/ChainPe/packages/chainpe         # @chainpearc/cli (the `chainpe` command)
```

If `npm run build` fails with `Cannot find module @rollup/rollup-linux-x64-gnu`, that's a known npm optional-dependency bug. Run `npm i --no-save @rollup/rollup-linux-x64-gnu` (match the installed rollup version) and build again.

## Core SDK

The primary package for making x402 payments and reading/writing ERC-8004 reputation:

```bash
npm install @chainpearc/sdk
# or
pnpm add @chainpearc/sdk
```

**Peer dependencies:** None. The SDK depends on `viem` and the x402 v2 packages (`@x402/core`, `@x402/evm`).

**Node version:** 18+ required (uses native `fetch`, top-level await in examples).

## AI Framework Tools

Vercel AI SDK and LangChain tool adapters — drop-in `chainpeFetch` and `discoverService` tools:

```bash
npm install @chainpearc/ai-tools
```

If using the Vercel AI SDK adapter:
```bash
npm install ai @ai-sdk/anthropic   # or @ai-sdk/openai, etc.
```

If using the LangChain adapter:
```bash
npm install @langchain/core @langchain/langgraph
```

## CLI

The provider proxy and consumer command-line tool:

```bash
npm install -g @chainpearc/cli
# then
chainpe --help
```

Or use it without installing globally:
```bash
npx @chainpearc/cli discover
npx @chainpearc/cli fetch <url>
```

## Standalone Agent SDK

The `@chainpearc/agent` package provides a self-contained LLM agent loop that discovers and pays for services:

```bash
npm install @chainpearc/agent
```

## Claude MCP Wallet

The `chainpe-wallet-mcp` package gives Claude Desktop an Arc Testnet x402 wallet with 8 tools. It is built as a binary, not published to npm. See `packages/chainpe-wallet/README.md` in the repository for build and install instructions.

## Environment variables

All packages read from environment variables. The minimum set for making payments:

```bash
# Your EOA private key — signs EIP-3009 USDC authorizations
CHAINPE_PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# Contract addresses default to the live Arc Testnet deployment. Override only
# to target your own contracts:
# CHAINPE_REGISTRY_ADDRESS=0x79c7a22993A40A3c88355b737e6F608c6610c395
# POLICY_VAULT_ADDRESS=0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81
# ERC8004_REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713

# Optional RPC override
# ARC_RPC_URL=https://rpc.testnet.arc.io
```

That single key is all a consumer needs. Providers also set `CHAINPE_FACILITATOR_URL` (their self-hosted facilitator). `.env.example` in the repo root lists every variable, and the live addresses are under [Deployments](../smart-contracts/overview.md#deployments). Never commit a `.env` file with real keys.

## TypeScript configuration

The SDK ships full TypeScript types. It uses ES module output, so ensure your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

Or if using CommonJS in your project, use a dynamic import:

```ts
const { ChainPe } = await import('@chainpearc/sdk')
```
