'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatUnits, getAddress, isAddress, parseEventLogs, type Address } from 'viem'
import { chainPeRegistryAbi, identityRegistryAbi } from '@/abi'
import { CONTRACTS, FAUCET_URL, USDC_ADDRESS, USDC_DECIMALS, addressUrl } from '@/lib/arc'
import { erc20Abi, publicClient } from '@/lib/client'
import { readServicesBy, serviceId, type RawService } from '@/lib/registry'
import { describeError, useTx, walletClientFor } from '@/lib/tx'
import TxStatus from './TxStatus'
import WalletGate from './WalletGate'

/** Byte limits enforced by ChainPeRegistryUpgradeable (MAX_*_LEN). */
const LIMITS = { name: 64, description: 1024, tags: 256, endpoint: 256, pricePerRequest: 32 } as const
const bytes = (s: string) => new TextEncoder().encode(s).length
const fmt = (v: bigint) => formatUnits(v, USDC_DECIMALS)

interface Form {
  name: string
  description: string
  tags: string
  endpoint: string
  pricePerRequest: string
  payTo: string
  agentId: string
}

const emptyForm = (account: Address): Form => ({ name: '', description: '', tags: '', endpoint: '', pricePerRequest: '0.01', payTo: account, agentId: '' })

function validate(f: Form): string | null {
  if (!f.name.trim()) return 'Name is required.'
  for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (bytes(f[k]) > LIMITS[k]) return `${k} is longer than ${LIMITS[k]} bytes.`
  }
  if (!/^https?:\/\/\S+$/.test(f.endpoint.trim())) return 'Endpoint must be an http(s) URL.'
  if (!/^\d+(\.\d{1,6})?$/.test(f.pricePerRequest.trim()) || Number(f.pricePerRequest) <= 0) return 'Price must be a positive USDC amount (up to 6 decimals).'
  if (!isAddress(f.payTo.trim())) return 'Pay-to must be a valid address.'
  if (f.agentId.trim() && !/^\d+$/.test(f.agentId.trim())) return 'Agent id must be a whole number (or empty).'
  return null
}

interface Chain {
  fee: bigint
  updateFee: bigint
  paused: boolean
  balance: bigint
  allowance: bigint
  services: RawService[]
}

function Merchant({ account }: { account: Address }) {
  const registry = CONTRACTS.registry!
  const tx = useTx()
  const [chain, setChain] = useState<Chain | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(() => emptyForm(account))
  const [editing, setEditing] = useState<string | null>(null)
  const [agentURI, setAgentURI] = useState('')
  const [lastRegistered, setLastRegistered] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const read = <F extends 'registrationFee' | 'updateFee' | 'paused'>(functionName: F) =>
        publicClient.readContract({ address: registry, abi: chainPeRegistryAbi, functionName })
      const [fee, updateFee, paused, balance, allowance, services] = await Promise.all([
        read('registrationFee'),
        read('updateFee'),
        read('paused'),
        publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
        publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [account, registry] }),
        readServicesBy(account),
      ])
      setChain({ fee, updateFee, paused, balance, allowance, services })
    } catch (e) {
      setLoadError(describeError(e))
    }
  }, [account, registry])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  if (loadError) return <div className="app-card app-warn">Could not read the registry: {loadError} <button className="btn" onClick={refresh}>Retry</button></div>
  if (!chain) return <div className="app-card">Reading the ChainPeRegistry on Arc Testnet…</div>

  const needed = editing ? chain.updateFee : chain.fee
  const invalid = validate(form)
  const lowBalance = chain.balance < needed
  const needsApproval = needed > 0n && chain.allowance < needed

  const input = {
    name: form.name.trim(),
    description: form.description.trim(),
    tags: form.tags.split(',').map(t => t.trim()).filter(Boolean).join(','),
    endpoint: form.endpoint.trim(),
    pricePerRequest: form.pricePerRequest.trim(),
    paymentToken: 'USDC',
    network: 'arc-testnet',
    payTo: isAddress(form.payTo.trim()) ? getAddress(form.payTo.trim()) : account,
    agentId: form.agentId.trim() ? BigInt(form.agentId.trim()) : 0n,
  }

  const approve = async () => {
    await tx.run(`Approve ${fmt(needed)} USDC`, async () => {
      const { request } = await publicClient.simulateContract({ account, address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [registry, needed] })
      return walletClientFor(account).writeContract(request)
    })
    await refresh()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (invalid || lowBalance || needsApproval) return
    const functionName = editing ? 'update' : 'register'
    const receipt = await tx.run(editing ? `Update “${input.name}”` : `Register “${input.name}”`, async () => {
      const { request } = await publicClient.simulateContract({ account, address: registry, abi: chainPeRegistryAbi, functionName, args: [input] })
      return walletClientFor(account).writeContract(request)
    })
    if (receipt) {
      setLastRegistered(serviceId(account, input.name))
      setEditing(null)
      setForm(emptyForm(account))
    }
    await refresh()
  }

  const startEdit = (s: RawService) => {
    setEditing(s.name)
    setLastRegistered(null)
    tx.reset()
    setForm({
      name: s.name,
      description: s.description,
      tags: s.tags,
      endpoint: s.endpoint,
      pricePerRequest: s.pricePerRequest,
      payTo: s.payTo,
      agentId: s.agentId > 0n ? s.agentId.toString() : '',
    })
  }

  const deregister = async (name: string) => {
    if (!window.confirm(`Deregister “${name}”? It disappears from the marketplace. The registration fee is not refunded.`)) return
    await tx.run(`Deregister “${name}”`, async () => {
      const { request } = await publicClient.simulateContract({ account, address: registry, abi: chainPeRegistryAbi, functionName: 'deregister', args: [name] })
      return walletClientFor(account).writeContract(request)
    })
    if (editing === name) {
      setEditing(null)
      setForm(emptyForm(account))
    }
    await refresh()
  }

  const createIdentity = async () => {
    const identity = CONTRACTS.identity
    if (!identity) return
    const uri = agentURI.trim()
    const call = { account, address: identity, abi: identityRegistryAbi, functionName: 'register' } as const
    const receipt = await tx.run('Create ERC-8004 identity', async () =>
      uri
        ? walletClientFor(account).writeContract((await publicClient.simulateContract({ ...call, args: [uri] })).request)
        : walletClientFor(account).writeContract((await publicClient.simulateContract({ ...call, args: [] })).request),
    )
    const registered = receipt && parseEventLogs({ abi: identityRegistryAbi, eventName: 'Registered', logs: receipt.logs })[0]
    if (registered) setForm(f => ({ ...f, agentId: registered.args.agentId.toString() }))
  }

  return (
    <>
      <div className="app-card">
        <dl className="app-dl">
          <dt>Registration fee</dt><dd>{fmt(chain.fee)} USDC (one-off, paid to the registry fee recipient)</dd>
          <dt>Update fee</dt><dd>{chain.updateFee === 0n ? 'free' : `${fmt(chain.updateFee)} USDC`}</dd>
          <dt>Your USDC</dt><dd>{fmt(chain.balance)} USDC</dd>
          <dt>Allowance to registry</dt><dd>{fmt(chain.allowance)} USDC</dd>
          <dt>Registry</dt><dd><a className="app-mono app-link" href={addressUrl(registry)} target="_blank" rel="noreferrer">{registry}</a></dd>
        </dl>
        {chain.paused && <p className="app-error">The registry is paused by its owner: registering, updating and deregistering are disabled.</p>}
      </div>

      <div className="app-card">
        <h3>{editing ? `Edit “${editing}”` : 'Register a service'}</h3>
        <form className="app-form" onSubmit={submit}>
          <label>
            Name {editing && <span className="app-muted app-small">(the name is the key and cannot change)</span>}
            <input className="waitlist-input" value={form.name} onChange={set('name')} disabled={!!editing} required maxLength={LIMITS.name} placeholder="weather-api" />
          </label>
          <label>
            Description
            <textarea className="waitlist-input" value={form.description} onChange={set('description')} rows={3} maxLength={LIMITS.description} />
          </label>
          <label>
            Tags (comma-separated)
            <input className="waitlist-input" value={form.tags} onChange={set('tags')} placeholder="weather, data" />
          </label>
          <label>
            Endpoint (x402 URL)
            <input className="waitlist-input" value={form.endpoint} onChange={set('endpoint')} required placeholder="https://api.example.com/weather" />
          </label>
          <label>
            Price per request (USDC)
            <input className="waitlist-input" value={form.pricePerRequest} onChange={set('pricePerRequest')} required inputMode="decimal" />
          </label>
          <label>
            Pay to (receives the x402 payments)
            <input className="waitlist-input app-mono" value={form.payTo} onChange={set('payTo')} required />
          </label>
          <label>
            ERC-8004 agent id (optional, enables reputation)
            <input className="waitlist-input" value={form.agentId} onChange={set('agentId')} inputMode="numeric" placeholder="none" />
          </label>
          <p className="app-small app-muted">Payment token <code>USDC</code>, network <code>arc-testnet</code>.</p>

          {invalid && (form.name || form.endpoint) && <p className="app-error app-small">{invalid}</p>}
          {lowBalance && (
            <p className="app-error app-small">
              You need {fmt(needed)} USDC for the fee plus a little for gas, and hold {fmt(chain.balance)}.{' '}
              <a className="app-link" href={FAUCET_URL} target="_blank" rel="noreferrer">Get testnet USDC</a>.
            </p>
          )}

          <div className="app-actions">
            {needsApproval && !lowBalance && (
              <button type="button" className="btn btn-primary" onClick={approve} disabled={tx.busy || chain.paused}>
                1. Approve {fmt(needed)} USDC
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={!!invalid || lowBalance || needsApproval || tx.busy || chain.paused}>
              {needsApproval && !lowBalance ? '2. ' : ''}{editing ? 'Save changes' : `Register (${fmt(chain.fee)} USDC)`}
            </button>
            {editing && (
              <button type="button" className="btn" onClick={() => { setEditing(null); setForm(emptyForm(account)) }} disabled={tx.busy}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
        <TxStatus state={tx.state} />
        {lastRegistered && tx.state.status === 'success' && (
          <p className="app-small">
            <Link className="app-link" href={`/services/${encodeURIComponent(lastRegistered)}`}>Open the service page</Link>
          </p>
        )}
      </div>

      <div className="app-card">
        <h3>ERC-8004 identity (optional)</h3>
        <p className="app-muted app-small">
          Reputation is keyed by an ERC-8004 agent id. If you don&apos;t have one, mint it in Arc&apos;s canonical
          IdentityRegistry; the new id is filled into the form above. The agent URI should point at your agent
          card (JSON) and can be set later.
        </p>
        <div className="waitlist-form">
          <input className="waitlist-input" value={agentURI} onChange={e => setAgentURI(e.target.value)} placeholder="https://example.com/agent.json (optional)" aria-label="Agent URI" />
          <button type="button" className="btn" onClick={createIdentity} disabled={tx.busy}>Create identity</button>
        </div>
      </div>

      <div className="app-card">
        <h3>Your services</h3>
        {chain.services.length === 0 ? (
          <p className="app-muted">No services registered from this address.</p>
        ) : (
          <table className="app-table">
            <thead>
              <tr><th>Name</th><th>Price</th><th>Endpoint</th><th></th></tr>
            </thead>
            <tbody>
              {chain.services.map(s => (
                <tr key={s.name}>
                  <td><Link className="app-link" href={`/services/${encodeURIComponent(serviceId(s.developer, s.name))}`}>{s.name}</Link></td>
                  <td>{s.pricePerRequest} USDC</td>
                  <td className="app-mono app-break">{s.endpoint}</td>
                  <td>
                    <button className="btn" onClick={() => startEdit(s)} disabled={tx.busy}>Edit</button>{' '}
                    <button className="btn" onClick={() => deregister(s.name)} disabled={tx.busy || chain.paused}>Deregister</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

export default function RegisterService() {
  if (!CONTRACTS.registry) {
    return <div className="app-card app-warn">No ChainPeRegistry address is configured (<code>NEXT_PUBLIC_CHAINPE_REGISTRY_ADDRESS</code>).</div>
  }
  return <WalletGate purpose="register a service">{account => <Merchant key={account} account={account} />}</WalletGate>
}
