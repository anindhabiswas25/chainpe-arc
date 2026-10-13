'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getAddress, zeroHash, type Address, type Hash } from 'viem'
import { identityRegistryAbi, reputationRegistryAbi } from '@/abi'
import { CONTRACTS, addressUrl, shortAddress } from '@/lib/arc'
import { LOG_WINDOW, publicClient } from '@/lib/client'
import { readReputation } from '@/lib/registry'
import type { ReputationSummary } from '@/lib/services'
import { describeError, useTx, walletClientFor } from '@/lib/tx'
import TxStatus from './TxStatus'
import WalletGate from './WalletGate'

/** Scan this many 9,999-block windows (~1.4h each) for recent NewFeedback events. */
const FEEDBACK_WINDOWS = 3

const newFeedbackEvent = reputationRegistryAbi.find(
  (x): x is Extract<(typeof reputationRegistryAbi)[number], { type: 'event'; name: 'NewFeedback' }> => x.type === 'event' && x.name === 'NewFeedback',
)!

interface FeedbackRow {
  client: Address
  value: number
  tag1: string
  hash: Hash
  blockNumber: bigint
}

async function loadRecentFeedback(reputation: Address, agentId: bigint): Promise<FeedbackRow[]> {
  const head = await publicClient.getBlockNumber()
  const rows: FeedbackRow[] = []
  for (let i = 0; i < FEEDBACK_WINDOWS; i++) {
    const toBlock = head - BigInt(i) * (LOG_WINDOW + 1n)
    if (toBlock < 0n) break
    const fromBlock = toBlock > LOG_WINDOW ? toBlock - LOG_WINDOW : 0n
    const logs = await publicClient.getLogs({ address: reputation, event: newFeedbackEvent, args: { agentId }, fromBlock, toBlock })
    for (const l of logs) {
      rows.push({
        client: l.args.clientAddress!,
        value: Number(l.args.value!) / 10 ** l.args.valueDecimals!,
        tag1: l.args.tag1 ?? '',
        hash: l.transactionHash,
        blockNumber: l.blockNumber,
      })
    }
  }
  return rows.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1))
}

function GiveFeedback({ account, agentId, endpoint, owner, onDone }: { account: Address; agentId: bigint; endpoint: string; owner: Address | null; onDone: () => void }) {
  const tx = useTx()
  const [score, setScore] = useState('100')
  const [tag1, setTag1] = useState('x402-success')
  const [tag2, setTag2] = useState('')
  const [feedbackURI, setFeedbackURI] = useState('')
  const [selfAuthorized, setSelfAuthorized] = useState<boolean | null>(null)

  // The ReputationRegistry rejects feedback from the agent's owner or approved operators.
  useEffect(() => {
    const identity = CONTRACTS.identity
    if (!identity || !owner) return setSelfAuthorized(false)
    if (getAddress(owner) === account) return setSelfAuthorized(true)
    Promise.all([
      publicClient.readContract({ address: identity, abi: identityRegistryAbi, functionName: 'isApprovedForAll', args: [owner, account] }),
      publicClient.readContract({ address: identity, abi: identityRegistryAbi, functionName: 'getApproved', args: [agentId] }),
    ])
      .then(([operator, approved]) => setSelfAuthorized(operator || getAddress(approved) === account))
      .catch(() => setSelfAuthorized(false))
  }, [account, owner, agentId])

  const value = Number(score)
  const valid = Number.isInteger(value) && value >= 0 && value <= 100

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const reputation = CONTRACTS.reputation
    if (!reputation || !valid) return
    const receipt = await tx.run('Give feedback', async () => {
      const { request } = await publicClient.simulateContract({
        account,
        address: reputation,
        abi: reputationRegistryAbi,
        functionName: 'giveFeedback',
        args: [agentId, BigInt(value), 0, tag1.trim(), tag2.trim(), endpoint, feedbackURI.trim(), zeroHash],
      })
      return walletClientFor(account).writeContract(request)
    })
    if (receipt) onDone()
  }

  if (selfAuthorized) {
    return <p className="app-muted app-small">This wallet owns (or operates) agent #{agentId.toString()}. ERC-8004 does not allow self-feedback, so connect a different wallet to score it.</p>
  }

  return (
    <form className="app-form" onSubmit={submit}>
      <label>
        Score (0–100)
        <input className="waitlist-input" type="number" min={0} max={100} step={1} value={score} onChange={e => setScore(e.target.value)} required />
      </label>
      <label>
        Tag 1
        <input className="waitlist-input" value={tag1} onChange={e => setTag1(e.target.value)} placeholder="x402-success" />
      </label>
      <label>
        Tag 2 (optional)
        <input className="waitlist-input" value={tag2} onChange={e => setTag2(e.target.value)} />
      </label>
      <label>
        Feedback URI (optional)
        <input className="waitlist-input" value={feedbackURI} onChange={e => setFeedbackURI(e.target.value)} placeholder="ipfs://… or https://…" />
      </label>
      {!valid && <p className="app-error app-small">Score must be a whole number from 0 to 100.</p>}
      <div className="app-actions">
        <button type="submit" className="btn btn-primary" disabled={!valid || tx.busy || selfAuthorized === null}>Submit feedback</button>
      </div>
      <p className="app-small app-muted">Sends one transaction to the ERC-8004 ReputationRegistry; gas is paid in USDC (a fraction of a cent).</p>
      <TxStatus state={tx.state} />
    </form>
  )
}

export default function ReputationPanel({ agentId, endpoint }: { agentId: string | undefined; endpoint: string }) {
  const id = agentId ? BigInt(agentId) : 0n
  const [summary, setSummary] = useState<ReputationSummary | null>(null)
  const [owner, setOwner] = useState<Address | null>(null)
  const [recent, setRecent] = useState<FeedbackRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { reputation, identity } = CONTRACTS
    if (!id || !reputation) return
    setError(null)
    try {
      setSummary(await readReputation(id))
      if (identity) setOwner(await publicClient.readContract({ address: identity, abi: identityRegistryAbi, functionName: 'ownerOf', args: [id] }))
      setRecent(await loadRecentFeedback(reputation, id))
    } catch (e) {
      setError(describeError(e))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!id) {
    return (
      <div className="app-card">
        <h3>ERC-8004 reputation</h3>
        <p className="app-muted">
          This service has no ERC-8004 agent id, so clients cannot score it. The developer can create an identity and
          attach it from the <Link className="app-link" href="/register">register page</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="app-card">
      <h3>ERC-8004 reputation · agent #{id.toString()}</h3>
      <p className="app-small app-muted">
        Read live from the{' '}
        {CONTRACTS.reputation && <a className="app-link" href={addressUrl(CONTRACTS.reputation)} target="_blank" rel="noreferrer">ReputationRegistry</a>} on Arc Testnet.
        {owner && <> Agent owner <a className="app-mono app-link" href={addressUrl(owner)} target="_blank" rel="noreferrer">{shortAddress(owner)}</a>.</>}
      </p>
      {error && <p className="app-error app-small">{error}</p>}
      <div className="app-balance">
        <div className="app-label">Average score</div>
        <div className="app-balance-value">
          {summary === null ? '…' : summary.score === null ? 'No feedback yet' : `${summary.score} / 100`}
        </div>
        {summary && summary.count > 0 && <p className="app-muted app-small">from {summary.count} client{summary.count === 1 ? '' : 's'}</p>}
        {summary?.skipped ? (
          <p className="app-muted app-small">
            {summary.skipped} client{summary.skipped === 1 ? ' is' : 's are'} left out: they posted more feedback than the registry can summarise in one call.
          </p>
        ) : null}
      </div>

      {recent && recent.length > 0 && (
        <table className="app-table">
          <thead>
            <tr><th>Score</th><th>Tag</th><th>Client</th><th>Tx</th></tr>
          </thead>
          <tbody>
            {recent.slice(0, 10).map(r => (
              <tr key={`${r.hash}-${r.client}`}>
                <td>{r.value}</td>
                <td>{r.tag1 || '—'}</td>
                <td><a className="app-mono app-link" href={addressUrl(r.client)} target="_blank" rel="noreferrer">{shortAddress(r.client)}</a></td>
                <td><Link className="app-mono app-link" href={`/tx/${r.hash}`}>{shortAddress(r.hash)}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {recent && recent.length === 0 && <p className="app-small app-muted">No feedback in the last ~{FEEDBACK_WINDOWS * 1.4} hours.</p>}

      <h3 className="app-h3">Leave feedback</h3>
      <WalletGate purpose="score this service">
        {account => <GiveFeedback account={account} agentId={id} endpoint={endpoint} owner={owner} onDone={load} />}
      </WalletGate>
    </div>
  )
}
