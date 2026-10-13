/**
 * @chainpearc/sdk quickstart — payments in 3 lines.
 *
 * Run against Arc Testnet:
 *   CHAINPE_PRIVATE_KEY=0xYOUR_PRIVATE_KEY npx tsx examples/quickstart.ts
 *   # add PAID_URL=https://your-x402-endpoint to also make a paid call
 *
 * Contract addresses default to the live Arc Testnet deployment.
 * The wallet needs a little testnet USDC (https://faucet.circle.com → Arc Testnet).
 * Settlement gas is paid by the provider's facilitator.
 */
import { ChainPe } from '../src/index.js'

const privateKey = process.env.CHAINPE_PRIVATE_KEY
if (!privateKey) throw new Error('Set CHAINPE_PRIVATE_KEY')

// 1. Create the client.
const cp = new ChainPe({ privateKey })

console.log('wallet:', cp.getAddress())
console.log('balance:', await cp.balance())

// 2. Discover services (ranked by on-chain ⭐ reputation).
const services = await cp.discover()
console.log(`\n${services.length} services on-chain:`)
for (const s of services.slice(0, 5)) {
  const rep = s.reputation
  const stars = rep?.score != null ? `⭐ ${rep.score} (${rep.count})` : 'unrated'
  console.log(`  • ${s.name} — ${s.pricePerRequest} USDC — ${stars}`)
}

// 3. Pay a 402 endpoint and read the data (auto-pays USDC via EIP-3009).
const url = process.env.PAID_URL
if (url) {
  const res = await cp.pay(url)
  console.log('\npaid call:', res.status, res.payment)
  console.log('data:', res.data)
}
