# ChainPe indexer

Watches the **ChainPeRegistry** + **ERC-8004 Reputation** contracts on Arc
Testnet into Postgres and serves an **O(1) discovery + reputation REST API** — so clients
and the dashboard don't have to paginate the registry or scan feedback on-chain.

```
ChainPeRegistry ─┐                          ┌─ GET /services        (ranked by ⭐)
                 ├─ getLogs poll → Postgres ─┼─ GET /services/:id
ERC-8004 Rep ────┘                          ├─ GET /services/:id/reputation
                                            └─ GET /stats · /health
```

## How it works

- **Watcher** (`indexer.ts`): polls `getLogs` for `ServiceRegistered/Updated/
  Deregistered` and `NewFeedback/FeedbackRevoked`, in block-range chunks, advancing
  a cursor in `indexer_state` so restarts resume where they left off. Service rows
  are enriched with description + tags via a `getService` read (the events omit them).
- **Store** (`store.ts` + Drizzle/`schema.ts`): `services`, `feedback`,
  `indexer_state`. Schema is created idempotently on boot.
- **API** (`api.ts`): aggregates feedback into reputation (`aggregateReputation`,
  mirroring ERC-8004 `getSummary`) and ranks services (`rankServices`).

## Run locally

```bash
cp .env.example .env          # set DATABASE_URL (a local/Railway Postgres)
npm install
npm run dev                   # watcher + API on :4600
curl localhost:4600/services  # ranked services with reputation
```

## Configuration

Only `DATABASE_URL` is required. Everything else defaults to the live Arc Testnet deployment:

| Var | Default |
|---|---|
| `DATABASE_URL` | required (Postgres) |
| `CHAINPE_REGISTRY_ADDRESS` | `0x79c7a22993A40A3c88355b737e6F608c6610c395` |
| `ERC8004_REPUTATION_REGISTRY` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` (Arc canonical) |
| `START_BLOCK` | `66993614` (the registry's deploy block) |
| `ARC_RPC_URL` | `https://rpc.testnet.arc.io` (`RPC_URL` also accepted) |
| `POLL_INTERVAL_MS` / `LOG_CHUNK` | `5000` / `2000` |
| `PORT` | `4600` |

## Deploy

The image is built from the **repo root**, because it bundles the shared Arc
constants from `packages/chainpe-sdk/src/arc.ts`:

```bash
# Docker, from the repo root
docker build -f services/chainpe-indexer/Dockerfile -t chainpe-indexer .
docker run -d -p 4600:4600 -e DATABASE_URL=postgres://user:pass@host:5432/chainpe chainpe-indexer

# Railway, from the repo root (leave Root Directory empty)
railway init
railway add --database postgres        # provisions DATABASE_URL
RAILWAY_CONFIG_FILE=services/chainpe-indexer/railway.json railway up
railway domain
```

If you index your own registry, set `CHAINPE_REGISTRY_ADDRESS` and `START_BLOCK`
to its deploy block (0 works but back-scans from genesis, which is slow on public RPCs).

## API

| Endpoint | Returns |
|---|---|
| `GET /services?query=&tag=&maxPrice=` | active services + reputation, ranked best-first |
| `GET /services/:id` | one service (`:id` = `key` or `developer:name`) |
| `GET /services/:id/reputation` | `{ count, score }` aggregate |
| `GET /stats` | row counts |
| `GET /health` | liveness + `lastIndexedBlock` / `chainHead` |

## Tests

`npm test` covers the pure core (event→row mapping, reputation aggregation,
ranking) — no DB required.
