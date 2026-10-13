'use client'

import type { Address } from 'viem'
import { addressUrl } from '@/lib/arc'
import { useArcWallet } from '@/lib/useArcWallet'

/**
 * Renders `children` only once a wallet is connected and on Arc Testnet;
 * otherwise shows the step that is missing (install, connect, switch chain).
 */
export default function WalletGate({ purpose, children }: { purpose: string; children: (account: Address) => React.ReactNode }) {
  const wallet = useArcWallet()

  if (!wallet.ready) return <div className="app-card">Checking for a browser wallet…</div>
  if (!wallet.hasProvider) {
    return (
      <div className="app-card">
        <h3>No browser wallet found</h3>
        <p className="app-muted">Install MetaMask (or any EIP-1193 wallet) to {purpose}.</p>
      </div>
    )
  }
  return (
    <>
      {!wallet.account ? (
        <div className="app-card">
          <h3>Connect a wallet</h3>
          <p className="app-muted">Connect the wallet you want to {purpose} with. Every transaction is shown in your wallet before it is sent.</p>
          <button className="btn btn-primary" onClick={wallet.connect}>Connect wallet</button>
        </div>
      ) : !wallet.onArc ? (
        <div className="app-card app-warn" role="alert">
          <h3>Wrong network</h3>
          <p>
            Your wallet is on chain {wallet.chainId ?? 'unknown'}. ChainPe runs on Arc Testnet (chain 5042002), so
            transactions are disabled until you switch.
          </p>
          <button className="btn btn-primary" onClick={wallet.switchToArc}>Switch to Arc Testnet</button>
        </div>
      ) : (
        <>
          <p className="app-small app-muted">
            Connected as <a className="app-mono app-link" href={addressUrl(wallet.account)} target="_blank" rel="noreferrer">{wallet.account}</a> on Arc Testnet.
          </p>
          {children(wallet.account)}
        </>
      )}
      {wallet.error && <p className="app-error">{wallet.error}</p>}
    </>
  )
}
