'use client'

import Link from 'next/link'
import { txUrl } from '@/lib/arc'
import type { TxState } from '@/lib/tx'

function TxLinks({ hash }: { hash: string }) {
  return (
    <>
      {' '}
      <a className="app-link" href={txUrl(hash)} target="_blank" rel="noreferrer">Explorer</a>
      {' · '}
      <Link className="app-link" href={`/tx/${hash}`}>Decode</Link>
    </>
  )
}

/** One status line for the current write. */
export default function TxStatus({ state }: { state: TxState }) {
  switch (state.status) {
    case 'idle':
      return null
    case 'signing':
      return <p className="app-small" role="status">{state.label}: confirm in your wallet…</p>
    case 'pending':
      return <p className="app-small" role="status">{state.label}: waiting for Arc Testnet to include it…<TxLinks hash={state.hash} /></p>
    case 'success':
      return <p className="app-small app-ok" role="status">{state.label}: confirmed in block {state.receipt.blockNumber.toString()}.<TxLinks hash={state.hash} /></p>
    case 'reverted':
      return <p className="app-small app-error" role="alert">{state.label}: the transaction reverted on-chain.<TxLinks hash={state.hash} /></p>
    case 'error':
      return <p className="app-small app-error" role="alert">{state.label}: {state.message}</p>
  }
}
