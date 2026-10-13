/**
 * Register the ChainPe demo agents on-chain in one shot.
 *
 * Each agent gets its own ERC-8004 identity auto-minted, then is
 * registered in the ChainPeRegistry. Reads wallet keys and addresses
 * from .env — run gen-wallets.mjs + fund-sellers.mjs first.
 *
 * Run: node register-all.mjs
 *
 * Pass --public-base <url> to register with a public URL instead of localhost,
 * e.g. node register-all.mjs --public-base https://myserver.example.com
 */
import 'dotenv/config'
import {
  createPublicClient,
  createWalletClient,
  http,
  erc20Abi,
  decodeEventLog,
  getAddress,
} from 'viem'
import { arcTestnet, ARC_TESTNET_CONTRACTS, ARC_TESTNET_ERC8004 } from '@chainpearc/sdk'
import { privateKeyToAccount } from 'viem/accounts'
import { ChainPeRegistryClient } from '@chainpearc/cli'

// ── Config ────────────────────────────────────────────────────────────────────

const RPC      = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io'
// Live Arc Testnet addresses unless env overrides them.
const REGISTRY = process.env.CHAINPE_REGISTRY_ADDRESS || ARC_TESTNET_CONTRACTS.chainPeRegistry
const IDENTITY = process.env.ERC8004_IDENTITY_REGISTRY || ARC_TESTNET_ERC8004.identityRegistry
const USDC     = '0x3600000000000000000000000000000000000000' // Arc Testnet USDC interface

const args = process.argv.slice(2)
const publicBase = args[args.indexOf('--public-base') + 1] ?? null

// Each agent: { label, key, payto, name, description, tags, price, proxyPort }
const AGENTS = [
  {
    label:       'Research Agent',
    key:         process.env.RESEARCH_PAYTO_KEY,
    payto:       process.env.RESEARCH_PAYTO,
    name:        'Research Agent',
    description: 'LLM research agent — POST /research {topic} returns a sourced brief.',
    tags:        ['ai', 'research', 'agent'],
    price:       process.env.RESEARCH_PRICE || '0.01',
    proxyPort:   process.env.RESEARCH_PROXY_PORT || '4501',
  },
  {
    label:       'News Digest Agent',
    key:         process.env.DIGEST_PAYTO_KEY,
    payto:       process.env.DIGEST_PAYTO,
    name:        'News Digest Agent',
    description: 'LLM news-digest agent — POST /summarize {text} returns a summary + bullets.',
    tags:        ['ai', 'news', 'summarize', 'agent'],
    price:       process.env.DIGEST_PRICE || '0.01',
    proxyPort:   process.env.DIGEST_PROXY_PORT || '4502',
  },
]

const IDENTITY_ABI = [
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'register', stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'event', name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const pub = createPublicClient({ chain: arcTestnet, transport: http(RPC) })
const registryClient = new ChainPeRegistryClient('arc-testnet', REGISTRY)

function normalizeKey(k) { return k.startsWith('0x') ? k : `0x${k}` }

async function mintIdentity(sellerKey, payto, label) {
  const account = privateKeyToAccount(normalizeKey(sellerKey))
  const wc = createWalletClient({ account, chain: arcTestnet, transport: http(RPC) })
  const identityAddr = getAddress(IDENTITY)

  // Check if already has an identity
  const balance = await pub.readContract({
    address: identityAddr, abi: IDENTITY_ABI,
    functionName: 'balanceOf', args: [getAddress(payto)],
  }).catch(() => 0n)

  if (balance > 0n) {
    console.log(`    ℹ  ${label}: wallet already has ERC-8004 identity — skipping mint`)
    return '0'
  }

  const hash = await wc.writeContract({
    address: identityAddr, abi: IDENTITY_ABI,
    functionName: 'register',
    args: [`chainpe://agent/${label.toLowerCase().replace(/ /g, '-')}`],
  })
  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 })

  let agentId = '0'
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== identityAddr.toLowerCase()) continue
    try {
      const ev = decodeEventLog({ abi: IDENTITY_ABI, data: log.data, topics: log.topics })
      if (ev.eventName === 'Registered') {
        agentId = String(ev.args.agentId)
        break
      }
    } catch { /* not this event */ }
  }

  console.log(`    ✓  ERC-8004 identity minted: agent #${agentId}`)
  console.log(`       tx: https://explorer.testnet.arc.io/tx/${hash}`)
  return agentId
}

// ── Main ──────────────────────────────────────────────────────────────────────

const fee = await registryClient.registrationFee().catch(() => 0n)
console.log(`\nChainPe Registry: ${REGISTRY}`)
console.log(`Registration fee: ${Number(fee) / 1e6} USDC per agent`)
console.log(`Agents to register: ${AGENTS.length}`)
console.log(publicBase ? `Public base URL: ${publicBase}` : 'Using localhost endpoints')

let passed = 0, failed = 0

for (const agent of AGENTS) {
  const { label, key, payto, name, description, tags, price, proxyPort } = agent

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Registering: ${label}`)
  console.log(`  Wallet: ${payto}`)
  console.log(`  Price:  ${price} USDC/call`)

  if (!key || !payto) {
    console.log(`  ✗ Missing key or payto address in .env — skipping`)
    failed++
    continue
  }

  const endpoint = publicBase
    ? `${publicBase.replace(/\/$/, '')}:${proxyPort}`
    : `http://localhost:${proxyPort}`

  console.log(`  Endpoint: ${endpoint}`)

  try {
    // Step 1: Mint ERC-8004 identity (seller signs with their own key)
    const agentId = await mintIdentity(key, payto, label)

    // Step 2: Register in ChainPeRegistry (seller signs)
    const alreadyExists = await registryClient.hasService(payto, name).catch(() => false)
    const result = await registryClient.registerService({
      privateKey: key,
      name,
      description,
      tags,
      endpoint,
      pricePerRequest: price,
      paymentToken: 'USDC',
      walletAddress: payto,
      network: 'arc-testnet',
      agentId,
      isUpdate: alreadyExists,
    })

    console.log(`  ✓  ${alreadyExists ? 'Updated' : 'Registered'} on-chain!  agentId=${agentId}`)
    console.log(`     tx: https://explorer.testnet.arc.io/tx/${result.txnHash}`)
    passed++
  } catch (err) {
    console.log(`  ✗  Failed: ${err?.message || err}`)
    failed++
  }
}

console.log(`\n${'═'.repeat(60)}`)
console.log(`Registration complete: ${passed} succeeded, ${failed} failed`)

if (passed > 0) {
  console.log(`\nVerify on-chain:`)
  console.log(`  CHAINPE_NETWORK=arc-testnet chainpe discover`)
  console.log(`  npm run orchestrate -- "your topic"`)
}
console.log()
