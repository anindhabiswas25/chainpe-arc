import { afterEach, describe, it, expect } from 'vitest'
import {
  getX402Network,
  getUsdcAddress,
  rpcUrlFor,
  arcTestnet,
  explorerTxUrl
} from '../src/clients.js'

describe('network helpers', () => {
  afterEach(() => {
    delete process.env.ARC_RPC_URL
  })

  describe('arcTestnet chain', () => {
    it('uses chain id 5042002 with USDC as the native gas token', () => {
      expect(arcTestnet.id).toBe(5042002)
      expect(arcTestnet.nativeCurrency.symbol).toBe('USDC')
      expect(arcTestnet.nativeCurrency.decimals).toBe(18)
    })
  })

  describe('getX402Network', () => {
    it('maps arc-testnet to the CAIP-2 x402 id', () => {
      expect(getX402Network('arc-testnet')).toBe('eip155:5042002')
    })
  })

  describe('getUsdcAddress', () => {
    it('returns the Arc Testnet USDC ERC-20 interface', () => {
      expect(getUsdcAddress('arc-testnet')).toBe(
        '0x3600000000000000000000000000000000000000'
      )
    })
  })

  describe('rpcUrlFor', () => {
    it('returns the default Arc Testnet RPC', () => {
      expect(rpcUrlFor('arc-testnet')).toBe('https://rpc.testnet.arc.io')
    })
    it('honours ARC_RPC_URL', () => {
      process.env.ARC_RPC_URL = 'http://localhost:8545'
      expect(rpcUrlFor('arc-testnet')).toBe('http://localhost:8545')
    })
  })

  describe('explorerTxUrl', () => {
    it('links to the Arc Testnet explorer', () => {
      expect(explorerTxUrl('arc-testnet', '0xabc')).toBe(
        'https://explorer.testnet.arc.io/tx/0xabc'
      )
    })
  })
})
