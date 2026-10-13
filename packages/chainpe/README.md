# @chainpearc/cli

**Monetize any API with x402 micropayments on Arc Testnet**

`chainpe` is a reverse proxy that sits in front of your HTTP API and enforces an
x402 v2 payment on every request. One command, zero backend changes, real USDC
settlements on Arc Testnet through your self-hosted facilitator. The same binary
also registers your service on the live ChainPeRegistry and lets you pay and
discover other services from the terminal.

## Installation

```bash
npm install -g @chainpearc/cli
```

> `@chainpearc/*` is not published to npm yet. Until it is, build this repo (`npm install && npm run build`) and install by path: `npm install -g /path/to/ChainPe/packages/chainpe`.

## Quick start

You need a wallet address to receive USDC and a running facilitator
([`services/chainpe-facilitator`](../../services/chainpe-facilitator), default
`http://localhost:4500`).

```bash
export CHAINPE_FACILITATOR_URL=http://localhost:4500
chainpe init        # guided setup → ~/.chainpe/config.json
chainpe start       # x402 proxy on :4402 in front of your API
chainpe register    # publish on ChainPeRegistry (1 USDC fee)
```

`chainpe init` asks for your API URL, service name, description, tags, price per
request (USDC), the wallet address that receives payments, the proxy port and
the facilitator URL. It never asks for a private key.

After `chainpe start`, every request to `http://localhost:4402/*` answers
`402 Payment Required` with a `PAYMENT-REQUIRED` header until the caller pays:

```json
{ "x402Version": 2,
  "accepts": [{ "scheme": "exact", "network": "eip155:5042002", "amount": "1000",
                "asset": "0x3600000000000000000000000000000000000000",
                "payTo": "0xYourWallet", "maxTimeoutSeconds": 300,
                "extra": { "name": "USDC", "version": "2" } }] }
```

`chainpe register` asks for the public endpoint and how to sign:

- **Browser wallet (MetaMask):** opens a local page; approve the USDC fee and the
  registration there.
- **Paste private key:** signs in the terminal and also mints an ERC-8004
  identity for the wallet, so paid calls build on-chain reputation.

Registration costs **1 USDC** (the registry's `registrationFee`) plus gas, which
is also USDC on Arc. Get testnet USDC at <https://faucet.circle.com> (select Arc
Testnet).

## Commands

| Command | Description |
|---------|-------------|
| `chainpe init` | Interactive setup wizard |
| `chainpe start [-p <port>] [-v] [--facilitator <gasKey>]` | Start the x402 payment proxy. `--facilitator` settles in-process with a USDC-funded gas key instead of an external facilitator |
| `chainpe register` | Register or update your service on ChainPeRegistry |
| `chainpe deregister` | Remove your service from the registry |
| `chainpe list` | List every service on the registry (no config needed) |
| `chainpe status` | Show config, wallet USDC balance and registration state |
| `chainpe fetch <url> [--max <usdc>] [--feedback] [--raw]` | Fetch a URL as a consumer, auto-paying a 402 in USDC (`CHAINPE_PRIVATE_KEY` or `-k`) |
| `chainpe discover [query] [--tag <tag>] [--max-price <usdc>] [--json]` | List services ranked by ERC-8004 reputation |

```bash
$ CHAINPE_PRIVATE_KEY=0xYOUR_PRIVATE_KEY chainpe fetch --feedback "http://localhost:4402/weather?city=London"
  ✓ 200
    Paid:     0.001 USDC → 0x1718…8290 on arc-testnet
    Tx:       https://explorer.testnet.arc.io/tx/0x7f8c948d…
    Rated:    agent 897287 +100 (ERC-8004)
```

## How it works

```
Client → ChainPe proxy ──402 + PAYMENT-REQUIRED──▶ Client signs EIP-3009 (USDC)
Client ──PAYMENT-SIGNATURE──▶ proxy ──/verify, /settle──▶ facilitator ──▶ Arc Testnet
proxy ──▶ your API ──▶ 200 + PAYMENT-RESPONSE (settlement tx)
```

The payer only signs. The facilitator submits `transferWithAuthorization` and
pays the gas; USDC moves straight from the payer to your wallet.

## Configuration

Contract addresses default to the live Arc Testnet deployment:

| | Default | Override |
|---|---|---|
| ChainPeRegistry | `0x79c7a22993A40A3c88355b737e6F608c6610c395` | `CHAINPE_REGISTRY_ADDRESS` or `registryAddress` in `~/.chainpe/config.json` |
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `ERC8004_IDENTITY_REGISTRY` |
| RPC | `https://rpc.testnet.arc.io` | `ARC_RPC_URL` |
| Facilitator | none | `CHAINPE_FACILITATOR_URL`, or `chainpe start --facilitator <gasKey>` |

## Programmatic usage

```ts
import { startProxyServer } from '@chainpearc/cli'

const { server } = await startProxyServer({
  config: {
    serviceName: 'Weather API', serviceDescription: 'Current weather', tags: ['weather'],
    targetUrl: 'http://localhost:3001',          // your backend
    pricePerRequest: '0.01', paymentToken: 'USDC',
    walletAddress: process.env.WALLET_ADDRESS!,  // receives USDC
    proxyPort: 4402, network: 'arc-testnet',
    facilitatorUrl: process.env.CHAINPE_FACILITATOR_URL
  }
})
```

The package also re-exports the Arc constants (`arcTestnet`, `X402_NETWORK`,
`ARC_TESTNET_CONTRACTS`, …) and `ChainPeRegistryClient` for reading and writing
the registry. See [PROVIDER-SETUP.md](./PROVIDER-SETUP.md) for a longer walkthrough.

## Requirements

- Node.js >= 18
- A wallet address on Arc Testnet (USDC is the only asset you need; it is also the gas token)

## License

MIT
