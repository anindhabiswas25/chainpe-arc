import type { Metadata } from 'next'
import Link from 'next/link'
import TxLookup from '@/components/app/TxLookup'
import WalletPanel from '@/components/app/WalletPanel'

export const metadata: Metadata = {
  title: 'Wallet | ChainPe on Arc Testnet',
  description: 'Connect a wallet to Arc Testnet, check your USDC balance, and look up x402 settlements.',
}

export default function WalletPage() {
  return (
    <section className="section app-page">
      <div className="container">
        <h1 className="section-title">Wallet</h1>
        <p className="section-description">
          Connect a browser wallet to see your USDC on Arc Testnet and recent payments. Gas on Arc is paid in USDC.
        </p>
        <WalletPanel />
        <p className="app-small app-muted">
          This page only reads. To send transactions, <Link className="app-link" href="/register">register a service</Link> or{' '}
          <Link className="app-link" href="/vault">fund an agent budget in the PolicyVault</Link>.
        </p>

        <h2 className="app-h2">Look up a settlement</h2>
        <p className="app-muted">Paste any Arc Testnet transaction hash, for example from an x402 <code>PAYMENT-RESPONSE</code> header or a facilitator <code>/settle</code> response.</p>
        <TxLookup />
      </div>
    </section>
  )
}
