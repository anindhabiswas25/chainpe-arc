---
id: agent-integration
title: Agent Integration
sidebar_position: 4
---

# Agent Integration

This page covers integrating ChainPe into autonomous agents — systems that discover, pay for, and compose API services without human intervention.

## @chainpearc/agent

The `@chainpearc/agent` package provides a standalone LLM agent loop that discovers and pays for ChainPe services. It is built on the Vercel AI SDK and works with Groq, OpenAI, Anthropic, Gemini or a local Ollama model.

### Installation

```bash
npm install @chainpearc/agent
```

> Not on npm yet: until the `@chainpearc/*` packages are published, [install from source](../getting-started/installation.md).

### Configuration

Run `chainpe-agent init` once. It stores the LLM settings in
`~/.chainpe/agent.json` and the wallet key in the OS keychain. Then:

```ts
import { ChainPeAgent } from '@chainpearc/agent'

const agent = new ChainPeAgent()   // reads ~/.chainpe/agent.json; live Arc Testnet registry by default

const result = await agent.run('Summarize the latest AI news', {
  maxSteps: 10,
  onPayment: (receipt) => console.log(`paid ${receipt.amount} ${receipt.token}`)
})
console.log(result.text, result.payments.totalSpent.USDC)
```

To skip the config file, pass `new ChainPeAgent({ config })`; see the
[agent reference](../sdk-reference/chainpe-agent.md) for the shape.

### Available tools in the agent

The `@chainpearc/agent` exposes these built-in tools:

| Tool | Description |
|---|---|
| `callPaidApi` | Call an x402-gated URL and auto-pay in USDC |
| `callFreeApi` | Call a free (non-402) URL |
| `discoverService` | Search and rank the ChainPe registry |

### Tool source files

- `packages/chainpe-agent/src/tools/callPaidApi.ts`
- `packages/chainpe-agent/src/tools/callFreeApi.ts`
- `packages/chainpe-agent/src/tools/discoverService.ts`

## chainpe-wallet-mcp (Claude Desktop)

The `chainpe-wallet-mcp` MCP extension gives Claude Desktop an Arc Testnet x402 wallet. After building and installing it, Claude can:

1. Search the marketplace (`search_bazaar`)
2. Make paid API calls (`x402_fetch`)
3. Transfer USDC (`transfer_usdc`)
4. Check its balance (`check_balance`)
5. Post reputation feedback (`give_feedback`)
6. View spending reports (`spending_report`)

### MCP tools exposed

| Tool | Description |
|---|---|
| `search_bazaar` | Search the ChainPe marketplace, ranked by ERC-8004 reputation |
| `x402_fetch` | Fetch a URL, auto-paying the x402 402 in USDC |
| `pay` | Sign an x402 payment and return the `PAYMENT-SIGNATURE` header for a manual retry |
| `transfer_usdc` | Transfer USDC to another wallet |
| `check_balance` | Read the wallet's USDC balance (`{ address, network, mode, usdc, gasNote }`) |
| `give_feedback` | Post ERC-8004 reputation feedback for a provider |
| `spending_report` | Summary of recent payments |
| `request_funding` | Generate an EIP-681 payment link (and plain address) asking someone to send USDC to this wallet |

### Building the MCP extension

```bash
cd packages/chainpe-wallet
npm install
npm run build:mcpb  # produces chainpe.mcpb
```

Double-click `chainpe.mcpb` to install into Claude Desktop. See `packages/chainpe-wallet/README.md` for full setup.

## Pattern: buyer agent hiring seller agents

The seller-agent example in `examples/seller-agents/` demonstrates a buyer agent that discovers and hires two seller agents:

```bash
cd examples/seller-agents
cp .env.example .env   # fill in keys (the sellers need ANTHROPIC_API_KEY)
npm install

# Launch the seller agents and register them on the live registry (1 USDC each)
REGISTER=1 ./launch.sh

# Run the buyer agent
npm run orchestrate -- "summarize latest AI research"
```

The buyer agent:
1. Calls `discoverService` → gets ranked list with ERC-8004 scores
2. Calls the first seller agent (pays USDC) → gets partial result
3. Calls the second seller agent (pays USDC) → gets another result
4. Composes both results and returns the answer
5. Posts reputation feedback for both sellers (if `autoFeedback: true`)

Each seller agent:
- Runs behind the ChainPe x402 proxy
- Registers on `ChainPeRegistry` with an ERC-8004 identity
- Advertises its `agentId` on the 402 response

## Pattern: autonomous spending with PolicyVault

For long-running agents with controlled budgets:

```ts
import { PolicyVaultClient } from '@chainpearc/sdk'

// Setup (done once by the operator)
const owner = new PolicyVaultClient({
  privateKey: process.env.OPERATOR_KEY!   // targets the live PolicyVault 0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81
})
await owner.deposit('100.00')
await owner.setPolicy({
  sessionKey: '0xAgentSessionKey',
  maxPerCall: '0.10',
  dailyCap: '5.00',
  totalBudget: '100.00',
  expiry: Math.floor(Date.now() / 1000) + 30 * 86400,
  allowlistOnly: false
})

// Agent loop (gasless)
const agent = new PolicyVaultClient({
  privateKey: process.env.AGENT_SESSION_KEY!
})

// Agent signs (no gas) — relayer submits
const auth = await agent.signSpend({
  owner: '0xOperatorAddress',
  to: '0xProviderWallet',
  amount: '0.01'
})

// Relayer (could be the facilitator or any funded key)
const relayer = new PolicyVaultClient({
  privateKey: process.env.RELAYER_KEY!
})
const txHash = await relayer.relaySpend(auth)
```
