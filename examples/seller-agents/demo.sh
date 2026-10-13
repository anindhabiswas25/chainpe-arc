#!/usr/bin/env bash
#
# ChainPe — Full Demo Script
#
# Runs the agent-to-agent marketplace demo on Arc Testnet:
#   STEP 1  Fund seller wallets       (node fund-sellers.mjs)
#   STEP 2  Register agents on-chain  (node register-all.mjs)
#   STEP 3  Start the seller agents + run the buyer orchestrator
#
# Usage:
#   ./demo.sh              — full setup + run (first time)
#   ./demo.sh --run-only   — skip setup, just start agents + orchestrate
#
# Prerequisites:
#   1. npm install && npm run build   (from the repo root)
#   2. npm install                    (here)
#   3. cp .env.example .env           (then fill in ANTHROPIC_API_KEY)
#      OR run:  node gen-wallets.mjs  and paste the output into .env

set -euo pipefail
cd "$(dirname "$0")"

# ── Parse flags ───────────────────────────────────────────────────────────────

RUN_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --run-only) RUN_ONLY=1 ;;
  esac
done

# ── Load .env ─────────────────────────────────────────────────────────────────

if [ ! -f .env ]; then
  echo ""
  echo "  ✗  .env not found."
  echo "     Run:  node gen-wallets.mjs"
  echo "     Paste the output into .env, fund the wallets, then re-run this script."
  exit 1
fi

set -a; . ./.env; set +a

# ── Validate required env vars ────────────────────────────────────────────────

MISSING=()
for var in \
  CHAINPE_PRIVATE_KEY \
  RESEARCH_PAYTO RESEARCH_PAYTO_KEY \
  DIGEST_PAYTO   DIGEST_PAYTO_KEY \
  ANTHROPIC_API_KEY; do
  if [ -z "${!var:-}" ]; then
    MISSING+=("$var")
  fi
done

if [ -z "${CHAINPE_FACILITATOR_URL:-}" ] && [ -z "${CHAINPE_FACILITATOR_KEY:-}" ]; then
  MISSING+=("CHAINPE_FACILITATOR_URL (or CHAINPE_FACILITATOR_KEY)")
fi

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo ""
  echo "  ✗  Missing required .env variables:"
  for v in "${MISSING[@]}"; do echo "       $v"; done
  echo ""
  echo "     Run:  node gen-wallets.mjs  to generate wallets,"
  echo "     then fill in ANTHROPIC_API_KEY and re-run."
  exit 1
fi

# ── Banner ────────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ChainPe — Agent-to-Agent Marketplace Demo"
echo "  Arc Testnet"
echo "════════════════════════════════════════════════════════════════"
echo "  Network: ${CHAINPE_NETWORK:-arc-testnet}"
echo "  Registry: ${CHAINPE_REGISTRY_ADDRESS:-0x79c7a22993A40A3c88355b737e6F608c6610c395 (live Arc Testnet)}"
echo "  Facilitator: ${CHAINPE_FACILITATOR_URL:-in-process (CHAINPE_FACILITATOR_KEY)}"
echo ""

# ── STEP 1 + 2 — Setup (skipped with --run-only) ─────────────────────────────

if [ "$RUN_ONLY" = "0" ]; then

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  STEP 1 — Funding seller wallets from buyer wallet"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  node fund-sellers.mjs
  echo ""

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  STEP 2 — Registering the agents on-chain"
  echo "  (mints ERC-8004 identity + ChainPeRegistry entry per agent)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  node register-all.mjs
  echo ""

fi

# ── STEP 3 — Start the agents ─────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 3 — Starting the seller agents"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESEARCH_PROXY_PORT="${RESEARCH_PROXY_PORT:-4501}"
DIGEST_PROXY_PORT="${DIGEST_PROXY_PORT:-4502}"

pids=()
cleanup() {
  echo ""
  echo "Shutting down seller agents…"
  for pid in "${pids[@]:-}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

node research-agent.mjs    &  pids+=($!)
node news-digest-agent.mjs &  pids+=($!)

echo ""
echo "  Waiting for the agents to become healthy…"

wait_healthy() {
  local url="$1" name="$2"
  for _ in $(seq 1 40); do
    if curl -fsS "$url/health" >/dev/null 2>&1; then
      echo "  ✓  $name"
      return 0
    fi
    sleep 1
  done
  echo "  ✗  $name did not start at $url" >&2
  return 1
}

wait_healthy "http://localhost:${RESEARCH_PROXY_PORT}"  "Research Agent      → :${RESEARCH_PROXY_PORT}/research"
wait_healthy "http://localhost:${DIGEST_PROXY_PORT}"    "News Digest Agent   → :${DIGEST_PROXY_PORT}/summarize"

# ── STEP 4 — Run the buyer orchestrator ───────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STEP 4 — Running the buyer orchestrator"
echo "  Buyer discovers agents → pays each in USDC → rates them on-chain"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node orchestrator.mjs "${TOPIC:-On-chain agent payments in USDC}"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Demo complete. Agents are still running."
echo "  Run again:   ./demo.sh --run-only"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Keep agents alive so the audience can hit endpoints manually
echo "  Press Ctrl+C to stop all agents."
wait
