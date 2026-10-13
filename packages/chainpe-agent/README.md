# @chainpearc/agent

**Pre-built AI Agent with x402 Payment Capabilities on Arc Testnet**

ChainPe Agent is an AI agent SDK that can discover, pay for, and use monetized API services on the live ChainPeRegistry. Built on the Vercel AI SDK with support for Groq, OpenAI, Anthropic, Google Gemini and local Ollama models.

## Installation

```bash
npm install -g @chainpearc/agent
```

> `@chainpearc/*` is not published to npm yet. Until it is, build this repo (`npm install && npm run build`) and install by path: `npm install -g /path/to/ChainPe/packages/chainpe-agent`.

Or as a library:

```bash
npm install @chainpearc/agent
```

## Quick Start

### Prerequisites

Before you start, you'll need:
1. **LLM API Key** - Get a free Groq API key at https://console.groq.com/
2. **USDC** - Testnet USDC from <https://faucet.circle.com> (select Arc Testnet); it also pays gas
3. **Arc Testnet Wallet** - Generate a new wallet or use existing private key

### 1. Initialize Configuration

```bash
chainpe-agent init
```

This interactive wizard will ask you for:
- **LLM Mode**: Local (Ollama) or Cloud API
- **LLM Provider**: Groq (free), OpenAI, Anthropic, or Google Gemini
- **Model selection**: Recommended models shown first
- **API key**: Your LLM provider API key
- **Wallet**: import a private key (0x…) or generate a new wallet. The key is stored in the OS keychain, never in a file
- **Registry address**: leave blank to use the live Arc Testnet registry (`0x79c7a22993A40A3c88355b737e6F608c6610c395`)

### 2. Check Status

```bash
chainpe-agent status
```

### 3. Run Tasks

```bash
chainpe-agent run "Find a weather service and get the weather for San Francisco"
```

## Commands

| Command | Description |
|---------|-------------|
| `chainpe-agent init` | Interactive setup wizard |
| `chainpe-agent status` | Show config and wallet balance |
| `chainpe-agent services` | List services on the registry (no config needed) |
| `chainpe-agent security` | Show how the wallet key is stored and safety recommendations |
| `chainpe-agent run <task> [-p <service>] [-v]` | Execute a task with the agent |

## Programmatic Usage

```typescript
import { ChainPeAgent } from "@chainpearc/agent";

// Create agent (reads config from ~/.chainpe/agent.json)
const agent = new ChainPeAgent();

// List available services
const services = await agent.listServices();
console.log(services);

// Run a task
const result = await agent.run(
  "Find a research service and summarize quantum computing",
  {
    maxSteps: 5,
    verbose: true,
    onPayment: (receipt) => {
      console.log(`Paid ${receipt.amount} ${receipt.token}`);
    }
  }
);

console.log(result.text);
console.log(`Total spent: ${result.payments.totalSpent.USDC} USDC`);
```

## How It Works

```
User Task → AI Agent → Discovers Services → Pays via x402 → Gets Response
                ↓
           On-Chain Registry (Arc Testnet)
```

1. Agent receives a task from user
2. Agent queries on-chain registry for relevant services
3. Agent calls service, receives 402 Payment Required
4. Agent signs x402 payment authorization
5. Service returns data, agent processes and responds

## Configuration

The agent stores config in `~/.chainpe/agent.json`. The wallet's private key is
**not** in this file: it lives in the OS keychain (macOS Keychain, Windows
Credential Manager, libsecret on Linux).

```json
{
  "llm": {
    "mode": "api",
    "provider": "groq",
    "model": "qwen/qwen3-32b",
    "apiKey": "gsk_..."
  },
  "wallet": {
    "address": "0xYourAgentWalletAddress",
    "useKeychain": true
  },
  "payment": {
    "preferredToken": "USDC"
  },
  "registryPath": "~/.chainpe/registry.json",
  "network": "arc-testnet"
}
```

For OpenAI use `"provider": "openai", "model": "gpt-4o"`. For local Ollama use:

```json
"llm": {
  "mode": "local",
  "provider": "openai",
  "model": "qwen2.5:7b",
  "apiKey": "ollama",
  "baseURL": "http://localhost:11434/v1"
}
```

`registryAddress` is optional and defaults to the live Arc Testnet registry;
`CHAINPE_REGISTRY_ADDRESS`, `ERC8004_REPUTATION_REGISTRY` and `ARC_RPC_URL`
override the defaults.

## Supported LLMs

The wizard offers these (`DEFAULT_MODELS`); any model id your provider serves works:

- **Groq** (free tier): `qwen/qwen3-32b`, `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`
- **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`
- **Anthropic**: `claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`
- **Google Gemini**: `gemini-2.0-flash`, `gemini-1.5-pro-latest`, `gemini-1.5-flash-latest`
- **Local (Ollama)**: Any Ollama model (free, runs locally)

### Getting API Keys

- **Groq** (Free): https://console.groq.com/ - Fast inference, generous free tier
- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/
- **Google AI**: https://aistudio.google.com/app/apikey

## Requirements

- Node.js >= 18
- LLM API key (Groq recommended for free tier) OR local Ollama installation
- EVM wallet with testnet USDC (<https://faucet.circle.com>)

## License

MIT
