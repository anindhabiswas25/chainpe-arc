import type { Metadata } from 'next'
import Link from 'next/link'
import ReputationPanel from '@/components/app/ReputationPanel'
import { addressUrl } from '@/lib/arc'
import { findService } from '@/lib/services'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Service | ChainPe on Arc Testnet' }

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { result, source } = await findService(decodeURIComponent(id))

  return (
    <section className="section app-page">
      <div className="container">
        <Link className="app-link app-small" href="/marketplace">← Marketplace</Link>
        {result.state === 'error' && <div className="app-card app-warn">Could not load this service: <span className="app-mono">{result.message}</span></div>}
        {result.state === 'ok' && !result.data && (
          <div className="app-card app-warn">No service with id <span className="app-mono">{decodeURIComponent(id)}</span> is registered in the ChainPeRegistry.</div>
        )}
        {result.state === 'ok' && result.data && (() => {
          const s = result.data
          return (
            <>
              <h1 className="section-title">{s.name}</h1>
              <p className="section-description">{s.description}</p>
              <div className="app-card">
                <dl className="app-dl">
                  <dt>Endpoint</dt><dd className="app-mono">{s.endpoint}</dd>
                  <dt>Price</dt><dd>{s.pricePerRequest} {s.paymentToken} per request</dd>
                  <dt>Pays to</dt><dd><a className="app-mono app-link" href={addressUrl(s.walletAddress)} target="_blank" rel="noreferrer">{s.walletAddress}</a></dd>
                  <dt>Developer</dt><dd><a className="app-mono app-link" href={addressUrl(s.developer)} target="_blank" rel="noreferrer">{s.developer}</a></dd>
                  <dt>Network</dt><dd>{s.network}</dd>
                  <dt>Agent ID</dt><dd>{s.agentId ?? '—'}</dd>
                  {s.tags.length > 0 && (<><dt>Tags</dt><dd>{s.tags.join(', ')}</dd></>)}
                  <dt>Source</dt><dd className="app-muted">{source.kind === 'indexer' ? 'ChainPe indexer' : 'ChainPeRegistry on Arc Testnet (direct read)'}</dd>
                </dl>
              </div>
              <ReputationPanel agentId={s.agentId} endpoint={s.endpoint} />
            </>
          )
        })()}
      </div>
    </section>
  )
}
