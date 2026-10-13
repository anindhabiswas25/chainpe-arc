# ChainPe Wallet (MCP)

> Give Claude an EVM wallet that discovers and pays for services on the
> **ChainPe** on-chain registry — using the **x402** micropayment protocol.

ChainPe Wallet is a [Model Context Protocol](https://modelcontextprotocol.io)
server packaged as a Claude Desktop extension (`.mcpb`). Install it, drop in your
EVM wallet, set spending limits, and Claude can discover paid services,
pay for them within your budget, and return the results in the chat.

Discovery reads directly from the on-chain **ChainPeRegistry** contract on
Arc Testnet — no hosted backend or accounts required.

## How it works

1. **`search_bazaar`** reads the live ChainPeRegistry on Arc Testnet
   (`0x79c7a22993A40A3c88355b737e6F608c6610c395`) and lists registered services with their price
   and endpoint.
2. **`x402_fetch`** calls a service endpoint; on `402 Payment Required` it signs
   a USDC payment on Arc Testnet and retries — automatically.
3. A **spending tracker** enforces `MAX_PER_CALL` and `MAX_PER_DAY` (USDC)
   *before* any payment is signed.

Other tools: `check_balance`, `pay`, `transfer_usdc`, `spending_report`,
`request_funding`, `search_bazaar`, `give_feedback` (8 tools in total).

### USDC is the gas token

On Arc, gas is paid in USDC. A wallet's native balance (18 decimals) and its USDC
ERC-20 balance (`0x3600…0000`, 6 decimals) are **the same funds**:

- **`check_balance`** returns `{ address, network, mode, usdc, gasNote }`. There is
  no separate gas balance to report.
- **Transfers:** use `transfer_usdc`. The old chain-specific native-coin transfer
  tool was removed, since on Arc it would move the same USDC.
- **`mode`** is `PAYMENTS` when a private key is configured and `READ_ONLY`
  otherwise. `PAYMENTS` replaced the old chain-named mode.
- x402 payments (`x402_fetch`, `pay`) are gasless for the wallet, because the
  provider's facilitator submits them. Fund the wallet with USDC only, from
  <https://faucet.circle.com> (select Arc Testnet).

**On-chain reputation (ERC-8004):** after a successful paid `x402_fetch`, the
wallet automatically posts a positive on-chain score for the provider's agent.
`search_bazaar` surfaces each provider's aggregate score (read from the
Reputation Registry), and `give_feedback` lets you score a provider manually.
`ERC8004_REPUTATION_REGISTRY` defaults to Arc's canonical registry (`docs/DEPLOYMENTS.md`).

## Configuration

Set via the Claude Desktop config form (or env vars when run directly):

| Field | Env var | Default |
|---|---|---|
| Arc Testnet private key (0x…) | `CHAINPE_PRIVATE_KEY` | — (read-only if unset) |
| Network (`arc-testnet`) | `NETWORK` | `arc-testnet` |
| Max USDC per payment | `MAX_PER_CALL` | `0.10` |
| Max USDC per day | `MAX_PER_DAY` | `20.00` |
| ChainPeRegistry address | `CHAINPE_REGISTRY_ADDRESS` | `0x79c7a22993A40A3c88355b737e6F608c6610c395` (live) |
| ERC-8004 Reputation Registry | `ERC8004_REPUTATION_REGISTRY` | Arc's canonical registry |
| RPC override | `ARC_RPC_URL` | `https://rpc.testnet.arc.io` |

## Build

```bash
npm install          # from the monorepo root
npm run build        # tsup → dist/index.js
npm run build:mcpb   # produces chainpe.mcpb (double-click to install in Claude Desktop)
npm test             # vitest
```

## Develop against a local MCP client

Run `dist/index.js` over stdio. For a quick check you can connect with the MCP
SDK client (`@modelcontextprotocol/sdk/client`) or the MCP Inspector and call
`search_bazaar` to read the live Arc Testnet registry; no address configuration is needed.
