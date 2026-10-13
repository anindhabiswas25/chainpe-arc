import type { PaymentNetwork, AppConfig } from '@/types.js'
import { ARC_TESTNET_CONTRACTS } from '@chainpearc/sdk/arc'
import { loadWalletConfig } from '@/wallet-store.js'

export function loadConfig(): AppConfig {
  const state = buildState()
  return {
    ...state,
    reload() {
      const fresh = buildState()
      Object.assign(this, fresh)
    }
  }
}

// Arc Testnet is the only supported network; any other value falls back to it.
function normalizeNetwork(_value: string | undefined): PaymentNetwork {
  return 'arc-testnet'
}

function buildState(): Omit<AppConfig, 'reload'> {
  const wallet = loadWalletConfig()

  const privateKey =
    process.env.CHAINPE_PRIVATE_KEY ?? wallet?.privateKey ?? undefined
  const network = normalizeNetwork(process.env.NETWORK ?? wallet?.network)
  // Empty strings (e.g. a blank MCPB field) fall through to the deployed default.
  const registryAddress =
    process.env.CHAINPE_REGISTRY_ADDRESS ||
    wallet?.registryAddress ||
    ARC_TESTNET_CONTRACTS.chainPeRegistry
  const reputationRegistry =
    process.env.ERC8004_REPUTATION_REGISTRY || wallet?.reputationRegistry || undefined

  const maxPerCall = process.env.MAX_PER_CALL ?? '0.10'
  const maxPerDay = process.env.MAX_PER_DAY ?? '20.00'

  const canPay = !!privateKey

  return {
    privateKey,
    network,
    registryAddress,
    reputationRegistry,
    budget: { maxPerCall, maxPerDay },
    canPay,
    mode: canPay ? 'PAYMENTS' : 'READ_ONLY'
  }
}
