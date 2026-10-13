import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AppConfig } from '@/types.js'
import { getWalletAddress, getUsdcBalance } from '@/clients.js'

export function registerCheckBalance(
  server: McpServer,
  config: AppConfig
): void {
  server.tool(
    'check_balance',
    'Check the wallet USDC balance (USDC is also the gas token) on Arc Testnet.',
    {},
    async () => {
      if (!config.canPay) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No wallet configured. Set CHAINPE_PRIVATE_KEY environment variable.'
            }
          ],
          isError: true
        }
      }

      try {
        const address = getWalletAddress(config)
        // On Arc the native gas balance and the USDC ERC-20 balance are the
        // same funds at 18 vs 6 decimals, so only the USDC figure is shown.
        const usdc = await getUsdcBalance(config.network, config)

        const result = {
          address,
          network: config.network,
          mode: config.mode,
          usdc: `${usdc} USDC`,
          gasNote:
            'USDC is also the gas token on Arc, so this one balance covers gas for direct transfers. x402 payments are gasless for you (the facilitator pays gas).'
        }

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(result, null, 2) }
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
