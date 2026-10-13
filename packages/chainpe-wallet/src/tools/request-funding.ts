/**
 * request_funding — Generate an EIP-681 payment URI so a human (or another
 * agent) can top up this wallet with USDC on Arc Testnet.
 *
 * EIP-681 (https://eips.ethereum.org/EIPS/eip-681) is understood by MetaMask
 * and most EVM wallets.
 *   USDC:  ethereum:<usdc>@<chainId>/transfer?address=<wallet>&uint256=<atomic>
 *
 * On Arc, USDC is also the gas token, so a single USDC top-up covers both
 * payments and gas. Only the ERC-20 (6-decimal) link is offered: a
 * native-value (18-decimal) link would move the same funds and invites
 * decimal mistakes.
 */
import { z } from 'zod'
import { parseUnits } from 'viem'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig, PaymentNetwork } from '@/types.js'
import {
  CHAIN_IDS,
  PAYMENT_NETWORKS,
  getWalletAddress,
  getUsdcAddress,
  USDC_DECIMALS
} from '@/clients.js'

export function registerRequestFunding(
  server: McpServer,
  config: AppConfig
): void {
  server.tool(
    'request_funding',
    'Generate an EIP-681 payment link (and plain address) to ask a human or another agent to send ' +
      'USDC to this wallet on Arc Testnet (USDC also pays gas there). Use this when the wallet is low on funds.',
    {
      currency: z
        .enum(['USDC'])
        .default('USDC')
        .describe('Which currency to request — USDC'),
      amount: z.string().describe('Amount to request as decimal, e.g. "5.00"'),
      network: z
        .enum(PAYMENT_NETWORKS)
        .default('arc-testnet')
        .describe('Network (default: arc-testnet)')
    },
    async ({ currency, amount, network }) => {
      if (!config.privateKey) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No wallet configured. Set CHAINPE_PRIVATE_KEY.'
            }
          ],
          isError: true
        }
      }

      try {
        const net = network as PaymentNetwork
        const address = getWalletAddress(config)
        const chainId = CHAIN_IDS[net]

        const atomic = parseUnits(amount, USDC_DECIMALS)
        const uri = `ethereum:${getUsdcAddress(net)}@${chainId}/transfer?address=${address}&uint256=${atomic}`

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  message: `Please send ${amount} ${currency} to fund this agent wallet.`,
                  walletAddress: address,
                  currency,
                  amount: `${amount} ${currency}`,
                  network,
                  chainId,
                  paymentUri: uri,
                  instructions: [
                    '📱 Tap the paymentUri in a mobile EVM wallet (e.g. MetaMask) to prefill the transfer',
                    '📋 Or copy walletAddress and send manually on Arc Testnet'
                  ]
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
              text: `Error: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )
}
