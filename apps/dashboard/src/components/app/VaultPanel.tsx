'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatUnits, getAddress, isAddress, parseEventLogs, parseUnits, type Address, type Hash } from 'viem'
import { policyVaultAbi } from '@/abi'
import { CONTRACTS, FAUCET_URL, USDC_ADDRESS, USDC_DECIMALS, VAULT_DEPLOY_BLOCK, addressUrl, shortAddress } from '@/lib/arc'
import { LOG_WINDOW, erc20Abi, publicClient } from '@/lib/client'
import { describeError, useTx, walletClientFor } from '@/lib/tx'
import TxStatus from './TxStatus'
import WalletGate from './WalletGate'

const fmt = (v: bigint) => formatUnits(v, USDC_DECIMALS)
/** Parses a USDC amount typed by the user; null if it isn't one. */
function parseUsdc(s: string): bigint | null {
  const t = s.trim()
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return null
  return parseUnits(t, USDC_DECIMALS)
}

/** Scan at most this many 9,999-block windows back from head for vault events. */
const ACTIVITY_WINDOWS = 4
const VAULT_EVENTS = ['Deposited', 'Withdrawn', 'Spent', 'PolicySet', 'SessionRevoked', 'AllowlistUpdated'] as const
const vaultEvents = policyVaultAbi.filter(x => x.type === 'event' && (VAULT_EVENTS as readonly string[]).includes(x.name))

interface Policy {
  maxPerCall: bigint
  dailyCap: bigint
  totalBudget: bigint
  sessionKey: Address
  expiry: bigint
  allowlistOnly: boolean
  active: boolean
}

interface State {
  paused: boolean
  vaultBalance: bigint
  walletBalance: bigint
  allowance: bigint
  policy: Policy
  dailyRemaining: bigint
  budgetRemaining: bigint
  totalSpent: bigint
}

interface Activity {
  name: string
  detail: string
  hash: Hash
  blockNumber: bigint
}

async function loadActivity(vault: Address, owner: Address): Promise<Activity[]> {
  const head = await publicClient.getBlockNumber()
  const out: Activity[] = []
  for (let i = 0; i < ACTIVITY_WINDOWS; i++) {
    const toBlock = head - BigInt(i) * (LOG_WINDOW + 1n)
    if (toBlock < VAULT_DEPLOY_BLOCK) break
    const fromBlock = toBlock - LOG_WINDOW > VAULT_DEPLOY_BLOCK ? toBlock - LOG_WINDOW : VAULT_DEPLOY_BLOCK
    // The vault is low-traffic: fetch its logs per window and keep this owner's.
    const raw = await publicClient.getLogs({ address: vault, fromBlock, toBlock })
    const logs = parseEventLogs({ abi: vaultEvents, logs: raw, args: { owner } })
    for (const l of logs) {
      const a = l.args as Record<string, unknown>
      const detail =
        l.eventName === 'Deposited' || l.eventName === 'Withdrawn' ? `${fmt(a.amount as bigint)} USDC`
        : l.eventName === 'Spent' ? `${fmt(a.amount as bigint)} USDC → ${shortAddress(a.to as string)}`
        : l.eventName === 'PolicySet' ? `session ${shortAddress(a.sessionKey as string)}, ${fmt(a.dailyCap as bigint)}/day`
        : l.eventName === 'AllowlistUpdated' ? `${shortAddress(a.to as string)} ${a.allowed ? 'allowed' : 'removed'}`
        : `session ${shortAddress(a.sessionKey as string)}`
      out.push({ name: l.eventName, detail, hash: l.transactionHash, blockNumber: l.blockNumber })
    }
  }
  return out.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1))
}

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

function Vault({ account }: { account: Address }) {
  const vault = CONTRACTS.policyVault!
  const tx = useTx()
  const [s, setS] = useState<State | null>(null)
  const [activity, setActivity] = useState<Activity[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [depositAmt, setDepositAmt] = useState('1')
  const [withdrawAmt, setWithdrawAmt] = useState('')
  const [policy, setPolicy] = useState({
    sessionKey: '',
    maxPerCall: '0.10',
    dailyCap: '1',
    totalBudget: '5',
    expiry: toLocalInput(new Date(Date.now() + 7 * 86_400_000)),
    allowlistOnly: false,
  })
  const [allowTo, setAllowTo] = useState('')
  const [allowStatus, setAllowStatus] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const read = { address: vault, abi: policyVaultAbi } as const
      const [paused, vaultBalance, p, dailyRemaining, budgetRemaining, totalSpent, walletBalance, allowance] = await Promise.all([
        publicClient.readContract({ ...read, functionName: 'paused' }),
        publicClient.readContract({ ...read, functionName: 'balanceOf', args: [account] }),
        publicClient.readContract({ ...read, functionName: 'policyOf', args: [account] }),
        publicClient.readContract({ ...read, functionName: 'dailyRemaining', args: [account] }),
        publicClient.readContract({ ...read, functionName: 'budgetRemaining', args: [account] }),
        publicClient.readContract({ ...read, functionName: 'totalSpent', args: [account] }),
        publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
        publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [account, vault] }),
      ])
      const [maxPerCall, dailyCap, totalBudget, sessionKey, expiry, allowlistOnly, active] = p
      setS({ paused, vaultBalance, walletBalance, allowance, dailyRemaining, budgetRemaining, totalSpent, policy: { maxPerCall, dailyCap, totalBudget, sessionKey, expiry, allowlistOnly, active } })
      setActivity(await loadActivity(vault, account))
    } catch (e) {
      setLoadError(describeError(e))
    }
  }, [account, vault])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (loadError) return <div className="app-card app-warn">Could not read the PolicyVault: {loadError} <button className="btn" onClick={refresh}>Retry</button></div>
  if (!s) return <div className="app-card">Reading the PolicyVault on Arc Testnet…</div>

  /** Simulates (to surface the revert reason before the wallet opens), sends, waits, refreshes. */
  const act = (label: string, send: () => Promise<Hash>) => tx.run(label, send).then(async r => { await refresh(); return r })
  const vaultCall = { account, address: vault, abi: policyVaultAbi } as const
  const wallet = () => walletClientFor(account)

  const setAllowlisted = async (allowed: boolean) => {
    const receipt = await act(allowed ? 'Allow recipient' : 'Remove recipient', async () =>
      wallet().writeContract((await publicClient.simulateContract({ ...vaultCall, functionName: 'setAllowlist', args: [getAddress(allowTo.trim()), allowed] })).request),
    )
    if (receipt) setAllowStatus(allowed)
  }

  const dep = parseUsdc(depositAmt)
  const depError = dep === null || dep === 0n ? 'Enter a USDC amount.' : dep > s.walletBalance ? `You hold ${fmt(s.walletBalance)} USDC.` : null
  const depNeedsApproval = dep !== null && dep > 0n && s.allowance < dep

  const wd = parseUsdc(withdrawAmt)
  const wdError = wd === null || wd === 0n ? 'Enter a USDC amount.' : wd > s.vaultBalance ? `Vault balance is ${fmt(s.vaultBalance)} USDC.` : null

  const pMax = parseUsdc(policy.maxPerCall)
  const pDaily = parseUsdc(policy.dailyCap)
  const pBudget = parseUsdc(policy.totalBudget)
  const pExpiry = Math.floor(new Date(policy.expiry).getTime() / 1000)
  const policyError =
    !isAddress(policy.sessionKey.trim()) ? 'Session key must be an address (the agent key that signs spends).'
    : pMax === null || pDaily === null || pBudget === null ? 'Limits must be USDC amounts.'
    : pDaily === 0n ? 'Daily cap must be greater than zero.'
    : pMax > pBudget ? 'Max per call cannot exceed the total budget.'
    : !(pExpiry > Date.now() / 1000) ? 'Expiry must be in the future.'
    : null

  const p = s.policy
  const expired = p.expiry > 0n && Number(p.expiry) * 1000 < Date.now()

  return (
    <>
      {s.paused && <div className="app-card app-warn">The vault is paused by its owner: deposits and spending are disabled. Withdrawals still work.</div>}

      <div className="app-card">
        <div className="app-row">
          <div>
            <div className="app-label">Vault balance</div>
            <div className="app-balance-value">{fmt(s.vaultBalance)} USDC</div>
          </div>
          <div>
            <div className="app-label">Wallet USDC</div>
            <div className="app-balance-value">{fmt(s.walletBalance)} USDC</div>
          </div>
          <div>
            <div className="app-label">Spent under current policy</div>
            <div className="app-balance-value">{fmt(s.totalSpent)} USDC</div>
          </div>
        </div>
        {s.walletBalance === 0n && <p className="app-small">No USDC in this wallet. <a className="app-link" href={FAUCET_URL} target="_blank" rel="noreferrer">Get testnet USDC</a>.</p>}
        <p className="app-small app-muted">
          Vault <a className="app-mono app-link" href={addressUrl(vault)} target="_blank" rel="noreferrer">{vault}</a>. Your agent spends from this
          balance with a session key, inside the limits below; a relayer submits the spend and pays gas.
        </p>
      </div>

      <div className="app-grid">
        <div className="app-card">
          <h3>Deposit</h3>
          <div className="app-form">
            <label>
              Amount (USDC)
              <input className="waitlist-input" value={depositAmt} onChange={e => setDepositAmt(e.target.value)} inputMode="decimal" />
            </label>
            {depError && depositAmt && <p className="app-error app-small">{depError}</p>}
            <div className="app-actions">
              {depNeedsApproval && !depError && (
                <button className="btn btn-primary" disabled={tx.busy || s.paused} onClick={() => act(`Approve ${fmt(dep!)} USDC`, async () => wallet().writeContract((await publicClient.simulateContract({ account, address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [vault, dep!] })).request))}>
                  1. Approve
                </button>
              )}
              <button className="btn btn-primary" disabled={!!depError || depNeedsApproval || tx.busy || s.paused} onClick={() => act(`Deposit ${fmt(dep!)} USDC`, async () => wallet().writeContract((await publicClient.simulateContract({ ...vaultCall, functionName: 'deposit', args: [dep!] })).request))}>
                {depNeedsApproval ? '2. ' : ''}Deposit
              </button>
            </div>
            <p className="app-small app-muted">Allowance to vault: {fmt(s.allowance)} USDC</p>
          </div>
        </div>

        <div className="app-card">
          <h3>Withdraw</h3>
          <div className="app-form">
            <label>
              Amount (USDC)
              <input className="waitlist-input" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} inputMode="decimal" placeholder={fmt(s.vaultBalance)} />
            </label>
            {wdError && withdrawAmt && <p className="app-error app-small">{wdError}</p>}
            <div className="app-actions">
              <button className="btn" type="button" onClick={() => setWithdrawAmt(fmt(s.vaultBalance))} disabled={s.vaultBalance === 0n}>Max</button>
              <button className="btn btn-primary" disabled={!!wdError || tx.busy} onClick={() => act(`Withdraw ${fmt(wd!)} USDC`, async () => wallet().writeContract((await publicClient.simulateContract({ ...vaultCall, functionName: 'withdraw', args: [wd!] })).request))}>Withdraw</button>
            </div>
          </div>
        </div>
      </div>

      <TxStatus state={tx.state} />

      <div className="app-card">
        <h3>Spending policy</h3>
        {p.sessionKey === '0x0000000000000000000000000000000000000000' ? (
          <p className="app-muted">No policy set yet.</p>
        ) : (
          <dl className="app-dl">
            <dt>Status</dt>
            <dd className={p.active && !expired ? 'app-ok' : 'app-error'}>{!p.active ? 'Revoked' : expired ? 'Expired' : 'Active'}</dd>
            <dt>Session key</dt><dd><a className="app-mono app-link" href={addressUrl(p.sessionKey)} target="_blank" rel="noreferrer">{p.sessionKey}</a></dd>
            <dt>Max per call</dt><dd>{fmt(p.maxPerCall)} USDC</dd>
            <dt>Daily cap</dt><dd>{fmt(p.dailyCap)} USDC ({fmt(s.dailyRemaining)} left today, UTC)</dd>
            <dt>Total budget</dt><dd>{fmt(p.totalBudget)} USDC ({fmt(s.budgetRemaining)} left)</dd>
            <dt>Expires</dt><dd>{new Date(Number(p.expiry) * 1000).toLocaleString()}</dd>
            <dt>Allowlist only</dt><dd>{p.allowlistOnly ? 'yes: spends only to allowlisted recipients' : 'no'}</dd>
          </dl>
        )}
        {p.active && (
          <div className="app-actions">
            <button className="btn" disabled={tx.busy} onClick={() => act('Revoke session', async () => wallet().writeContract((await publicClient.simulateContract({ ...vaultCall, functionName: 'revokeSession' })).request))}>Revoke session</button>
          </div>
        )}

        <h3 className="app-h3">{p.active ? 'Replace policy' : 'Set policy'}</h3>
        <div className="app-form">
          <label>
            Session key (agent address)
            <input className="waitlist-input app-mono" value={policy.sessionKey} onChange={e => setPolicy({ ...policy, sessionKey: e.target.value })} placeholder="0x…" />
          </label>
          <label>
            Max per call (USDC)
            <input className="waitlist-input" value={policy.maxPerCall} onChange={e => setPolicy({ ...policy, maxPerCall: e.target.value })} inputMode="decimal" />
          </label>
          <label>
            Daily cap (USDC)
            <input className="waitlist-input" value={policy.dailyCap} onChange={e => setPolicy({ ...policy, dailyCap: e.target.value })} inputMode="decimal" />
          </label>
          <label>
            Total budget (USDC)
            <input className="waitlist-input" value={policy.totalBudget} onChange={e => setPolicy({ ...policy, totalBudget: e.target.value })} inputMode="decimal" />
          </label>
          <label>
            Expires
            <input className="waitlist-input" type="datetime-local" value={policy.expiry} onChange={e => setPolicy({ ...policy, expiry: e.target.value })} />
          </label>
          <label className="app-check">
            <input type="checkbox" checked={policy.allowlistOnly} onChange={e => setPolicy({ ...policy, allowlistOnly: e.target.checked })} /> Allowlist only
          </label>
          {policyError && policy.sessionKey && <p className="app-error app-small">{policyError}</p>}
          <p className="app-small app-muted">Setting a policy resets “spent under current policy” to zero.</p>
          <div className="app-actions">
            <button
              className="btn btn-primary"
              disabled={!!policyError || tx.busy}
              onClick={() =>
                act('Set policy', async () =>
                  wallet().writeContract(
                    (await publicClient.simulateContract({
                      ...vaultCall,
                      functionName: 'setPolicy',
                      args: [getAddress(policy.sessionKey.trim()), pMax!, pDaily!, pBudget!, BigInt(pExpiry), policy.allowlistOnly],
                    })).request,
                  ),
                )
              }
            >
              Set policy
            </button>
          </div>
        </div>

        <h3 className="app-h3">Allowlist</h3>
        <div className="waitlist-form">
          <input
            className="waitlist-input app-mono"
            value={allowTo}
            onChange={e => {
              setAllowTo(e.target.value)
              setAllowStatus(null)
              const to = e.target.value.trim()
              if (isAddress(to)) {
                publicClient.readContract({ address: vault, abi: policyVaultAbi, functionName: 'allowlist', args: [account, getAddress(to)] }).then(setAllowStatus).catch(() => {})
              }
            }}
            placeholder="Recipient 0x…"
            aria-label="Allowlist recipient"
          />
          <button className="btn" disabled={!isAddress(allowTo.trim()) || tx.busy} onClick={() => setAllowlisted(true)}>Allow</button>
          <button className="btn" disabled={!isAddress(allowTo.trim()) || tx.busy} onClick={() => setAllowlisted(false)}>Remove</button>
        </div>
        {allowStatus !== null && <p className="app-small app-muted">Currently {allowStatus ? 'allowlisted' : 'not allowlisted'}.</p>}
      </div>

      <div className="app-card">
        <h3>Recent vault activity</h3>
        {activity === null ? (
          <p className="app-muted">Loading…</p>
        ) : activity.length === 0 ? (
          <p className="app-muted">No vault events for this address in the last ~{ACTIVITY_WINDOWS * 1.4} hours.</p>
        ) : (
          <table className="app-table">
            <thead><tr><th>Event</th><th>Detail</th><th>Tx</th></tr></thead>
            <tbody>
              {activity.map((a, i) => (
                <tr key={`${a.hash}-${i}`}>
                  <td>{a.name}</td>
                  <td>{a.detail}</td>
                  <td><Link className="app-mono app-link" href={`/tx/${a.hash}`}>{shortAddress(a.hash)}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

export default function VaultPanel() {
  if (!CONTRACTS.policyVault) {
    return <div className="app-card app-warn">No PolicyVault address is configured (<code>NEXT_PUBLIC_POLICY_VAULT_ADDRESS</code>).</div>
  }
  return <WalletGate purpose="use the PolicyVault">{account => <Vault key={account} account={account} />}</WalletGate>
}
