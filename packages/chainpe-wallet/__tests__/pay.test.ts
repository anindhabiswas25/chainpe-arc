import { describe, it, expect, vi, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from '../src/types.js'
import { SpendingTracker } from '../src/spending.js'
import { registerPay } from '../src/tools/pay.js'

// Public Hardhat test key #0 (not a secret); signing is real.
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const PAYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

function decode(header: string) {
  return JSON.parse(Buffer.from(header, 'base64').toString())
}

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    privateKey: undefined,
    network: 'arc-testnet',
    registryAddress: undefined,
    budget: { maxPerCall: '1.00', maxPerDay: '20.00' },
    canPay: false,
    mode: 'READ_ONLY',
    reload: vi.fn(),
    ...overrides
  }
}

function payableConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return makeConfig({ canPay: true, privateKey: KEY, mode: 'PAYMENTS', ...overrides })
}

function extractToolHandler(
  server: McpServer
): (...args: unknown[]) => Promise<unknown> {
  const calls = vi.mocked(server.tool).mock.calls
  const call = calls.find(c => c[0] === 'pay')
  return call![call!.length - 1] as (...args: unknown[]) => Promise<unknown>
}

const RECIPIENT = '0x1111111111111111111111111111111111111111'

describe('pay tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers the tool with correct name', () => {
    const server = { tool: vi.fn() } as unknown as McpServer
    const config = makeConfig()
    registerPay(server, config, new SpendingTracker(config.budget))
    expect(server.tool).toHaveBeenCalledWith(
      'pay',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    )
  })

  it('returns error when no wallet configured', async () => {
    const server = { tool: vi.fn() } as unknown as McpServer
    const config = makeConfig({ canPay: false })
    registerPay(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({
      amount: '0.05',
      recipient: RECIPIENT,
      network: 'arc-testnet'
    })) as { isError: boolean; content: { text: string }[] }

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No wallet configured')
  })

  it('rejects payment exceeding per-call budget', async () => {
    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig({ budget: { maxPerCall: '0.01', maxPerDay: '20.00' } })
    registerPay(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({
      amount: '0.50',
      recipient: RECIPIENT,
      network: 'arc-testnet'
    })) as { isError: boolean; content: { text: string }[] }

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('exceeds per-call limit')
  })

  it('returns a PAYMENT-SIGNATURE header on success', async () => {
    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    registerPay(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({
      amount: '0.05',
      recipient: RECIPIENT,
      network: 'arc-testnet',
      resource: 'https://api.example.com/data'
    })) as { content: { text: string }[] }

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.headerName).toBe('PAYMENT-SIGNATURE')
    expect(parsed.amount).toBe('0.05 USDC')
    expect(parsed.recipient).toBe(RECIPIENT)
    expect(parsed.network).toBe('arc-testnet')
    expect(parsed.hint).toContain('PAYMENT-SIGNATURE')
    const payload = decode(parsed.paymentHeader)
    expect(payload.resource.url).toBe('https://api.example.com/data')
    expect(payload.payload.authorization.from).toBe(PAYER)
  })

  it('builds v2 requirements with the atomic amount and the Arc USDC domain', async () => {
    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    registerPay(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({ amount: '0.05', recipient: RECIPIENT, network: 'arc-testnet' })) as {
      content: { text: string }[]
    }

    const { accepted, payload } = decode(JSON.parse(result.content[0].text).paymentHeader)
    expect(accepted).toMatchObject({
      scheme: 'exact',
      network: 'eip155:5042002',
      amount: '50000', // 0.05 * 1e6
      asset: '0x3600000000000000000000000000000000000000',
      payTo: RECIPIENT,
      extra: { name: 'USDC', version: '2' }
    })
    expect(payload.authorization.value).toBe('50000')
  })

  it('records spending after successful payment', async () => {
    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    const spending = new SpendingTracker(config.budget)
    registerPay(server, config, spending)

    const handler = extractToolHandler(server)
    await handler({ amount: '0.05', recipient: RECIPIENT, network: 'arc-testnet' })

    const summary = spending.getSummary()
    expect(parseFloat(summary.spentSession)).toBeCloseTo(0.05)
    expect(summary.recentPayments).toHaveLength(1)
    expect(summary.recentPayments[0].recipient).toBe(RECIPIENT)
  })

  it('returns an error and records nothing when signing fails', async () => {
    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    const spending = new SpendingTracker(config.budget)
    registerPay(server, config, spending)

    const handler = extractToolHandler(server)
    const result = (await handler({
      amount: '0.05',
      recipient: 'not-an-address',
      network: 'arc-testnet'
    })) as { isError: boolean; content: { text: string }[] }

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Payment failed')
    expect(parseFloat(spending.getSummary().spentSession)).toBe(0)
    expect(spending.getSummary().recentPayments).toHaveLength(0)
  })
})
