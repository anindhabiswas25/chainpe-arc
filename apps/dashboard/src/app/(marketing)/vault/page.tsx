import type { Metadata } from 'next'
import VaultPanel from '@/components/app/VaultPanel'

export const metadata: Metadata = {
  title: 'Policy Vault | ChainPe on Arc Testnet',
  description: 'Fund an agent budget in the ChainPe PolicyVault on Arc Testnet: deposit USDC, set per-call, daily and total limits, withdraw.',
}

export default function VaultPage() {
  return (
    <section className="section app-page">
      <div className="container">
        <h1 className="section-title">Policy Vault</h1>
        <p className="section-description">
          Give an agent a USDC budget it cannot overspend. Deposit into the PolicyVault, authorise the agent&apos;s session
          key with per-call, daily and total limits, and withdraw whatever is left at any time.
        </p>
        <VaultPanel />
      </div>
    </section>
  )
}
