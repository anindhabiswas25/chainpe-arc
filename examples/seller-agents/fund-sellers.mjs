/**
 * Fund all seller wallets from a single master wallet — USDC only.
 *
 * On Arc, USDC is the gas token: a wallet's native balance (18 decimals) and its
 * USDC ERC-20 balance (6 decimals, 0x3600…0000) are the SAME funds. So one USDC
 * transfer per seller covers both the registration fee and the gas for the
 * ERC-8004 identity mint + approve + register transactions.
 *
 * Amount per seller = the registry's registrationFee (read on-chain) + a gas
 * buffer (GAS_BUFFER_USDC, default 0.05). Override the total with FUND_USDC.
 *
 * The master wallet needs USDC (faucet: https://faucet.circle.com → Arc Testnet).
 *
 * Run:
 *   MASTER_KEY=0x... node fund-sellers.mjs
 *   # Or with the buyer key already in .env:
 *   node fund-sellers.mjs
 */
import 'dotenv/config'
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  formatUnits,
  erc20Abi,
  getAddress,
} from 'viem'
import { arcTestnet, ARC_TESTNET_CONTRACTS } from '@chainpearc/sdk'
import { privateKeyToAccount } from 'viem/accounts'

const RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io'
const USDC = '0x3600000000000000000000000000000000000000' // Arc Testnet USDC interface (6 decimals)
const EXPLORER = 'https://explorer.testnet.arc.io'

const rawKey = process.env.MASTER_KEY || process.env.CHAINPE_PRIVATE_KEY
if (!rawKey) {
  console.error('Set MASTER_KEY=0x... (an Arc Testnet wallet with enough USDC)')
  process.exit(1)
}
const masterAccount = privateKeyToAccount(rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`)

const pub = createPublicClient({ chain: arcTestnet, transport: http(RPC) })
const wallet = createWalletClient({ account: masterAccount, chain: arcTestnet, transport: http(RPC) })

const SELLERS = [
  { label: 'Research Agent', addr: process.env.RESEARCH_PAYTO },
  { label: 'Digest Agent', addr: process.env.DIGEST_PAYTO },
].filter(s => s.addr)

if (!SELLERS.length) {
  console.error('No seller addresses found in .env. Run gen-wallets.mjs first.')
  process.exit(1)
}

async function perSellerAmount() {
  if (process.env.FUND_USDC) return parseUnits(process.env.FUND_USDC, 6)
  const gasBuffer = parseUnits(process.env.GAS_BUFFER_USDC || '0.05', 6)
  const registry = process.env.CHAINPE_REGISTRY_ADDRESS || ARC_TESTNET_CONTRACTS.chainPeRegistry
  const fee = await pub.readContract({
    address: getAddress(registry),
    abi: parseAbi(['function registrationFee() view returns (uint256)']),
    functionName: 'registrationFee',
  })
  console.log(`Registration fee: ${formatUnits(fee, 6)} USDC  + gas buffer ${formatUnits(gasBuffer, 6)} USDC`)
  return fee + gasBuffer
}

const amount = await perSellerAmount()
const need = amount * BigInt(SELLERS.length)
// One balance check: the ERC-20 view is the spendable USDC (6 decimals).
const balance = await pub.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [masterAccount.address] })

console.log(`\nMaster wallet: ${masterAccount.address}`)
console.log(`  USDC: ${formatUnits(balance, 6)}  (need ≥${formatUnits(need, 6)} + gas for ${SELLERS.length} transfers)`)

if (balance < need) {
  console.error(`\n✗ Not enough USDC. Get ${formatUnits(need - balance, 6)} more from:\n  https://faucet.circle.com  (select Arc Testnet)`)
  process.exit(1)
}

console.log(`\nFunding ${SELLERS.length} seller wallets with ${formatUnits(amount, 6)} USDC each...\n`)

for (const { label, addr } of SELLERS) {
  const hash = await wallet.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [getAddress(addr), amount],
  })
  await pub.waitForTransactionReceipt({ hash, timeout: 60_000 })
  console.log(`  ${label.padEnd(16)} ${addr}  ✓ +${formatUnits(amount, 6)} USDC  ${EXPLORER}/tx/${hash}`)
}

console.log('\nAll sellers funded (USDC covers the fee and gas). Run register-all.mjs to register on-chain.')
