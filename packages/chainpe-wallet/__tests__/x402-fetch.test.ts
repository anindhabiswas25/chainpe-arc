import { describe, it, expect, vi, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { recoverTypedDataAddress } from 'viem'
import { encodePaymentRequiredHeader } from '@x402/core/http'
import { ARC_USDC_EIP712_DOMAIN } from '@chainpearc/sdk/arc'
import type { AppConfig } from '../src/types.js'
import { SpendingTracker } from '../src/spending.js'
import { registerX402Fetch } from '../src/tools/x402-fetch.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Public Hardhat test key #0 (not a secret); signing is real.
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const PAYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const USDC_ARC = '0x3600000000000000000000000000000000000000'
const RECIPIENT = '0x1111111111111111111111111111111111111111'

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

function acceptsArc(amount: string) {
  return {
    scheme: 'exact',
    network: 'eip155:5042002',
    asset: USDC_ARC,
    amount,
    payTo: RECIPIENT,
    maxTimeoutSeconds: 300,
    extra: { name: 'USDC', version: '2' }
  }
}

/** An x402 v2 402 response carrying the challenge in PAYMENT-REQUIRED. */
function challenge(accepts: Record<string, unknown>[]): Response {
  return new Response('{}', {
    status: 402,
    statusText: 'Payment Required',
    headers: {
      'content-type': 'application/json',
      'PAYMENT-REQUIRED': encodePaymentRequiredHeader({
        x402Version: 2,
        resource: { url: 'https://api.example.com/paid' },
        accepts
      } as never)
    }
  })
}

function textResponse(status: number, body: string, contentType = 'text/plain'): Response {
  return new Response(body, { status, headers: { 'content-type': contentType } })
}

function extractToolHandler(
  server: McpServer
): (...args: unknown[]) => Promise<unknown> {
  const calls = vi.mocked(server.tool).mock.calls
  const call = calls.find(c => c[0] === 'x402_fetch')
  return call![call!.length - 1] as (...args: unknown[]) => Promise<unknown>
}

type ToolResult = {
  isError?: boolean
  content: { type: string; text: string }[]
}

describe('x402_fetch tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers the tool with correct name', () => {
    const server = { tool: vi.fn() } as unknown as McpServer
    const config = makeConfig()
    registerX402Fetch(server, config, new SpendingTracker(config.budget))
    expect(server.tool).toHaveBeenCalledWith(
      'x402_fetch',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    )
  })

  it('returns error when no wallet configured', async () => {
    const server = { tool: vi.fn() } as unknown as McpServer
    const config = makeConfig({ canPay: false })
    registerX402Fetch(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({
      url: 'https://api.example.com/data',
      method: 'GET'
    })) as ToolResult

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No wallet configured')
  })

  it('returns response directly when status is not 402', async () => {
    mockFetch.mockResolvedValue(textResponse(200, '{"result":"success"}', 'application/json'))

    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    registerX402Fetch(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({
      url: 'https://api.example.com/free',
      method: 'GET'
    })) as ToolResult

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.status).toBe(200)
    expect(parsed.body).toBe('{"result":"success"}')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('handles 402 and retries with a correctly signed PAYMENT-SIGNATURE', async () => {
    mockFetch.mockResolvedValueOnce(challenge([acceptsArc('50000')])) // 0.05 USDC
    mockFetch.mockResolvedValueOnce(textResponse(200, 'paid content'))

    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    registerX402Fetch(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({
      url: 'https://api.example.com/paid',
      method: 'GET'
    })) as ToolResult

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.status).toBe(200)
    expect(parsed.body).toBe('paid content')
    expect(parsed.payment.amount).toBe('0.050000 USDC')
    expect(parsed.payment.recipient).toBe(RECIPIENT)
    expect(parsed.payment.network).toBe('arc-testnet')
    expect(mockFetch).toHaveBeenCalledTimes(2)

    const header = mockFetch.mock.calls[1][1].headers['PAYMENT-SIGNATURE']
    const payload = JSON.parse(Buffer.from(header, 'base64').toString())
    expect(payload.x402Version).toBe(2)
    expect(payload.accepted.network).toBe('eip155:5042002')
    const auth = payload.payload.authorization
    expect(auth.to).toBe(RECIPIENT)
    expect(auth.value).toBe('50000')
    // The signature must recover under Arc USDC's real EIP-712 domain.
    const signer = await recoverTypedDataAddress({
      domain: ARC_USDC_EIP712_DOMAIN,
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' }
        ]
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: auth.from,
        to: auth.to,
        value: BigInt(auth.value),
        validAfter: BigInt(auth.validAfter),
        validBefore: BigInt(auth.validBefore),
        nonce: auth.nonce
      },
      signature: payload.payload.signature
    })
    expect(signer).toBe(PAYER)
  })

  it('returns error when 402 has no accepts', async () => {
    mockFetch.mockResolvedValueOnce(challenge([]))

    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    registerX402Fetch(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({
      url: 'https://api.example.com/paid',
      method: 'GET'
    })) as ToolResult

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('no payment options')
  })

  it('returns error when wallet cannot fulfill any accepted network', async () => {
    mockFetch.mockResolvedValueOnce(
      challenge([
        {
          scheme: 'exact',
          network: 'eip155:84532', // Base Sepolia, not Arc
          asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          amount: '500000',
          payTo: RECIPIENT,
          maxTimeoutSeconds: 300,
          extra: {}
        }
      ])
    )

    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    registerX402Fetch(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({
      url: 'https://api.example.com/paid',
      method: 'GET'
    })) as ToolResult

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Cannot fulfill payment')
  })

  it('checks spending limits before signing', async () => {
    mockFetch.mockResolvedValueOnce(challenge([acceptsArc('5000000')])) // 5.0 USDC, over the 1.00 cap

    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig({ budget: { maxPerCall: '1.00', maxPerDay: '20.00' } })
    registerX402Fetch(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({
      url: 'https://api.example.com/expensive',
      method: 'GET'
    })) as ToolResult

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('exceeds per-call limit')
    expect(mockFetch).toHaveBeenCalledTimes(1) // never signed or retried
  })

  it('returns funding instructions when retry also returns 402 (settle failure)', async () => {
    mockFetch
      .mockResolvedValueOnce(challenge([acceptsArc('20000')])) // 0.02 USDC
      .mockResolvedValueOnce(textResponse(402, '{}', 'application/json'))

    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    const spending = new SpendingTracker(config.budget)
    registerX402Fetch(server, config, spending)

    const handler = extractToolHandler(server)
    const result = (await handler({
      url: 'https://api.example.com/paid',
      method: 'GET'
    })) as ToolResult

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('wallet needs')
    expect(result.content[0].text).toContain('faucet.circle.com')
    expect(parseFloat(spending.getSummary().spentSession)).toBe(0)
    expect(spending.getSummary().recentPayments).toHaveLength(0)
  })

  it('records spending after successful paid fetch', async () => {
    mockFetch
      .mockResolvedValueOnce(challenge([acceptsArc('50000')]))
      .mockResolvedValueOnce(textResponse(200, 'result'))

    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    const spending = new SpendingTracker(config.budget)
    registerX402Fetch(server, config, spending)

    const handler = extractToolHandler(server)
    await handler({ url: 'https://api.example.com/paid', method: 'GET' })

    const summary = spending.getSummary()
    expect(parseFloat(summary.spentSession)).toBeCloseTo(0.05)
    expect(summary.recentPayments).toHaveLength(1)
    expect(summary.recentPayments[0].recipient).toBe(RECIPIENT)
  })

  it('passes custom headers and body to fetch', async () => {
    mockFetch.mockResolvedValue(textResponse(200, 'ok'))

    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    registerX402Fetch(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    await handler({
      url: 'https://api.example.com/data',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"key":"value"}'
    })

    const [, options] = mockFetch.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe('{"key":"value"}')
  })

  it('handles fetch network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const server = { tool: vi.fn() } as unknown as McpServer
    const config = payableConfig()
    registerX402Fetch(server, config, new SpendingTracker(config.budget))

    const handler = extractToolHandler(server)
    const result = (await handler({
      url: 'https://api.example.com/down',
      method: 'GET'
    })) as ToolResult

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Network error')
  })
})
