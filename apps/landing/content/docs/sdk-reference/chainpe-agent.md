---
id: sdk-reference-agent
title: "@chainpearc/agent"
sidebar_position: 4
---

# @chainpearc/agent

Standalone LLM agent loop for autonomous discovery and payment of ChainPe services.

## Installation

```bash
npm install @chainpearc/agent
```

> Not on npm yet: until the `@chainpearc/*` packages are published, [install from source](../getting-started/installation.md).

## Key exports

```ts
// Agent
export { ChainPeAgent, createAgent, type ChainPeAgentOptions } from './agent.js'

// Config (~/.chainpe/agent.json) and OS-keychain key storage
export { loadConfig, saveConfig, configExists, buildConfig, getConfigPath, DEFAULT_MODELS,
         saveWalletToKeychain, getWalletPrivateKey, isWalletAvailable } from './config.js'
export { savePrivateKey, getPrivateKey, deletePrivateKey, hasPrivateKey,
         listStoredWallets, isKeychainAvailable } from './keychain.js'

// Wallet, registry, payments, reputation
export { getWalletBalance, formatBalance, createWalletFromPrivateKey } from './wallet.js'
export { RegistryClient, searchServices, findServiceByName } from './registry.js'
export { PaymentClient, createPaymentClient } from './payment.js'
export { getReputation, giveFeedback, resolveReputationRegistry } from './reputation.js'

// Vercel AI SDK tools the agent runs on
export { createDiscoverServiceTool, createCallPaidApiTool, createCallFreeApiTool } from './tools/index.js'
```

## ChainPeAgent

The top-level orchestrator that combines LLM inference with ChainPe tools. With
no arguments it reads `~/.chainpe/agent.json` (written by `chainpe-agent init`)
and takes the wallet key from the OS keychain.

```ts
import { ChainPeAgent } from '@chainpearc/agent'

const agent = new ChainPeAgent()            // or: new ChainPeAgent({ config, verbose: true })

const services = await agent.listServices() // the live ChainPeRegistry

const result = await agent.run('Find a weather API and get conditions in Paris', {
  maxSteps: 10,
  onPayment: (receipt) => console.log(`paid ${receipt.amount} ${receipt.token}`, receipt.txId)
})

result.text                          // the answer
result.success                       // boolean
result.payments.transactionCount     // number of paid calls
result.payments.totalSpent.USDC      // human USDC
```

`run(task, options?)` options: `provider` (service name to prefer), `maxSteps`,
`verbose`, `onStep(step)`, `onPayment(receipt)`.

The config object (`AgentConfig`):

```ts
{
  llm: { mode: 'api' | 'local', provider: 'groq' | 'openai' | 'anthropic' | 'gemini',
         model: string, apiKey: string, baseURL?: string },
  wallet: { address: string, useKeychain?: boolean },   // the key lives in the OS keychain
  payment: { preferredToken: 'USDC' },
  network?: 'arc-testnet',
  registryAddress?: string,     // defaults to the live registry 0x79c7a22993A40A3c88355b737e6F608c6610c395
  reputationRegistry?: string   // defaults to Arc's canonical ERC-8004 Reputation Registry
}
```

## Built-in tools

The agent's tools are Vercel AI SDK tools you can also mount in your own
`generateText` loop.

### discoverService

Searches and ranks the ChainPe registry. `createDiscoverServiceTool({ registryClient, network, reputationRegistry? })`.

```ts
// Input
{ query?: string; tags?: string[]; maxPrice?: string; paymentToken?: 'USDC' }
```

### callPaidApi

Calls a registered service by name, auto-paying its x402 challenge in USDC.
`createCallPaidApiTool({ paymentClient, registryClient, providerHint?, privateKey?, network?, reputationRegistry? })`;
passing `privateKey` enables automatic ERC-8004 feedback after a paid call.

```ts
// Input
{ serviceName: string; path?: string; method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: Record<string, unknown> }
```

### callFreeApi

Calls a non-402 URL. `createCallFreeApiTool()`.

```ts
// Input
{ url: string; method?: string; headers?: Record<string, string>; body?: unknown }
```

## PaymentClient

Direct x402 payment without the agent loop:

```ts
import { PaymentClient } from '@chainpearc/agent'

const client = new PaymentClient({ privateKey, maxPerPayment: '0.10' })
const res = await client.fetch('https://api.example.com/data')   // pays a 402 if asked

client.getReceipts()          // PaymentReceipt[]
client.getTotalSpent().USDC   // human USDC
```

For application code, [`@chainpearc/sdk`](./chainpe-sdk.md)'s `ChainPe` class is the
simpler way to pay.

## Key storage

```ts
import { savePrivateKey, getPrivateKey, hasPrivateKey, isKeychainAvailable } from '@chainpearc/agent'

if (await isKeychainAvailable()) {
  await savePrivateKey(walletAddress, privateKey)   // macOS Keychain / Windows Credential Manager / libsecret
  const key = await getPrivateKey(walletAddress)
}
```

## CLI

```bash
chainpe-agent init                 # LLM + wallet setup; the key goes to the OS keychain
chainpe-agent status               # config, USDC balance, registry contract
chainpe-agent services             # services on the live registry (no config needed)
chainpe-agent security             # how the key is stored
chainpe-agent run "summarize the latest AI research" --verbose
```
