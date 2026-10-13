import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getAddress } from 'viem'
import type { PaymentRequirements } from '@x402/core/types'
import { ARC_USDC_EIP712_DOMAIN } from '@chainpearc/sdk/arc'
import type { AppConfig, PaymentNetwork } from '@/types.js'
import type { SpendingTracker } from '@/spending.js'
import {
  PAYMENT_NETWORKS,
  getX402Network,
  getUsdcAddress,
  USDC_DECIMALS
} from '@/clients.js'
import { createX402HttpClient } from '@/x402.js'

export function registerPay(
  server: McpServer,
  config: AppConfig,
  spending: SpendingTracker
): void {
  server.tool(
    'pay',
    'Sign and create an x402 payment header (USDC EIP-3009 transfer authorization) on Arc Testnet. ' +
      'Returns the x402 v2 PAYMENT-SIGNATURE header value to attach to your HTTP request.',
    {
      amount: z.string().describe('USDC amount as decimal string, e.g. "0.05"'),
      recipient: z.string().describe('Recipient EVM address (0x…)'),
      network: z
        .enum(PAYMENT_NETWORKS)
        .default('arc-testnet')
        .describe('Payment network'),
      resource: z
        .string()
        .optional()
        .describe('URL of the resource being paid for')
    },
    async ({ amount, recipient, network, resource }) => {
      if (!config.canPay) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No wallet configured. Set CHAINPE_PRIVATE_KEY to sign payments.'
            }
          ],
          isError: true
        }
      }

      const net = network as PaymentNetwork

      try {
        spending.check(amount)

        const paymentRequirements: PaymentRequirements = {
          scheme: 'exact',
          network: getX402Network(net),
          amount: toAtomicUnits(amount),
          asset: getUsdcAddress(net),
          payTo: getAddress(recipient),
          maxTimeoutSeconds: 300,
          // Arc USDC EIP-712 domain, verified on-chain against DOMAIN_SEPARATOR.
          extra: {
            name: ARC_USDC_EIP712_DOMAIN.name,
            version: ARC_USDC_EIP712_DOMAIN.version
          }
        }

        const http = createX402HttpClient(config)
        const payload = await http.createPaymentPayload({
          x402Version: 2,
          resource: { url: resource ?? 'https://chainpe.local/pay' },
          accepts: [paymentRequirements]
        })
        const [[headerName, headerValue]] = Object.entries(
          http.encodePaymentSignatureHeader(payload)
        )

        spending.record(amount, recipient, network)

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  paymentHeader: headerValue,
                  headerName,
                  amount: `${amount} USDC`,
                  recipient,
                  network,
                  resource: resource ?? null,
                  hint: `Set this as the ${headerName} header in your HTTP request.`
                },
                null,
                2
              )
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Payment failed: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )
}

function toAtomicUnits(amount: string): string {
  const parts = amount.split('.')
  const whole = parts[0] || '0'
  const frac = (parts[1] || '')
    .padEnd(USDC_DECIMALS, '0')
    .slice(0, USDC_DECIMALS)
  return (BigInt(whole) * BigInt(10 ** USDC_DECIMALS) + BigInt(frac)).toString()
}
