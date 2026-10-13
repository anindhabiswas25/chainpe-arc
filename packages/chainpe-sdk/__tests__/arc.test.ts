import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAddress, hashTypedData, keccak256, encodeAbiParameters, toHex } from 'viem'
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_CONTRACTS,
  ARC_TESTNET_ERC8004,
  ARC_USDC_ADDRESS,
  ARC_USDC_EIP712_DOMAIN,
  X402_NETWORK,
  arcTestnet,
  explorerTxUrl,
  formatNativeUsdc,
  fromX402Network
} from '../src/arc.js'

const CONTRACTS = join(__dirname, '..', '..', '..', 'contracts')
const readJson = (file: string) => {
  const path = join(CONTRACTS, 'deployments', file)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : undefined
}

describe('Arc Testnet constants', () => {
  it('uses chain 5042002 and its CAIP-2 x402 id', () => {
    expect(arcTestnet.id).toBe(5042002)
    expect(X402_NETWORK).toBe(`eip155:${ARC_TESTNET_CHAIN_ID}`)
    expect(fromX402Network('eip155:5042002')).toBe('arc-testnet')
    expect(fromX402Network('arc-testnet')).toBeUndefined()
  })

  it('USDC EIP-712 domain hashes to the on-chain DOMAIN_SEPARATOR', () => {
    // Value read from 0x3600…0000 DOMAIN_SEPARATOR() on 2026-10-13.
    const typeHash = keccak256(
      toHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
    )
    const separator = keccak256(
      encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }],
        [
          typeHash,
          keccak256(toHex(ARC_USDC_EIP712_DOMAIN.name)),
          keccak256(toHex(ARC_USDC_EIP712_DOMAIN.version)),
          BigInt(ARC_USDC_EIP712_DOMAIN.chainId),
          ARC_USDC_EIP712_DOMAIN.verifyingContract
        ]
      )
    )
    expect(separator).toBe('0x361191522483d32a83e70ae7183b4b9629442c13a78bc9921d6f707911c8c6b0')
    // Sanity: viem's typed-data hashing accepts the domain as-is.
    expect(
      hashTypedData({ domain: ARC_USDC_EIP712_DOMAIN, types: { T: [{ name: 'a', type: 'uint256' }] }, primaryType: 'T', message: { a: 1n } })
    ).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('formats native (18-dp) balances as USDC without double counting', () => {
    expect(formatNativeUsdc(339052858302454232645n)).toBe('339.052858')
    expect(explorerTxUrl('0xabc')).toBe('https://explorer.testnet.arc.io/tx/0xabc')
  })
})

describe('constants stay in sync with contracts/', () => {
  it('matches contracts/scripts/lib/networks.ts', () => {
    const src = readFileSync(join(CONTRACTS, 'scripts', 'lib', 'networks.ts'), 'utf-8')
    expect(src).toContain(`ARC_TESTNET_CHAIN_ID = ${ARC_TESTNET_CHAIN_ID}`)
    expect(src).toContain(ARC_USDC_ADDRESS)
    for (const addr of Object.values(ARC_TESTNET_ERC8004)) expect(src).toContain(addr)
  })

  it('matches deployments/arc-testnet-erc8004.json', () => {
    const rec = readJson('arc-testnet-erc8004.json')
    expect(rec, 'run contracts: npm run record:erc8004').toBeDefined()
    expect(getAddress(rec.identityRegistryAddress)).toBe(ARC_TESTNET_ERC8004.identityRegistry)
    expect(getAddress(rec.reputationRegistryAddress)).toBe(ARC_TESTNET_ERC8004.reputationRegistry)
    expect(getAddress(rec.validationRegistryAddress)).toBe(ARC_TESTNET_ERC8004.validationRegistry)
  })

  it('matches deployments/arc-testnet{,-policyvault,-timelock}.json', () => {
    const reg = readJson('arc-testnet.json')
    const vault = readJson('arc-testnet-policyvault.json')
    const timelock = readJson('arc-testnet-timelock.json')
    expect(ARC_TESTNET_CONTRACTS.chainPeRegistry).toBe(getAddress(reg.chainPeRegistryProxy))
    expect(ARC_TESTNET_CONTRACTS.deployBlock).toBe(BigInt(reg.deployBlock))
    expect(ARC_TESTNET_CONTRACTS.policyVault).toBe(getAddress(vault.policyVaultProxy))
    expect(ARC_TESTNET_CONTRACTS.timelock).toBe(getAddress(timelock.timelock))
  })
})
