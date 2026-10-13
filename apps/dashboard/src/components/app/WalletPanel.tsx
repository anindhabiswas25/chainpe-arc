'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatUnits, type Address, type Hash } from 'viem'
import { FAUCET_URL, USDC_ADDRESS, USDC_DECIMALS, addressUrl, shortAddress, txUrl } from '@/lib/arc'
import { LOG_WINDOW, erc20Abi, publicClient, transferEvent } from '@/lib/client'
import { useArcWallet } from '@/lib/useArcWallet'

/** How many 9,999-block windows to scan for recent activity (~1.4h each at ~0.5s blocks). */
const ACTIVITY_WINDOWS = 2
/** Stop scanning older windows once this many transfers are found. */
const ACTIVITY_LIMIT = 10

interface Activity {
  hash: Hash
  blockNumber: bigint
  direction: 'in' | 'out'
  counterparty: Address
  value: bigint
}

async function loadActivity(account: Address): Promise<Activity[]> {
  const head = await publicClient.getBlockNumber()
  const out: Activity[] = []
  for (let i = 0; i < ACTIVITY_WINDOWS; i++) {
    const toBlock = head - BigInt(i) * (LOG_WINDOW + 1n)
    const fromBlock = toBlock - LOG_WINDOW
    if (toBlock < 0n) break
    const range = { address: USDC_ADDRESS, event: transferEvent, fromBlock: fromBlock < 0n ? 0n : fromBlock, toBlock }
    // Sequential on purpose: the public RPC rate-limits bursts of eth_getLogs.
    const sent = await publicClient.getLogs({ ...range, args: { from: account } })
    const received = await publicClient.getLogs({ ...range, args: { to: account } })
    for (const l of sent) out.push({ hash: l.transactionHash, blockNumber: l.blockNumber, direction: 'out', counterparty: l.args.to!, value: l.args.value! })
    for (const l of received) out.push({ hash: l.transactionHash, blockNumber: l.blockNumber, direction: 'in', counterparty: l.args.from!, value: l.args.value! })
    if (out.length >= ACTIVITY_LIMIT) break
  }
  return out.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1))
}

const fmtUsdc = (v: bigint) => formatUnits(v, USDC_DECIMALS)

export default function WalletPanel() {
  const wallet = useArcWallet()
  const { account, onArc } = wallet
  const [balance, setBalance] = useState<bigint | null>(null)
  const [activity, setActivity] = useState<Activity[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!account) return
    setLoading(true)
    setLoadError(null)
    try {
      // Balances are read from Arc directly, so they show even before the
      // wallet switches network. Native gas and the ERC-20 balance are the
      // same USDC at different decimals — we show one figure.
      setBalance(
        await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
      )
      setActivity(await loadActivity(account))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message.split('\n')[0] : 'Could not reach the Arc Testnet RPC.')
    } finally {
      setLoading(false)
    }
  }, [account])

  useEffect(() => {
    setBalance(null)
    setActivity(null)
    void refresh()
  }, [refresh])

  if (!wallet.ready) return <div className="app-card">Checking for a browser wallet…</div>

  if (!wallet.hasProvider) {
    return (
      <div className="app-card">
        <h3>No browser wallet found</h3>
        <p className="app-muted">
          Install MetaMask (or any EIP-1193 wallet) to connect. You can still look up a settlement by
          transaction hash below.
        </p>
      </div>
    )
  }

  return (
    <>
      {!account ? (
        <div className="app-card">
          <h3>Connect a wallet</h3>
          <p className="app-muted">Read-only: the dashboard never asks you to sign a transaction here.</p>
          <button className="btn btn-primary" onClick={wallet.connect}>Connect wallet</button>
        </div>
      ) : (
        <>
          {!onArc && (
            <div className="app-card app-warn" role="alert">
              <h3>Wrong network</h3>
              <p>
                Your wallet is on chain {wallet.chainId ?? 'unknown'}. ChainPe runs on Arc Testnet
                (chain 5042002).
              </p>
              <button className="btn btn-primary" onClick={wallet.switchToArc}>Switch to Arc Testnet</button>
            </div>
          )}

          <div className="app-card">
            <div className="app-row">
              <div>
                <div className="app-label">Account</div>
                <a className="app-mono app-link" href={addressUrl(account)} target="_blank" rel="noreferrer">{account}</a>
              </div>
              <div>
                <div className="app-label">Network</div>
                <div>{onArc ? 'Arc Testnet ✓' : `chain ${wallet.chainId ?? '?'}`}</div>
              </div>
            </div>

            <div className="app-balance">
              <div className="app-label">USDC balance on Arc Testnet</div>
              <div className="app-balance-value">
                {balance === null ? (loading ? '…' : '—') : `${fmtUsdc(balance)} USDC`}
              </div>
              <p className="app-muted">Gas is paid in USDC. There is no separate gas token to hold.</p>
            </div>

            <div className="app-actions">
              <a className="btn btn-primary" href={FAUCET_URL} target="_blank" rel="noreferrer">Get testnet USDC</a>
              <button className="btn" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
            </div>
            <p className="app-muted app-small">
              Faucet: open faucet.circle.com, choose <strong>Arc Testnet</strong>, paste your address.
            </p>
          </div>

          <div className="app-card">
            <h3>Recent USDC activity</h3>
            <p className="app-muted app-small">
              USDC transfers to or from this account in roughly the last {ACTIVITY_WINDOWS * 1.4} hours, read from
              Arc Testnet. x402 settlements show up here as incoming or outgoing transfers.
            </p>
            {loadError && <p className="app-error">{loadError}</p>}
            {activity && activity.length === 0 && <p className="app-muted">No transfers in this window.</p>}
            {activity && activity.length > 0 && (
              <table className="app-table">
                <thead>
                  <tr><th></th><th>Amount</th><th>Counterparty</th><th>Tx</th></tr>
                </thead>
                <tbody>
                  {activity.map((a, i) => (
                    <tr key={`${a.hash}-${i}`}>
                      <td>{a.direction === 'in' ? '↓ in' : '↑ out'}</td>
                      <td>{fmtUsdc(a.value)} USDC</td>
                      <td>
                        <a className="app-mono app-link" href={addressUrl(a.counterparty)} target="_blank" rel="noreferrer">
                          {shortAddress(a.counterparty)}
                        </a>
                      </td>
                      <td>
                        <Link className="app-mono app-link" href={`/tx/${a.hash}`}>{shortAddress(a.hash)}</Link>
                        {' · '}
                        <a className="app-link" href={txUrl(a.hash)} target="_blank" rel="noreferrer">Explorer</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      {wallet.error && <p className="app-error">{wallet.error}</p>}
    </>
  )
}
