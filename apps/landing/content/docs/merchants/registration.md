---
id: merchant-registration
title: Service Registration
sidebar_position: 2
---

# Service Registration

Registering your service on `ChainPeRegistry` makes it discoverable by agents through `cp.discover()`, the CLI's `chainpe discover`, and the marketplace dashboard.

## Prerequisites

- A funded Arc Testnet wallet — receives USDC payments
- USDC for the registration fee (**1 USDC** on the live registry; read it with `registrationFee()`, and `chainpe register` prints it) plus a little extra for gas, since gas on Arc is paid in USDC
- Your service running and accessible at a public URL (or `localhost` for testing)

## Option A: CLI (recommended)

### Step 1 — Initialize

```bash
chainpe init
```

The wizard prompts for:
- **API URL** — your backend URL (e.g. `http://localhost:3000`)
- **Service name** — displayed in the marketplace (min 3 chars)
- **Description** — at least 10 characters, shown in discovery results
- **Tags** — comma-separated keywords for search (e.g. `ai,research,documents`)
- **Price per request** — human-readable USDC (e.g. `0.01`)
- **Network** — `arc-testnet` (the only supported network)
- **Wallet address** — where to receive payments (0x... EVM address)
- **Proxy port** — default `4402`

Config is saved to `~/.chainpe/config.json`.

### Step 2 — Start the proxy

```bash
chainpe start
```

This starts the x402 proxy on the configured port. Test it:

```bash
curl http://localhost:4402/any-path
# Should return: 402 Payment Required
```

### Step 3 — Register on-chain

```bash
chainpe register
```

Choose between:
- **Browser wallet (MetaMask)** — opens a browser window to sign the transaction
- **Paste private key** — signs in the terminal and auto-mints an ERC-8004 identity

The CLI will:
1. Check if an ERC-8004 identity token exists for your wallet
2. If not, mint one (auto-links your service to a reputation identity)
3. Approve the USDC registration fee to the registry
4. Call `ChainPeRegistry.register(ServiceInput)`
5. Show the Arc Testnet explorer link for the transaction

## Option B: register-seller.mjs (non-interactive)

For CI/CD or scripted registration:

```bash
SELLER_KEY=0xYOUR_PRIVATE_KEY
SELLER_NAME="My Research Agent"
SELLER_ENDPOINT=https://api.example.com
SELLER_PAYTO=0xYourWalletAddress
SELLER_DESCRIPTION="AI-powered research and summarization"
SELLER_TAGS=ai,research,summarization
SELLER_PRICE=0.01
# CHAINPE_REGISTRY_ADDRESS defaults to the live registry 0x79c7a22993A40A3c88355b737e6F608c6610c395

node register-seller.mjs   # in examples/seller-agents
```

The script automatically mints an ERC-8004 identity if `SELLER_AGENT_ID` is not set.

## Option C: Direct contract call (TypeScript)

```ts
import { createWalletClient, createPublicClient, http, parseUnits, getAddress } from 'viem'
import { arcTestnet } from '@chainpearc/sdk'
import { privateKeyToAccount } from 'viem/accounts'

const REGISTRY_ADDRESS = '0x79c7a22993A40A3c88355b737e6F608c6610c395'
const USDC = '0x3600000000000000000000000000000000000000'

const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{
      name: 'input',
      type: 'tuple',
      components: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'tags', type: 'string' },
        { name: 'endpoint', type: 'string' },
        { name: 'pricePerRequest', type: 'string' },
        { name: 'paymentToken', type: 'string' },
        { name: 'network', type: 'string' },
        { name: 'payTo', type: 'address' },
        { name: 'agentId', type: 'uint256' }
      ]
    }],
    outputs: [{ name: 'key', type: 'bytes32' }]
  }
] as const

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const

const account = privateKeyToAccount('0xYOUR_PRIVATE_KEY')
const wallet = createWalletClient({ account, chain: arcTestnet, transport: http() })

// Step 1: Approve the 1 USDC registration fee (read registrationFee() for the live value)
await wallet.writeContract({
  account,
  chain: arcTestnet,
  address: USDC,
  abi: ERC20_ABI,
  functionName: 'approve',
  args: [REGISTRY_ADDRESS, parseUnits('1', 6)]  // 1 USDC
})

// Step 2: Register the service
const txHash = await wallet.writeContract({
  account,
  chain: arcTestnet,
  address: REGISTRY_ADDRESS,
  abi: REGISTRY_ABI,
  functionName: 'register',
  args: [{
    name: 'My Research Agent',
    description: 'AI-powered research and summarization service',
    tags: 'ai,research,summarization',
    endpoint: 'https://api.example.com',
    pricePerRequest: '0.01',
    paymentToken: 'USDC',
    network: 'arc-testnet',
    payTo: getAddress('0xYourWalletAddress'),
    agentId: 0n    // 0 = no ERC-8004 identity linked
  }]
})

console.log('Registered! Tx:', txHash)
```

## ServiceInput fields

| Field | Type | Max length | Description |
|---|---|---|---|
| `name` | string | 64 bytes | Unique per developer; becomes part of the storage key |
| `description` | string | 1024 bytes | Shown in discovery results |
| `tags` | string | 256 bytes | Comma-separated keywords |
| `endpoint` | string | 256 bytes | Public URL where clients connect |
| `pricePerRequest` | string | 32 bytes | Human-readable USDC (e.g. `"0.01"`) |
| `paymentToken` | string | — | `"USDC"` or `"USDC"` |
| `network` | string | — | `"arc-testnet"` (the only supported network) |
| `payTo` | address | — | Where to receive payments |
| `agentId` | uint256 | — | ERC-8004 agent identity; `0` if not linked |

## Updating a service

Call `chainpe register` again — the CLI detects an existing registration and calls `ChainPeRegistry.update(ServiceInput)` instead of `register`. The update fee is currently 0 (free updates).

## Deregistering

```bash
chainpe deregister
```

This calls `ChainPeRegistry.deregister(name)` from your wallet. The service is removed from the on-chain registry and will no longer appear in discovery results.
