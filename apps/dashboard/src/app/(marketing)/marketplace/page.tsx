import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTRACTS, addressUrl, shortAddress } from '@/lib/arc'
import { listServices } from '@/lib/services'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Marketplace | ChainPe on Arc Testnet',
  description: 'x402 services registered on ChainPe, ranked by ERC-8004 reputation, priced in USDC on Arc Testnet.',
}

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const { result, source } = await listServices(q)

  return (
    <section className="section app-page">
      <div className="container">
        <h1 className="section-title">Marketplace</h1>
        <p className="section-description">
          x402 services registered in the ChainPe registry on Arc Testnet, ranked by ERC-8004 reputation. Prices are
          per request, in USDC.
        </p>

        <form className="waitlist-form" action="/marketplace">
          <input className="waitlist-input" name="q" defaultValue={q ?? ''} placeholder="Search name, description, tag" aria-label="Search services" />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>

        <p className="app-small app-muted">
          {source.kind === 'indexer' ? (
            <>Source: ChainPe indexer.</>
          ) : (
            <>
              Source: read directly from the{' '}
              {CONTRACTS.registry ? (
                <a className="app-link" href={addressUrl(CONTRACTS.registry)} target="_blank" rel="noreferrer">ChainPeRegistry</a>
              ) : 'ChainPeRegistry'}{' '}
              on Arc Testnet
              {source.indexer === 'unconfigured' ? ' (no INDEXER_URL set).' : ` (indexer unreachable: ${source.indexer}).`}
            </>
          )}
        </p>

        {result.state === 'error' && (
          <div className="app-card app-warn">
            <h3>Could not load services</h3>
            <p className="app-mono app-small">{result.message}</p>
          </div>
        )}
        {result.state === 'ok' && result.data.items.length === 0 && (
          <div className="app-card">
            {q ? `No services match “${q}”.` : 'No services are registered yet.'}{' '}
            <Link className="app-link" href="/register">Register the first one</Link>.
          </div>
        )}
        {result.state === 'ok' && result.data.items.length > 0 && (
          <div className="app-grid">
            {result.data.items.map(s => (
              <Link className="app-card app-service" key={s.id} href={`/services/${encodeURIComponent(s.id)}`}>
                <div className="app-row">
                  <h3>{s.name}</h3>
                  <span className="app-price">{s.pricePerRequest} USDC</span>
                </div>
                <p className="app-muted">{s.description}</p>
                <div className="app-tags">
                  {s.tags.map(t => <span className="app-tag" key={t}>{t}</span>)}
                </div>
                <div className="app-small app-muted">
                  {s.reputation?.count
                    ? `Reputation ${s.reputation.score?.toFixed(1) ?? '—'} from ${s.reputation.count} client${s.reputation.count === 1 ? '' : 's'}`
                    : 'No reputation yet'}
                  {' · '}pays {shortAddress(s.walletAddress)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
