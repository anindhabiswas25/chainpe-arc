/**
 * Generate the demo wallets and print a ready-to-paste .env block.
 *
 * Run once: node gen-wallets.mjs
 * Then paste the output into .env and fund the wallets per the instructions.
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const roles = [
  { key: 'CHAINPE_PRIVATE_KEY',    payto: 'BUYER_ADDRESS',        name: 'Buyer (orchestrator)'   },
  { key: 'CHAINPE_FACILITATOR_KEY',payto: 'FACILITATOR_ADDRESS',  name: 'Facilitator (gas)'      },
  { key: 'RESEARCH_PAYTO_KEY',     payto: 'RESEARCH_PAYTO',       name: 'Research Seller'        },
  { key: 'DIGEST_PAYTO_KEY',       payto: 'DIGEST_PAYTO',         name: 'News Digest Seller'     },
]

const wallets = roles.map(r => {
  const privateKey = generatePrivateKey()
  const { address } = privateKeyToAccount(privateKey)
  return { ...r, privateKey, address }
})

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  ChainPe demo wallets — SAVE THESE PRIVATELY')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

for (const w of wallets) {
  console.log(`${w.name}`)
  console.log(`  Address:     ${w.address}`)
  console.log(`  Private key: ${w.privateKey}`)
  console.log()
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Fund these wallets on Arc Testnet BEFORE continuing:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const [buyer, facilitator, research, digest] = wallets

// On Arc, USDC is also the gas token, so every wallet is funded with USDC only.
// At ~25 gwei a ~200k-gas tx costs ~0.005 USDC; the amounts below leave headroom.
console.log('USDC (also pays gas on Arc) — https://faucet.circle.com  (select "Arc Testnet")')
console.log(`  ${buyer.address}  ← Buyer        (~1 USDC covers many 0.01 USDC calls + seller funding)`)
console.log(`  ${facilitator.address}  ← Facilitator  (only for an in-process facilitator: ~0.5 USDC of gas)`)
console.log(`  ${research.address}  ← Research Seller (funded by fund-sellers.mjs)`)
console.log(`  ${digest.address}  ← Digest Seller   (funded by fund-sellers.mjs)`)
console.log()

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  Paste this block into .env:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const envBlock = `
# ─── Buyer (orchestrator) ────────────────────────────────────────────────
CHAINPE_PRIVATE_KEY=${buyer.privateKey}

# ─── Facilitator ─────────────────────────────────────────────────────────
# Preferred: your self-hosted facilitator (services/chainpe-facilitator).
CHAINPE_FACILITATOR_URL=http://localhost:4500
# Or run one in-process inside each seller proxy with this gas key instead:
# CHAINPE_FACILITATOR_KEY=${facilitator.privateKey}

# ─── Demo sellers ─────────────────────────────────────────────────────────
RESEARCH_PAYTO=${research.address}
RESEARCH_PAYTO_KEY=${research.privateKey}
DIGEST_PAYTO=${digest.address}
DIGEST_PAYTO_KEY=${digest.privateKey}

# ─── LLM ─────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ─── Network + contracts (Arc Testnet) ───────────────────────────────────
# Addresses default to the live Arc Testnet deployment (override if needed):
CHAINPE_NETWORK=arc-testnet
# CHAINPE_REGISTRY_ADDRESS=0x79c7a22993A40A3c88355b737e6F608c6610c395
# ERC8004_IDENTITY_REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e
# ERC8004_REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713
`.trim()

console.log(envBlock)

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  After funding, register the agents:')
console.log('  REGISTER=1 ./launch.sh')
console.log('  Or register one at a time: npm run register')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  MCP wallet config for Claude.ai:')
console.log('  Settings → Developer → Edit Config → add under "mcpServers":')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const mcpConfig = {
  "chainpe-wallet": {
    "command": "node",
    "args": [
      '/ABSOLUTE/PATH/TO/ChainPe/packages/chainpe-wallet/dist/index.js'
    ],
    "env": {
      "CHAINPE_PRIVATE_KEY": buyer.privateKey,
      "NETWORK": "arc-testnet",
      "MAX_PER_CALL": "0.05",
      "MAX_PER_DAY": "1.00"
    }
  }
}

console.log(JSON.stringify({ mcpServers: mcpConfig }, null, 2))
console.log()
