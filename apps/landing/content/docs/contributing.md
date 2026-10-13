---
id: contributing
title: Contributing
sidebar_position: 12
---

# Contributing to ChainPe

Thank you for your interest in contributing!

## Getting started

```bash
git clone https://github.com/anindhabiswas25/chainpe-arc.git ChainPe
cd ChainPe
npm install
cp .env.example .env   # fill in your keys
npm run build
npm test               # workspace tests
cd contracts && npm test  # 44+ contract tests
```

## Monorepo structure

```
chainpe/
├── contracts/         # Hardhat — Solidity contracts + tests
├── packages/
│   ├── chainpe-sdk/   # @chainpearc/sdk — core payments + reputation
│   ├── chainpe-ai-tools/  # @chainpearc/ai-tools — Vercel + LangChain adapters
│   ├── chainpe/       # @chainpearc/cli — provider proxy + consumer CLI
│   ├── chainpe-wallet/  # chainpe-wallet-mcp — Claude MCP extension
│   └── chainpe-agent/ # @chainpearc/agent — standalone agent loop
├── services/
│   ├── chainpe-facilitator/  # self-hosted x402 facilitator
│   └── chainpe-indexer/      # events → Postgres → REST (self-hosted)
├── apps/dashboard/    # Next.js marketplace
├── examples/          # seller-agents, agent-surfaces, policy-vault
└── docs/              # CHANGELOG, DEPLOYMENTS, STRUCTURE
```

## Development workflow

### TypeScript packages

```bash
cd packages/chainpe-sdk
npm run dev        # tsx watch mode
npm run build      # tsup compile → dist/
npm run typecheck  # tsc --noEmit
```

### Contracts

```bash
cd contracts
npx hardhat compile
npx hardhat test
npx hardhat coverage   # line coverage report
```

### Services

```bash
cd services/chainpe-facilitator
npm run dev   # nodemon or tsx watch
npm test      # vitest
```

## Code style

- **TypeScript strict mode** is enabled everywhere. All public exports must have JSDoc comments.
- **Logging**: use the `logger` from `src/logger.ts` in CLI/proxy code. Never `console.log` in library code.
- **Solidity**: NatSpec comments on all public functions. Follow the existing storage layout documentation pattern.
- **Tests**: use Vitest for TypeScript packages, Hardhat Mocha for contracts. Aim for >80% coverage on new code.

## Commit conventions

Use conventional commits:
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — refactoring without behavior change
- `test:` — tests only
- `chore:` — build system, dependencies

## Submitting changes

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes and add tests
3. Run `npm run build && npm test` from the repo root
4. Open a pull request against `main`
5. Fill in the PR template describing what changed and why

## Reporting issues

Please open a GitHub issue with:
- Node.js version (`node --version`)
- Package version (`npm list @chainpearc/sdk`)
- Full error output
- Minimal reproduction steps

## Areas where contributions are especially welcome

- Property-based fuzzing for PolicyVault (Echidna)
- Additional AI framework adapters (OpenAI Assistants API, CrewAI, AutoGen)
- Production (mainnet) deployment tooling, once Arc mainnet is available
- Documentation improvements and tutorials
