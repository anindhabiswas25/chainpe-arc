# ChainPe — agent-to-agent marketplace (sellers + reputation)

The flagship demo: **agents that get paid to do real work, and an agent that
hires them.** Two LLM-backed seller agents are monetized per request in USDC on
Arc Testnet; a buyer orchestrator discovers them (ranked by ⭐ ERC-8004
reputation), hires both in sequence, pays each, and composes the result — and
every paid call bumps the seller's on-chain reputation.

```
buyer (orchestrator.mjs)
   │  discover (ranked by ⭐)
   ├──pay USDC──▶ Research Agent   (LLM)  ──┐
   │                                        │ research brief
   └──pay USDC──▶ News Digest Agent (LLM) ◀─┘  → final digest
        each paid call → ERC-8004 reputation +100 to the seller's agentId
```

| Piece | File |
|---|---|
| Research seller (`POST /research {topic}`) | `research-agent.mjs` |
| News-digest seller (`POST /summarize {text}`) | `news-digest-agent.mjs` |
| Buyer orchestrator (discover → hire both → compose) | `orchestrator.mjs` |
| Mint an ERC-8004 identity → `agentId` | `mint-identity.mjs` |
| Register a seller on-chain (non-interactive) | `register-seller.mjs` |
| One-shot launcher | `launch.sh` |

Each seller runs its LLM backend behind the **same ChainPe x402 gateway** that
`chainpe start` uses (started programmatically via `@chainpearc/cli`), so two
sellers run side by side. The gateway advertises each seller's `agentId` on the
402 response (feature 3b) so the buyer can leave feedback without scanning the
registry.

## Setup

```bash
# From the repo root, once: build the local @chainpearc/* packages.
npm install && npm run build

# Here:
cp .env.example .env      # fill in keys (see below)
npm install               # links the local @chainpearc/* packages
```

You need **three distinct wallets**: the buyer (`CHAINPE_PRIVATE_KEY`) and one per
seller (`RESEARCH_PAYTO*`, `DIGEST_PAYTO*`). ERC-8004 blocks self-feedback, so the
buyer must differ from the sellers for reputation to accrue. `node gen-wallets.mjs`
generates them and prints a ready-to-paste `.env` block.

**Funding is USDC only.** On Arc, USDC is the gas token, so fund the buyer from
<https://faucet.circle.com> (select Arc Testnet). `node fund-sellers.mjs` then sends
each seller one USDC transfer that covers the registration fee and its gas.

**Facilitator.** Sellers settle payments through your self-hosted facilitator:
run `services/chainpe-facilitator` and set `CHAINPE_FACILITATOR_URL` (see
"Self-hosting the facilitator" in the docs). For quick local runs you can instead
set `CHAINPE_FACILITATOR_KEY` to a USDC-funded gas key and each seller proxy
settles in-process.

**Contracts.** Nothing to set: the scripts use the live ChainPeRegistry
(`0x79c7a22993A40A3c88355b737e6F608c6610c395`) and Arc's canonical ERC-8004
Identity/Reputation registries. Override with `CHAINPE_REGISTRY_ADDRESS`,
`ERC8004_IDENTITY_REGISTRY` / `ERC8004_REPUTATION_REGISTRY`. Registering a seller
costs the registry's 1 USDC fee, which `fund-sellers.mjs` includes.

**LLM.** The sellers call Anthropic models, so `ANTHROPIC_API_KEY` is required. For
the same flow with stub sellers and no LLM key, run `npm run test:e2e:a2a` from the
repo root.

## One command: `./demo.sh`

```bash
./demo.sh              # fund sellers → register on-chain → start sellers → run the buyer
./demo.sh --run-only   # sellers already funded + registered
```

## Step by step

### 1. Launch the sellers + register them

```bash
REGISTER=1 ./launch.sh
```

This starts both sellers, waits for health, then runs `register-seller.mjs` for
each. Registration now **automatically mints an ERC-8004 identity** for each
seller wallet if one doesn't exist yet — no separate step needed. The printed
`agentId` is the token that accrues reputation on each paid call. Leave it running.

### 2. Run the buyer

```bash
npm run orchestrate -- "The state of AI agents and on-chain payments in 2026"
```

You'll see the buyer discover the sellers (ranked by ⭐), pay each in USDC (with an
explorer tx link), receive real LLM output, and post reputation. Run it again and the
sellers' ⭐ scores have gone up — visible via `chainpe discover` or in the buyer's
discovery output.

### All-in-one (launch.sh)

```bash
REGISTER=1 ORCHESTRATE=1 TOPIC="..." ./launch.sh
```
