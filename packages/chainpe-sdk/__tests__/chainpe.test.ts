import { describe, it, expect, vi, afterEach } from 'vitest'
import { ChainPe } from '../src/chainpe.js'
import { ARC_TESTNET_CONTRACTS } from '../src/arc.js'
import { encodePaymentRequiredHeader } from '@x402/core/http'

/** A v2 402 challenge carried in the PAYMENT-REQUIRED header. */
function challenge(accepts: Record<string, unknown>[]) {
  const header = encodePaymentRequiredHeader({
    x402Version: 2,
    resource: { url: 'https://api.example.com/paid' },
    accepts
  } as never)
  return new Response('{}', {
    status: 402,
    headers: { 'content-type': 'application/json', 'PAYMENT-REQUIRED': header }
  })
}


// Well-known Hardhat test account #0 (public, not a real secret).
const TEST_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
// Arbitrary registry address; these tests never touch the chain.
const REG = '0x2222222222222222222222222222222222222222'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ChainPe construction', () => {
  it('requires a private key', () => {
    // @ts-expect-error intentional misuse
    expect(() => new ChainPe({})).toThrow(/privateKey/)
  })

  it('derives the wallet address and defaults to Arc Testnet', () => {
    const cp = new ChainPe({ privateKey: TEST_KEY, registryAddress: REG })
    expect(cp.getAddress().toLowerCase()).toBe(TEST_ADDR.toLowerCase())
    expect(cp.network).toBe('arc-testnet')
    expect(cp.registryAddress).toBe(REG)
  })

  it('defaults to the deployed Arc Testnet registry when none is configured', () => {
    const prev = process.env.CHAINPE_REGISTRY_ADDRESS
    delete process.env.CHAINPE_REGISTRY_ADDRESS
    try {
      const cp = new ChainPe({ privateKey: TEST_KEY })
      expect(cp.registryAddress).toBe(ARC_TESTNET_CONTRACTS.chainPeRegistry)
    } finally {
      if (prev !== undefined) process.env.CHAINPE_REGISTRY_ADDRESS = prev
    }
  })

  it('echoes config including maxPerCall default of 1 USDC', () => {
    const cp = new ChainPe({ privateKey: TEST_KEY, registryAddress: REG })
    expect(cp.config.maxPerCall).toBe('1')
    expect(cp.config.network).toBe('arc-testnet')
  })
})

describe('ChainPe.fetch / pay', () => {
  it('passes non-402 responses straight through (no payment)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ hello: 'world' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    )
    const cp = new ChainPe({ privateKey: TEST_KEY, registryAddress: REG })
    const res = await cp.fetch('https://api.example.com/free')
    expect(res.status).toBe(200)

    const paid = await cp.pay<{ hello: string }>('https://api.example.com/free')
    expect(paid.ok).toBe(true)
    expect(paid.data.hello).toBe('world')
    expect(paid.payment).toBeUndefined()
  })

  it('rejects a 402 that demands more than maxPerCall', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        challenge([
          {
            scheme: 'exact',
            network: 'eip155:5042002',
            asset: '0x3600000000000000000000000000000000000000',
            amount: '5000000', // 5 USDC > 1 default cap
            payTo: '0x1111111111111111111111111111111111111111',
            maxTimeoutSeconds: 60,
            extra: { name: 'USDC', version: '2' }
          }
        ])
      )
    )
    const cp = new ChainPe({ privateKey: TEST_KEY, network: 'arc-testnet', registryAddress: REG, maxPerCall: '1' })
    await expect(cp.fetch('https://api.example.com/paid')).rejects.toThrow(
      /exceeds maxPerCall/
    )
  })

  it('errors when the server accepts only foreign networks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        challenge([
          {
            scheme: 'exact',
            network: 'eip155:8453',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            amount: '1',
            payTo: '0x1111111111111111111111111111111111111111',
            maxTimeoutSeconds: 60,
            extra: {}
          }
        ])
      )
    )
    const cp = new ChainPe({ privateKey: TEST_KEY, network: 'arc-testnet', registryAddress: REG })
    await expect(cp.fetch('https://api.example.com/paid')).rejects.toThrow(
      /wallet is on arc-testnet/
    )
  })

  it('signs the Arc USDC offer and retries with PAYMENT-SIGNATURE', async () => {
    const calls: Request[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        calls.push(new Request(input, init))
        if (calls.length === 1) {
          return challenge([
            {
              scheme: 'exact',
              network: 'eip155:5042002',
              asset: '0x3600000000000000000000000000000000000000',
              amount: '10000',
              payTo: '0x1111111111111111111111111111111111111111',
              maxTimeoutSeconds: 60,
              extra: { name: 'USDC', version: '2' }
            }
          ])
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      })
    )
    const cp = new ChainPe({ privateKey: TEST_KEY, registryAddress: REG })
    const paid = await cp.pay<{ ok: boolean }>('https://api.example.com/paid')
    expect(paid.data.ok).toBe(true)
    expect(paid.payment).toMatchObject({ amount: '0.01', network: 'arc-testnet' })

    const header = calls[1].headers.get('PAYMENT-SIGNATURE')
    expect(header).toBeTruthy()
    const decoded = JSON.parse(Buffer.from(header!, 'base64').toString())
    expect(decoded.x402Version).toBe(2)
    expect(decoded.accepted.network).toBe('eip155:5042002')
    expect(decoded.payload.authorization.from.toLowerCase()).toBe(TEST_ADDR.toLowerCase())
    expect(decoded.payload.authorization.value).toBe('10000')
  })
})
