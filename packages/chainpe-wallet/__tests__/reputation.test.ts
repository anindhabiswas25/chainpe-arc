import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppConfig } from '../src/types.js'

const mockRead = vi.fn()
vi.mock('../src/clients.js', () => ({
  publicClientFor: () => ({ readContract: (...a: unknown[]) => mockRead(...a) }),
  rpcUrlFor: () => 'http://rpc'
}))

import { getReputation, resolveReputationRegistry } from '../src/reputation.js'

function cfg(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    privateKey: '0xkey',
    network: 'arc-testnet',
    budget: { maxPerCall: '1', maxPerDay: '1' },
    canPay: true,
    mode: 'PAYMENTS',
    reload: () => {},
    ...overrides
  }
}

describe('resolveReputationRegistry', () => {
  beforeEach(() => {
    delete process.env.ERC8004_REPUTATION_REGISTRY
  })

  it("defaults to Arc's canonical ERC-8004 Reputation Registry", () => {
    expect(resolveReputationRegistry(cfg())).toBe('0x8004B663056A597Dffe9eCcC1965A193B7388713')
  })

  it('honors an explicit config address', () => {
    const a = '0x1111111111111111111111111111111111111111'
    expect(resolveReputationRegistry(cfg({ reputationRegistry: a }))).toBe(a)
  })
})

// Arbitrary registry address; reads are mocked.
const REP = '0x3333333333333333333333333333333333333333'

describe('getReputation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ERC8004_REPUTATION_REGISTRY
  })

  it('returns null for an unlinked agent (id 0)', async () => {
    expect(await getReputation(cfg(), '0')).toBeNull()
  })

  it('returns count 0 / score null when there is no feedback', async () => {
    mockRead.mockImplementation((args: { functionName: string }) =>
      args.functionName === 'getClients' ? [] : undefined
    )
    expect(await getReputation(cfg({ reputationRegistry: REP }), '5')).toEqual({ count: 0, score: null })
  })

  it('aggregates the on-chain score across clients', async () => {
    mockRead.mockImplementation((args: { functionName: string }) => {
      if (args.functionName === 'getClients') return ['0xabc0000000000000000000000000000000000001']
      if (args.functionName === 'getSummary') return [3n, 90n, 0]
      return undefined
    })
    expect(await getReputation(cfg({ reputationRegistry: REP }), '5')).toEqual({ count: 3, score: 90 })
  })

  it('applies valueDecimals when scaling the score', async () => {
    mockRead.mockImplementation((args: { functionName: string }) => {
      if (args.functionName === 'getClients') return ['0xabc0000000000000000000000000000000000001']
      if (args.functionName === 'getSummary') return [2n, 855n, 1] // 85.5
      return undefined
    })
    expect(await getReputation(cfg({ reputationRegistry: REP }), '5')).toEqual({ count: 2, score: 85.5 })
  })
})
