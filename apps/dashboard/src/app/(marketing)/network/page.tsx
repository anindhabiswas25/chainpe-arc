import type { Metadata } from 'next'
import { formatUnits, type Address } from 'viem'
import { chainPeRegistryAbi, chainPeTimelockAbi, identityRegistryAbi, policyVaultAbi, reputationRegistryAbi, validationRegistryAbi } from '@/abi'
import { ARC_CHAIN_ID, ARC_RPC_URL, EXPLORER_URL, CONTRACTS, FAUCET_URL, REGISTRY_DEPLOY_BLOCK, USDC_ADDRESS, USDC_DECIMALS, VAULT_DEPLOY_BLOCK, addressUrl } from '@/lib/arc'
import { erc20Abi, publicClient } from '@/lib/client'
import { getFacilitatorHealth, getIndexerHealth, type Fetched } from '@/lib/services'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Network | ChainPe on Arc Testnet',
  description: 'Arc Testnet parameters, ChainPe contract addresses, and facilitator / indexer status.',
}

function AddressRow({ label, address }: { label: string; address: string | null }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        {address ? (
          <a className="app-mono app-link" href={addressUrl(address)} target="_blank" rel="noreferrer">{address}</a>
        ) : (
          <span className="app-muted">Not configured</span>
        )}
      </dd>
    </>
  )
}

const ZERO = '0x0000000000000000000000000000000000000000'
const usdc = (v: bigint) => `${formatUnits(v, USDC_DECIMALS)} USDC`

/** Settles every read so one failing call doesn't blank the whole card. */
async function live<T>(read: () => Promise<T>): Promise<Fetched<T>> {
  try {
    return { state: 'ok', data: await read() }
  } catch (e) {
    return { state: 'error', message: e instanceof Error ? e.message.split('\n')[0] : 'RPC error' }
  }
}

async function readRegistry(address: Address) {
  const c = { address, abi: chainPeRegistryAbi } as const
  const [owner, pendingOwner, fee, updateFee, count, paused, feeRecipient] = await Promise.all([
    publicClient.readContract({ ...c, functionName: 'owner' }),
    publicClient.readContract({ ...c, functionName: 'pendingOwner' }),
    publicClient.readContract({ ...c, functionName: 'registrationFee' }),
    publicClient.readContract({ ...c, functionName: 'updateFee' }),
    publicClient.readContract({ ...c, functionName: 'getServiceCount' }),
    publicClient.readContract({ ...c, functionName: 'paused' }),
    publicClient.readContract({ ...c, functionName: 'feeRecipient' }),
  ])
  return { owner, pendingOwner, fee, updateFee, count, paused, feeRecipient }
}

async function readVault(address: Address) {
  const c = { address, abi: policyVaultAbi } as const
  const [owner, paused, token, tvl] = await Promise.all([
    publicClient.readContract({ ...c, functionName: 'owner' }),
    publicClient.readContract({ ...c, functionName: 'paused' }),
    publicClient.readContract({ ...c, functionName: 'token' }),
    publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
  ])
  return { owner, paused, token, tvl }
}

const readTimelockDelay = (address: Address) => publicClient.readContract({ address, abi: chainPeTimelockAbi, functionName: 'getMinDelay' })

const readVersions = () =>
  Promise.all([
    CONTRACTS.identity ? publicClient.readContract({ address: CONTRACTS.identity, abi: identityRegistryAbi, functionName: 'getVersion' }) : null,
    CONTRACTS.reputation ? publicClient.readContract({ address: CONTRACTS.reputation, abi: reputationRegistryAbi, functionName: 'getVersion' }) : null,
    CONTRACTS.validation ? publicClient.readContract({ address: CONTRACTS.validation, abi: validationRegistryAbi, functionName: 'getVersion' }) : null,
  ])

function Addr({ address }: { address: string }) {
  return <a className="app-mono app-link" href={addressUrl(address)} target="_blank" rel="noreferrer">{address}</a>
}

function Live<T>({ result, children }: { result: Fetched<T> | null; children: (d: T) => React.ReactNode }) {
  if (!result) return null
  if (result.state === 'ok') return <>{children(result.data)}</>
  return (
    <>
      <dt>Live state</dt>
      <dd className="app-error">{result.state === 'error' ? `RPC read failed: ${result.message}` : 'not configured'}</dd>
    </>
  )
}

function StatusLine<T>({ result, render, env }: { result: Fetched<T>; render: (d: T) => React.ReactNode; env: string }) {
  if (result.state === 'unconfigured') return <span className="app-muted">Not configured (set <code>{env}</code>)</span>
  if (result.state === 'error') return <span className="app-error">Unreachable: {result.message}</span>
  return <>{render(result.data)}</>
}

export default async function NetworkPage() {
  const { registry, policyVault, timelock } = CONTRACTS
  const [facilitator, indexer, reg, vault, delay, versions, head] = await Promise.all([
    getFacilitatorHealth(),
    getIndexerHealth(),
    registry ? live(() => readRegistry(registry)) : null,
    policyVault ? live(() => readVault(policyVault)) : null,
    timelock ? live(() => readTimelockDelay(timelock)) : null,
    live(readVersions),
    live(() => publicClient.getBlockNumber()),
  ])
  const version = (i: number) => (versions.state === 'ok' && versions.data[i] ? ` · v${versions.data[i]}` : '')

  return (
    <section className="section app-page">
      <div className="container">
        <h1 className="section-title">Network</h1>
        <p className="section-description">ChainPe runs on Arc Testnet only. Gas is paid in USDC. Contract values below are read live from the chain on every page load.</p>

        <div className="app-card">
          <h3>Arc Testnet</h3>
          <dl className="app-dl">
            <dt>Chain ID</dt><dd>{ARC_CHAIN_ID} (0x4cef52)</dd>
            <dt>RPC</dt><dd className="app-mono">{ARC_RPC_URL}</dd>
            <dt>Latest block</dt><dd>{head.state === 'ok' ? head.data.toString() : <span className="app-error">RPC unreachable</span>}</dd>
            <dt>Explorer</dt><dd><a className="app-link" href={EXPLORER_URL} target="_blank" rel="noreferrer">{EXPLORER_URL}</a></dd>
            <dt>Gas token</dt><dd>USDC (native, 18 decimals at the balance level)</dd>
            <AddressRow label="USDC (ERC-20, 6 decimals)" address={USDC_ADDRESS} />
            <dt>Faucet</dt><dd><a className="app-link" href={FAUCET_URL} target="_blank" rel="noreferrer">Get testnet USDC</a> (select Arc Testnet)</dd>
          </dl>
        </div>

        <div className="app-card">
          <h3>ChainPeRegistry</h3>
          <p className="app-small app-muted">Service catalogue. UUPS proxy, deployed in block {REGISTRY_DEPLOY_BLOCK.toString()}.</p>
          <dl className="app-dl">
            <AddressRow label="Proxy" address={registry} />
            <Live result={reg}>
              {r => (
                <>
                  <dt>Services registered</dt><dd>{r.count.toString()}</dd>
                  <dt>Registration fee</dt><dd>{usdc(r.fee)}</dd>
                  <dt>Update fee</dt><dd>{r.updateFee === 0n ? 'free' : usdc(r.updateFee)}</dd>
                  <dt>Status</dt><dd className={r.paused ? 'app-error' : 'app-ok'}>{r.paused ? 'Paused' : 'Active'}</dd>
                  <dt>Owner</dt><dd><Addr address={r.owner} /></dd>
                  {r.pendingOwner !== ZERO && (<><dt>Pending owner</dt><dd><Addr address={r.pendingOwner} /></dd></>)}
                  <dt>Fee recipient</dt><dd><Addr address={r.feeRecipient} /></dd>
                </>
              )}
            </Live>
          </dl>
        </div>

        <div className="app-card">
          <h3>PolicyVault</h3>
          <p className="app-small app-muted">Agent budgets with per-call, daily and total limits. UUPS proxy, deployed in block {VAULT_DEPLOY_BLOCK.toString()}.</p>
          <dl className="app-dl">
            <AddressRow label="Proxy" address={policyVault} />
            <Live result={vault}>
              {v => (
                <>
                  <dt>USDC held</dt><dd>{usdc(v.tvl)}</dd>
                  <dt>Status</dt><dd className={v.paused ? 'app-error' : 'app-ok'}>{v.paused ? 'Paused (withdrawals still work)' : 'Active'}</dd>
                  <dt>Token</dt><dd><Addr address={v.token} /></dd>
                  <dt>Owner</dt><dd><Addr address={v.owner} /></dd>
                </>
              )}
            </Live>
          </dl>
        </div>

        <div className="app-card">
          <h3>ChainPeTimelock</h3>
          <p className="app-small app-muted">Governance timelock for future ownership handover. It does not own the registry or vault yet.</p>
          <dl className="app-dl">
            <AddressRow label="Address" address={timelock} />
            <Live result={delay}>{d => (<><dt>Minimum delay</dt><dd>{Number(d) / 3600} hours</dd></>)}</Live>
          </dl>
        </div>

        <div className="app-card">
          <h3>ERC-8004 registries (Arc canonical)</h3>
          <p className="app-small app-muted">Arc&apos;s shared agent identity, reputation and validation registries. ChainPe uses them rather than deploying its own.</p>
          <dl className="app-dl">
            <AddressRow label={`Identity${version(0)}`} address={CONTRACTS.identity} />
            <AddressRow label={`Reputation${version(1)}`} address={CONTRACTS.reputation} />
            <AddressRow label={`Validation${version(2)}`} address={CONTRACTS.validation} />
          </dl>
        </div>

        <div className="app-card">
          <h3>Services</h3>
          <dl className="app-dl">
            <dt>Facilitator</dt>
            <dd>
              <StatusLine
                result={facilitator}
                env="CHAINPE_FACILITATOR_URL"
                render={h => (
                  <>
                    <span className={h.status === 'ok' ? 'app-ok' : 'app-error'}>{h.status}</span>
                    {h.warning ? ` (${h.warning})` : ''} · network <code>{h.x402Network}</code> · gas key{' '}
                    <a className="app-mono app-link" href={addressUrl(h.facilitator)} target="_blank" rel="noreferrer">{h.facilitator}</a>
                  </>
                )}
              />
            </dd>
            <dt>Indexer</dt>
            <dd>
              <StatusLine
                result={indexer}
                env="INDEXER_URL"
                render={h => (
                  <>
                    <span className="app-ok">{h.status}</span> · block {h.lastIndexedBlock ?? '—'} / head {h.chainHead}
                  </>
                )}
              />
            </dd>
          </dl>
        </div>
      </div>
    </section>
  )
}
