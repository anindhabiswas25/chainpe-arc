import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Hash } from 'viem'
import SettlementView from '@/components/app/SettlementView'

export const metadata: Metadata = { title: 'Settlement | ChainPe on Arc Testnet' }

export default async function TxPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) notFound()

  return (
    <section className="section app-page">
      <div className="container">
        <Link className="app-link app-small" href="/wallet">← Wallet</Link>
        <h1 className="section-title">Transaction</h1>
        <p className="section-description app-mono app-break">{hash}</p>
        <SettlementView hash={hash as Hash} />
      </div>
    </section>
  )
}
