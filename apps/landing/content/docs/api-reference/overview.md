---
id: api-reference-overview
title: API Reference Overview
sidebar_position: 1
slug: /api-reference/overview
---

# API Reference

REST API reference for the two ChainPe backend services.

## Base URLs

Both services are self-hosted. There is no shared ChainPe deployment. Set the URLs of your own instances:

| Service | Env var used in these docs | Local default | Source |
|---|---|---|---|
| **Facilitator** | `CHAINPE_FACILITATOR_URL` | `http://localhost:4500` | `services/chainpe-facilitator` ([self-hosting guide](../self-hosting/facilitator.md)) |
| **Indexer** | `INDEXER_URL` | `http://localhost:4600` | `services/chainpe-indexer` |

Both serve Arc Testnet only.

## Authentication

Neither service requires authentication for read endpoints. The facilitator's `/verify` and `/settle` endpoints accept any valid x402 payload — they are protected by rate limiting (60 req/min per IP) and the cryptographic validity of the signed USDC authorization.

## Rate limits

The facilitator applies a rate limit of **60 requests per minute per IP** on `/verify` and `/settle`. Exceeding the limit returns:

```json
HTTP 429
{ "error": "rate_limit_exceeded" }
```

## Error format

All error responses return JSON with an `error` field:

```json
{ "error": "description of the error" }
```

HTTP status codes follow standard conventions: `400` for bad requests, `404` for not found, `429` for rate limit, `500` for internal errors, `503` for service unavailable. The facilitator reports low gas in its `/health` body (`"status": "degraded"`), not through a 503.

## CORS

The facilitator blocks cross-origin browser requests by default. To allow specific origins, set `ALLOWED_ORIGINS` in the facilitator's environment. Server-to-server calls (no `Origin` header) always work.

The indexer enables CORS for all origins.
