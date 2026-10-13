# Project Structure

```
chainpe/
├── contracts/              Smart contracts (Hardhat, Solidity 0.8.28)
│   ├── contracts/
│   │   ├── ChainPeRegistryUpgradeable.sol   Service registry (UUPS, behind an ERC-1967 proxy)
│   │   ├── PolicyVaultUpgradeable.sol       Gasless agent spending vault (UUPS, behind an ERC-1967 proxy)
│   │   ├── governance/ChainPeTimelock.sol   48h timelock for owner actions
│   │   ├── erc8004/                   ERC-8004 reference registries (Arc's canonical ones are used on Arc Testnet)
│   │   └── mocks/                     Test-only mocks
│   ├── scripts/                       Deploy, verify, ownership and demo-registration scripts
│   ├── test/                          Hardhat test suites
│   └── deployments/                   Arc Testnet deployment records (arc-testnet*.json, written by deploy scripts)
│
├── packages/
│   ├── chainpe/              Provider SDK + CLI (@chainpearc/cli)
│   │   └── src/
│   │       ├── cli.ts                 `chainpe init|start|register|deregister|list|status|fetch|discover`
│   │       ├── registry.ts            On-chain registration via viem
│   │       └── proxy/                 @x402/express v2 payment proxy (+ optional in-process facilitator)
│   │
│   ├── chainpe-agent/        Consumer agent SDK (@chainpearc/agent)
│   │   └── src/
│   │       ├── agent.ts               Autonomous AI agent (discover → pay → use)
│   │       ├── registry.ts            On-chain service discovery
│   │       └── tools/                 AI tool definitions
│   │
│   ├── chainpe-sdk/          Core SDK: x402 payments, discovery, reputation, PolicyVault (@chainpearc/sdk)
│   │   └── src/arc.ts                 Arc Testnet constants + live contract addresses (single source of truth)
│   ├── chainpe-ai-tools/     Vercel AI SDK + LangChain tools (@chainpearc/ai-tools)
│   └── chainpe-wallet/       MCP wallet server (chainpe-wallet-mcp)
│       └── scripts/build-mcpb.sh      Builds .mcpb for Claude Desktop
│
├── services/
│   ├── chainpe-facilitator/  Non-custodial x402 settlement — self-hosted (Node / Docker / Railway)
│   └── chainpe-indexer/      Event indexer + REST API (Postgres)
│
├── apps/
│   ├── dashboard/            Next.js dashboard: marketplace, wallet (Arc Testnet),
│   │                         settlement lookup, network status; /docs → DOCS_URL
│   └── landing/              Landing page + fumadocs docs (content/docs)
│
├── examples/
│   ├── weather-api/          Zero-dependency weather backend
│   ├── weather-railway/      Standalone-deployable weather backend
│   ├── proxy-railway/        Env-configured x402 proxy (startProxyServer)
│   ├── seller-agents/        Agent-to-agent marketplace demo
│   ├── agent-surfaces/       LangChain + Vercel AI SDK integrations
│   └── policy-vault/         PolicyVault gasless spending demo
│
├── docs/
│   ├── CHANGELOG.md
│   ├── DEPLOYMENTS.md        Live addresses, verification, recorded settlements, runbook (Arc Testnet)
│   └── STRUCTURE.md          This file
│
├── ARC_INTEGRATION.md        Arc Testnet integration reference
│
└── e2e/                      Live end-to-end scripts (run.mjs, agent-to-agent.mjs)
```
