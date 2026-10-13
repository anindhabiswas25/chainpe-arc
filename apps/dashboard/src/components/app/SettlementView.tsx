'use client'

import { useEffect, useState } from 'react'
import { formatUnits, isAddressEqual, parseEventLogs, type Hash, type Transaction, type TransactionReceipt } from 'viem'
import { USDC_ADDRESS, USDC_DECIMALS, addressUrl, txUrl } from '@/lib/arc'
import { authorizationUsedEvent, publicClient, transferEvent } from '@/lib/client'
import { decodeCall, decodeLogs, type DecodedArg } from '@/lib/decode'

interface Loaded {
  receipt: TransactionReceipt
  tx: Transaction
  timestamp: bigint
}

function Arg({ arg }: { arg: DecodedArg }) {
  return (
    <>
      <dt>{arg.name}</dt>
      <dd>
        {arg.kind === 'address' ? (
          <a className="app-mono app-link" href={addressUrl(arg.value)} target="_blank" rel="noreferrer">{arg.value}</a>
        ) : (
          <span className={arg.kind === 'usdc' ? '' : 'app-mono'}>{arg.value}</span>
        )}
      </dd>
    </>
  )
}

export default function SettlementView({ hash }: { hash: Hash }) {
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [receipt, tx] = await Promise.all([publicClient.getTransactionReceipt({ hash }), publicClient.getTransaction({ hash })])
        const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber })
        if (!cancelled) setData({ receipt, tx, timestamp: block.timestamp })
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error && /NotFound/.test(e.name)
              ? 'No transaction with this hash on Arc Testnet (yet). Check the hash, or wait a few seconds and reload.'
              : 'Could not reach the Arc Testnet RPC.',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hash])

  if (error) return <div className="app-card app-warn">{error}</div>
  if (!data) return <div className="app-card">Loading transaction from Arc Testnet…</div>

  const usdcLogs = data.receipt.logs.filter(l => isAddressEqual(l.address, USDC_ADDRESS))
  const transfers = parseEventLogs({ abi: [transferEvent], logs: usdcLogs })
  const authorizations = parseEventLogs({ abi: [authorizationUsedEvent], logs: usdcLogs })
  const call = decodeCall(data.tx.to, data.tx.input)
  const { events, unknown } = decodeLogs(data.receipt.logs)
  const isSettlement = authorizations.length > 0
  const ok = data.receipt.status === 'success'

  const type = isSettlement
    ? 'x402 settlement (EIP-3009 transferWithAuthorization)'
    : call
      ? `${call.contract}.${call.functionName}`
      : transfers.length
        ? 'USDC transfer'
        : 'Other transaction'

  return (
    <>
      <div className="app-card">
        <div className="app-row">
          <div>
            <div className="app-label">Type</div>
            <div>{type}</div>
          </div>
          <div>
            <div className="app-label">Status</div>
            <div className={ok ? 'app-ok' : 'app-error'}>{ok ? 'Success' : 'Reverted'}</div>
          </div>
        </div>
        <div className="app-row">
          <div>
            <div className="app-label">Block</div>
            <div>{data.receipt.blockNumber.toString()}</div>
          </div>
          <div>
            <div className="app-label">Time (UTC)</div>
            <div>{new Date(Number(data.timestamp) * 1000).toISOString().replace('T', ' ').slice(0, 19)}</div>
          </div>
          <div>
            <div className="app-label">Gas paid (USDC)</div>
            <div>{formatUnits(data.receipt.gasUsed * data.receipt.effectiveGasPrice, 18)}</div>
          </div>
        </div>
        <div className="app-small">
          from <a className="app-mono app-link" href={addressUrl(data.receipt.from)} target="_blank" rel="noreferrer">{data.receipt.from}</a>
          {data.receipt.to && (
            <>
              <br />
              to <a className="app-mono app-link" href={addressUrl(data.receipt.to)} target="_blank" rel="noreferrer">{data.receipt.to}</a>
            </>
          )}
        </div>

        {transfers.map((t, i) => (
          <div className="app-transfer" key={i}>
            <div className="app-label">USDC moved</div>
            <div className="app-balance-value">{formatUnits(t.args.value, USDC_DECIMALS)} USDC</div>
            <div className="app-small">
              from <a className="app-mono app-link" href={addressUrl(t.args.from)} target="_blank" rel="noreferrer">{t.args.from}</a>
              <br />
              to <a className="app-mono app-link" href={addressUrl(t.args.to)} target="_blank" rel="noreferrer">{t.args.to}</a>
            </div>
          </div>
        ))}

        {authorizations.map((a, i) => (
          <p className="app-small app-muted" key={i}>
            Authorization nonce <span className="app-mono">{a.args.nonce}</span> signed by{' '}
            <span className="app-mono">{a.args.authorizer}</span>; submitted (and gas paid) by{' '}
            <a className="app-mono app-link" href={addressUrl(data.receipt.from)} target="_blank" rel="noreferrer">{data.receipt.from}</a>.
          </p>
        ))}

        <div className="app-actions">
          <a className="btn" href={txUrl(hash)} target="_blank" rel="noreferrer">View in explorer</a>
        </div>
      </div>

      {call && (
        <div className="app-card">
          <h3>Call: {call.contract}.{call.functionName}</h3>
          {call.args.length > 0 ? (
            <dl className="app-dl">{call.args.map(a => <Arg key={a.name} arg={a} />)}</dl>
          ) : (
            <p className="app-muted app-small">No arguments.</p>
          )}
        </div>
      )}

      {events.length > 0 && (
        <div className="app-card">
          <h3>Decoded events</h3>
          {events.map((ev, i) => (
            <div className="app-transfer" key={i}>
              <div className="app-label">{ev.contract}</div>
              <div><strong>{ev.name}</strong></div>
              {ev.args.length > 0 && <dl className="app-dl">{ev.args.map(a => <Arg key={a.name} arg={a} />)}</dl>}
            </div>
          ))}
          {unknown > 0 && <p className="app-small app-muted">{unknown} other log{unknown === 1 ? '' : 's'} from contracts the dashboard doesn&apos;t know.</p>}
        </div>
      )}
    </>
  )
}
