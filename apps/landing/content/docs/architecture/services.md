---
id: architecture-services
title: Services Architecture
sidebar_position: 4
---

# Services Architecture

ChainPe has two backend services, the **facilitator** and the **indexer**. Both are **self-hosted**: there is no shared ChainPe deployment, and each operator runs their own. They have distinct responsibilities and different trust levels.

## Facilitator

**Repository:** `services/chainpe-facilitator/`
**Run it:** [Self-hosting the facilitator](../self-hosting/facilitator.md). Providers point at it with `CHAINPE_FACILITATOR_URL`.

### Responsibility

Implements the x402 HTTP facilitator contract: `POST /verify` and `POST /settle`. Receives a signed USDC payment authorization from the provider proxy, verifies it, and submits it to the Arc Testnet USDC contract.

### Non-custodial design

The facilitator holds only enough USDC to pay gas. It never holds user USDC. It can only move USDC that the payer already signed and authorized — if the key leaks, an attacker gains the gas balance but cannot steal any payer funds (the EIP-3009 signature is already spent/expired).

### API surface

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Service info and endpoint list |
| `/health` | GET | Liveness check (always 200; `"status": "degraded"` when gas is low) |
| `/status` | GET | Detailed status including live gas balance |
| `/supported` | GET | Returns supported x402 schemes and networks |
| `/metrics` | GET | Prometheus text-format counters |
| `/verify` | POST | Verify a payment payload (does not submit) |
| `/settle` | POST | Verify + settle a payment on-chain |

### Configuration

| Env var | Required | Description |
|---|---|---|
| `FACILITATOR_PRIVATE_KEY` | Yes | Gas-paying key; fund it with USDC (the gas token on Arc) |
| `NETWORK` | No | `arc-testnet` or `eip155:5042002` (the only supported network) |
| `ARC_RPC_URL` | No | Arc Testnet RPC override (`RPC_URL` also accepted) |
| `PORT` | No | HTTP port (default 4500) |
| `LOW_GAS_THRESHOLD_USDC` | No | Below this, `/health` reports `degraded` (default 0.5) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

### Rate limiting

60 requests per minute per IP. Returns `{ error: "rate_limit_exceeded" }` on excess.

### Gas health check

If the gas key balance drops below `LOW_GAS_THRESHOLD_USDC` (default 0.5 USDC), `/health` still returns 200 but reports `"status": "degraded"` and `"warning": "low_gas"`, so platform health checks don't restart it in a loop. Alert on `/status` (`lowGas`) or on the `chainpe_gas_balance_native` gauge in `/metrics`.

---

## Indexer

**Repository:** `services/chainpe-indexer/`
**Run it:** `services/chainpe-indexer` (default port 4600). Point the dashboard at it with `INDEXER_URL`.

### Responsibility

Watches `ChainPeRegistry` and `ReputationRegistry` events on Arc Testnet, stores them in Postgres, and serves a REST API for O(1) discovery and reputation queries.

Without the indexer, every `cp.discover()` call would require reading all paginated contract state directly from an RPC node. The indexer makes discovery fast and filterable.

### Data model

Two tables:
- `services` — one row per active registered service (upserted on events)
- `feedback` — one row per ERC-8004 reputation feedback event

### API surface

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Service health + last indexed block |
| `/stats` | GET | Service and feedback counts |
| `/services` | GET | Paginated, filtered, ranked service list |
| `/services/:id` | GET | Single service by key or `developer:name` |
| `/services/:id/reputation` | GET | Reputation summary for a service |

Query parameters for `GET /services`:
- `query` — free-text search over name, description, tags
- `tag` — filter by exact tag
- `maxPrice` — maximum price per request in USDC
- `offset` — pagination offset (default 0)
- `limit` — page size (default 100, max 100)

### Configuration

| Env var | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `CHAINPE_REGISTRY_ADDRESS` | Yes | ChainPeRegistry address ([Deployments](../smart-contracts/overview.md#deployments)) |
| `ERC8004_REPUTATION_REGISTRY` | Yes | ERC-8004 ReputationRegistry address |
| `START_BLOCK` | No | Registry deploy block (fast cold start) |
| `NETWORK` | No | `arc-testnet` (default; the only supported value) |
| `ARC_RPC_URL` | No | Arc Testnet RPC override |
| `PORT` | No | HTTP port (default 4600) |

### Deployment

Both services ship a `Dockerfile` and a `railway.json`. Run them on any Docker or Node 18+ host, set the environment variables above, and health-check `/health`. Note that the public Arc RPC limits `eth_getLogs` ranges, so keep `LOG_CHUNK` at or below the default (2000).
