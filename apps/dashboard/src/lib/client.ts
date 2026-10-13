import { createPublicClient, http, parseAbiItem } from 'viem'
import { ARC_RPC_URL, arcTestnet } from './arc'

/** Read-only Arc Testnet client (talks to the RPC directly, no wallet needed). */
// `batch` folds reads issued in the same tick into one JSON-RPC batch request:
// the public Arc RPC answers bursts of single calls with HTTP 429.
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL, { batch: true, retryCount: 5, retryDelay: 400 }),
})

/** Standard ERC-20 ABI (viem's); USDC on Arc implements it at 6 decimals. */
export { erc20Abi } from 'viem'

export const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)
/** EIP-3009: emitted by USDC when an x402 authorization is settled. */
export const authorizationUsedEvent = parseAbiItem(
  'event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)',
)

/** The public Arc RPC rejects filtered eth_getLogs spans of 10,000+ blocks. */
export const LOG_WINDOW = 9_999n
