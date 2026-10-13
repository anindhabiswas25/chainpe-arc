---
id: api-reference-indexer
title: Indexer API
sidebar_position: 3
---

# Indexer API

The indexer watches on-chain events from `ChainPeRegistry` and `ReputationRegistry`, caches them in Postgres, and serves O(1) REST queries.

**Base URL:** your indexer deployment (`services/chainpe-indexer`, default port 4600). The examples use `$INDEXER_URL`:

```bash
export INDEXER_URL=http://localhost:4600
```

The indexer needs Postgres (`DATABASE_URL`) plus the Arc Testnet addresses of `ChainPeRegistry` (`CHAINPE_REGISTRY_ADDRESS`) and the ERC-8004 Reputation Registry (`ERC8004_REPUTATION_REGISTRY`). Get them from [Deployments](../smart-contracts/overview.md#deployments). Set `START_BLOCK` to the registry's deploy block for a fast cold start.

CORS is enabled for all origins.

---

## GET /health

Service liveness and sync status.

**Response:**
```json
{
  "status": "ok",
  "service": "chainpe-indexer",
  "network": "arc-testnet",
  "lastIndexedBlock": "12345678",
  "chainHead": "12345700"
}
```

`chainHead` is the latest block number the indexer knows about. A large gap between `lastIndexedBlock` and `chainHead` indicates the indexer is catching up.

**cURL:**
```bash
curl "$INDEXER_URL/health"
```

---

## GET /stats

Registry and feedback counts.

**Response:**
```json
{
  "services": 12,
  "feedback": 87,
  "network": "arc-testnet"
}
```

**cURL:**
```bash
curl "$INDEXER_URL/stats"
```

---

## GET /services

List all active services, filtered and ranked by ERC-8004 reputation.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `query` | string | Free-text search over name, description, and tags (case-insensitive) |
| `tag` | string | Filter by exact tag (case-insensitive) |
| `maxPrice` | string | Maximum price per request in USDC (e.g. `"0.05"`) |
| `offset` | number | Pagination offset (default: `0`) |
| `limit` | number | Page size (default: `100`, max: `100`) |

**Response:**
```json
{
  "total": 12,
  "offset": 0,
  "limit": 100,
  "items": [
    {
      "id": "0xDeveloperAddress:MyService",
      "key": "0xabc123...",
      "name": "My AI Research Agent",
      "description": "AI-powered research and summarization service",
      "tags": ["ai", "research", "summarization"],
      "endpoint": "https://api.example.com",
      "pricePerRequest": "0.01",
      "paymentToken": "USDC",
      "walletAddress": "0xProviderPayToAddress",
      "developer": "0xDeveloperAddress",
      "network": "arc-testnet",
      "agentId": "42",
      "reputation": {
        "count": 15,
        "score": 87.3
      }
    }
  ]
}
```

`reputation` is `null` for services with no linked `agentId` or no feedback yet.

Results are sorted: services with a reputation score (highest first) → unscored services.

**cURL examples:**

```bash
# All services
curl "$INDEXER_URL/services"

# Filter by query
curl "$INDEXER_URL/services?query=weather"

# Filter by tag and price
curl "$INDEXER_URL/services?tag=ai&maxPrice=0.05"

# Paginate
curl "$INDEXER_URL/services?offset=10&limit=5"
```

---

## GET /services/:id

Get a single service by its key or `developer:name` identifier.

**Path parameter:**
- `:id` — either the raw `bytes32` storage key (0x-prefixed) or the `developer:name` string (e.g. `0xDeveloper:MyService`)

**Response:** same `ServiceDto` shape as a single item from `GET /services`

**Error (404):**
```json
{ "error": "service not found" }
```

**cURL:**
```bash
# By developer:name
curl "$INDEXER_URL/services/0xDEVELOPER_ADDRESS:My%20Research%20Agent"

# By storage key
curl "$INDEXER_URL/services/0xabc123..."
```

---

## GET /services/:id/reputation

Get the reputation summary for a specific service.

**Response:**
```json
{
  "count": 15,
  "score": 87.3
}
```

For services with no `agentId` or no feedback:
```json
{ "count": 0, "score": null }
```

**Error (404):**
```json
{ "error": "service not found" }
```

**cURL:**
```bash
curl "$INDEXER_URL/services/0x8cC8...:My%20Agent/reputation"
```

---

## ServiceDto schema

TypeScript interface for the response object:

```ts
interface ServiceDto {
  id: string           // 'developer:name'
  key: string          // bytes32 storage key (hex)
  name: string
  description: string
  tags: string[]
  endpoint: string
  pricePerRequest: string  // human USDC
  paymentToken: string     // 'USDC' | 'USDC'
  walletAddress: string    // payTo address
  developer: string        // registrant address
  network: string          // 'arc-testnet' (the only supported network)
  agentId?: string         // ERC-8004 agent id
  reputation: {
    count: number
    score: number | null
  } | null
}
```
