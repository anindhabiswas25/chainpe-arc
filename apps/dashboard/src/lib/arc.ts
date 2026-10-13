import { defineChain, getAddress, isAddress, type Address } from 'viem'

// Arc Testnet (ARC_INTEGRATION.md, docs/DEPLOYMENTS.md). Arc Testnet is the only
// network the dashboard supports.

export const ARC_CHAIN_ID = 5042002
/** 5042002 as the hex string wallets expect in wallet_switchEthereumChain. */
export const ARC_CHAIN_ID_HEX = '0x4cef52'

export const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.testnet.arc.io'
export const EXPLORER_URL = 'https://explorer.testnet.arc.io'
export const FAUCET_URL = 'https://faucet.circle.com'

/** USDC ERC-20 interface on Arc (6 decimals). Same funds as the native gas balance. */
export const USDC_ADDRESS: Address = '0x3600000000000000000000000000000000000000'
export const USDC_DECIMALS = 6

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Testnet',
  // Gas is paid in USDC; at the native-balance level it uses 18 decimals.
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
  blockExplorers: { default: { name: 'Arc Testnet Explorer', url: EXPLORER_URL } },
  testnet: true,
})

/** EIP-3085 params for wallet_addEthereumChain. */
export const ADD_CHAIN_PARAMS = {
  chainId: ARC_CHAIN_ID_HEX,
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: [ARC_RPC_URL],
  blockExplorerUrls: [EXPLORER_URL],
}

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`
export const addressUrl = (addr: string) => `${EXPLORER_URL}/address/${addr}`

function optionalAddress(value: string | undefined): Address | null {
  return value && isAddress(value) ? getAddress(value) : null
}

/**
 * Arc's canonical ERC-8004 registries (v2.0.0, listed on docs.arc.io and in
 * docs/DEPLOYMENTS.md). ChainPe uses these rather than deploying its own.
 */
const ARC_ERC8004 = {
  identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
  validation: '0x8004Cb1BF31DAf7788923b405b754f57acEB4272',
} as const

/**
 * ChainPe deployments on Arc Testnet (docs/DEPLOYMENTS.md, deployed 2026-10-13,
 * mirrored from contracts/deployments/arc-testnet*.json).
 */
const ARC_CHAINPE = {
  registry: '0x79c7a22993A40A3c88355b737e6F608c6610c395',
  policyVault: '0xcD5f994A57d7846c3DdFb471cBf4EdA0Bcf43a81',
  timelock: '0x5071794F30C32604Be115c00Ed041c403fB2f302',
} as const

/** Block the ChainPeRegistry proxy was deployed in: the floor for any log scan. */
export const REGISTRY_DEPLOY_BLOCK = 66_993_614n
/** Block the PolicyVault proxy was deployed in. */
export const VAULT_DEPLOY_BLOCK = 66_993_676n

/** Contract addresses, overridable via env (docs/DEPLOYMENTS.md). */
export const CONTRACTS = {
  registry: optionalAddress(process.env.NEXT_PUBLIC_CHAINPE_REGISTRY_ADDRESS || ARC_CHAINPE.registry),
  policyVault: optionalAddress(process.env.NEXT_PUBLIC_POLICY_VAULT_ADDRESS || ARC_CHAINPE.policyVault),
  timelock: optionalAddress(process.env.NEXT_PUBLIC_CHAINPE_TIMELOCK_ADDRESS || ARC_CHAINPE.timelock),
  identity: optionalAddress(process.env.NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY || ARC_ERC8004.identity),
  reputation: optionalAddress(process.env.NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY || ARC_ERC8004.reputation),
  validation: optionalAddress(process.env.NEXT_PUBLIC_ERC8004_VALIDATION_REGISTRY || ARC_ERC8004.validation),
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
