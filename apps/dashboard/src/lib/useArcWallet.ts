'use client'

import { useCallback, useEffect, useState } from 'react'
import { getAddress, type Address } from 'viem'
import { ADD_CHAIN_PARAMS, ARC_CHAIN_ID, ARC_CHAIN_ID_HEX } from './arc'

interface ProviderError {
  code?: number
  message?: string
}

export interface ArcWallet {
  /** false until we've checked for window.ethereum (avoids an SSR flash). */
  ready: boolean
  hasProvider: boolean
  account: Address | null
  chainId: number | null
  onArc: boolean
  error: string | null
  connect: () => Promise<void>
  switchToArc: () => Promise<void>
}

/** Minimal injected-wallet (EIP-1193) state for Arc Testnet. */
export function useArcWallet(): ArcWallet {
  const [ready, setReady] = useState(false)
  const [hasProvider, setHasProvider] = useState(false)
  const [account, setAccount] = useState<Address | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const eth = window.ethereum
    setHasProvider(!!eth)
    setReady(true)
    if (!eth) return

    const onAccounts = (accs: unknown) => {
      const list = accs as string[]
      setAccount(list.length ? getAddress(list[0]) : null)
    }
    const onChain = (id: unknown) => setChainId(Number(id))

    // Read existing state without prompting.
    eth.request({ method: 'eth_accounts' }).then(onAccounts).catch(() => {})
    eth.request({ method: 'eth_chainId' }).then(onChain).catch(() => {})

    eth.on?.('accountsChanged', onAccounts)
    eth.on?.('chainChanged', onChain)
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts)
      eth.removeListener?.('chainChanged', onChain)
    }
  }, [])

  const connect = useCallback(async () => {
    const eth = window.ethereum
    if (!eth) return
    setError(null)
    try {
      const accs = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      setAccount(accs.length ? getAddress(accs[0]) : null)
      setChainId(Number(await eth.request({ method: 'eth_chainId' })))
    } catch (e) {
      setError((e as ProviderError).message ?? 'Wallet connection was rejected.')
    }
  }, [])

  const switchToArc = useCallback(async () => {
    const eth = window.ethereum
    if (!eth) return
    setError(null)
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_CHAIN_ID_HEX }] })
    } catch (e) {
      // 4902: the wallet doesn't know the chain yet — add it (this also switches).
      if ((e as ProviderError).code === 4902) {
        try {
          await eth.request({ method: 'wallet_addEthereumChain', params: [ADD_CHAIN_PARAMS] })
        } catch (addErr) {
          setError((addErr as ProviderError).message ?? 'Adding Arc Testnet was rejected.')
        }
      } else {
        setError((e as ProviderError).message ?? 'Switching to Arc Testnet was rejected.')
      }
    }
  }, [])

  return {
    ready,
    hasProvider,
    account,
    chainId,
    onArc: chainId === ARC_CHAIN_ID,
    error,
    connect,
    switchToArc,
  }
}
