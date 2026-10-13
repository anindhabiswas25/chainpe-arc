---
id: architecture-overview
title: Architecture Overview
sidebar_position: 1
---

# Architecture Overview

ChainPe is infrastructure, not a single app. One payment + reputation core drives multiple surfaces. This page gives a high-level view of how everything fits together.

## System diagram

```mermaid
graph TB
    subgraph "Client Layer"
        SDK["@chainpearc/sdk\n(cp.fetch / cp.pay / cp.discover)"]
        AITOOLS["@chainpearc/ai-tools\n(Vercel AI SDK / LangChain)"]
        CLI["@chainpearc/cli\n(chainpe fetch / discover)"]
        MCP["chainpe-wallet-mcp\n(Claude Desktop)"]
        DASH["apps/dashboard\n(Next.js marketplace)"]
    end

    subgraph "Provider Layer"
        PROXY["x402 Proxy\n(chainpe start)"]
        BACKEND["Provider Backend\n(any HTTP server)"]
    end

    subgraph "ChainPe Services"
        FAC["Facilitator\n(self-hosted · non-custodial)"]
        IDX["Indexer\n(self-hosted · Postgres)"]
    end

    subgraph "Arc Testnet"
        REG["ChainPeRegistry"]
        PV["PolicyVault"]
        ID8["ERC-8004 IdentityRegistry"]
        REP8["ERC-8004 ReputationRegistry"]
        USDC["USDC ERC-20\n(0x3600...0000)"]
    end

    SDK -->|"x402 fetch"| PROXY
    AITOOLS -->|"chainpeFetch tool"| PROXY
    CLI -->|"chainpe fetch"| PROXY
    MCP -->|"x402_fetch tool"| PROXY

    PROXY -->|"/settle (EIP-3009)"| FAC
    FAC -->|"transferWithAuthorization"| USDC
    USDC -->|"USDC transfer"| BACKEND

    PROXY --> BACKEND

    SDK -->|"discover, getReputation"| IDX
    DASH -->|"REST queries"| IDX
    IDX -->|"watches events"| REG
    IDX -->|"watches events"| REP8

    SDK -->|"register / deregister"| REG
    SDK -->|"giveFeedback"| REP8
    SDK -->|"setPolicy / deposit"| PV

```

## Component responsibilities

### @chainpearc/sdk

The primary consumer library. Wraps all x402 payment logic, ERC-8004 reputation, registry discovery, and PolicyVault interaction behind a clean TypeScript API. The `ChainPe` class is the entry point.

### @chainpearc/ai-tools

Thin adapters that wrap SDK calls as Vercel AI SDK `tool()` objects or LangChain `StructuredTool` instances. Exposes `chainpeFetch` (pay for and call a URL) and `discoverService` (search and rank the registry).

### @chainpearc/cli

Two roles in one package:
- **Provider**: `chainpe init/start/register` — configure and launch the x402 payment proxy
- **Consumer**: `chainpe fetch <url>` and `chainpe discover` — pay for APIs and browse the registry from the terminal

### chainpe-wallet-mcp

An MCP extension for Claude Desktop. Provides 8 tools: `x402_fetch`, `pay`, `search_bazaar`, `check_balance`, `give_feedback`, `spending_report`, `transfer_usdc`, `request_funding`.

### x402 Proxy (chainpe start)

An Express server using x402 v2 (`@x402/express`) middleware. Gates every proxied request with a USDC payment. Two facilitator modes:
1. External: your self-hosted facilitator (`facilitatorUrl` / `CHAINPE_FACILITATOR_URL`)
2. In-process: `chainpe start --facilitator <key>` runs a local facilitator

Exposes admin endpoints at `/chainpe-admin/stats`, `/chainpe-admin/payments`, `/chainpe-admin/config`, `/chainpe-admin/schema`.

### Facilitator

Implements the x402 v2 facilitator HTTP contract: `POST /verify`, `POST /settle` and `GET /supported`. Self-hosted. Non-custodial — the key only pays gas and relays the payer's already-signed `transferWithAuthorization`. Rate-limited to 60 req/min per IP. Prometheus metrics at `/metrics`.

### Indexer

Watches `ServiceRegistered`, `ServiceUpdated`, `ServiceDeregistered` events from `ChainPeRegistry` and reputation feedback events from `ReputationRegistry`. Stores results in Postgres. Serves a REST API for O(1) discovery and reputation queries.

### Arc Testnet contracts

- `ChainPeRegistry`: the service marketplace. Keyed by `keccak256(developer, name)`.
- ERC-8004 registries: portable agent identity + reputation + validation
- `PolicyVault`: gasless, policy-bounded spending

## Data flow: discovery → payment → reputation

```mermaid
sequenceDiagram
    participant Agent
    participant Indexer
    participant Proxy
    participant Facilitator
    participant USDC
    participant ReputationRegistry

    Agent->>Indexer: GET /services?query=weather&maxPrice=0.05
    Indexer-->>Agent: [{ name, endpoint, pricePerRequest, reputation }] (ranked)

    Agent->>Proxy: GET https://weather.chainpe.app/data
    Proxy-->>Agent: 402 + PAYMENT-REQUIRED { accepts: [{ network: "eip155:5042002", amount: "10000", payTo: "0x..." }] }

    Note over Agent: Sign EIP-3009 authorization off-chain

    Agent->>Proxy: GET /data + PAYMENT-SIGNATURE header
    Proxy->>Facilitator: POST /verify, /settle
    Facilitator->>USDC: transferWithAuthorization(agent→provider, 0.01 USDC)
    USDC-->>Facilitator: tx confirmed
    Facilitator-->>Proxy: { success: true, transaction: "0xabc..." }
    Proxy-->>Agent: 200 OK + PAYMENT-RESPONSE

    Agent->>ReputationRegistry: giveFeedback(agentId=42, score=100)
```

## Trust boundaries

| Boundary | Trust assumption |
|---|---|
| Agent → Facilitator | Agent signs EIP-3009 with exact amount and recipient. Facilitator cannot redirect funds or steal more than signed. |
| Facilitator → USDC | Facilitator submits agent's signed message. USDC contract verifies the signature independently. |
| Agent → Registry | Registry is an immutable Solidity contract. Service data is what was registered on-chain. |
| Agent → Indexer | Indexer is an off-chain cache. Trust for discovery but verify on-chain for critical operations. |
| Owner → PolicyVault | PolicyVault enforces on-chain. No backend can override it. |
