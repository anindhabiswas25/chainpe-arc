'use client'

import { useCallback, useState } from 'react'
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  createWalletClient,
  custom,
  type Address,
  type Hash,
  type TransactionReceipt,
} from 'viem'
import { arcTestnet } from './arc'
import { publicClient } from './client'

/** Wallet client bound to the injected provider and Arc Testnet. */
export function walletClientFor(account: Address) {
  if (!window.ethereum) throw new Error('No browser wallet found.')
  return createWalletClient({ account, chain: arcTestnet, transport: custom(window.ethereum) })
}

/** Readable messages for the custom errors the ChainPe contracts can revert with. */
const REVERT_MESSAGES: Record<string, string> = {
  EnforcedPause: 'The contract is paused by its owner.',
  EmptyName: 'The service name is empty.',
  ZeroAddress: 'An address field is the zero address.',
  ServiceAlreadyExists: 'You already registered a service with this name. Edit it instead.',
  ServiceNotFound: 'No service with this name is registered from your address.',
  NotServiceDeveloper: 'Only the developer that registered this service can change it.',
  StringTooLong: 'A field is longer than the registry allows.',
  SafeERC20FailedOperation: 'The USDC transfer failed: check your balance and allowance.',
  ERC20InsufficientBalance: 'Not enough USDC.',
  ERC20InsufficientAllowance: 'USDC allowance is too low. Approve first.',
  InsufficientBalance: 'Amount is more than your vault balance.',
  ZeroAmount: 'Amount must be greater than zero.',
  ZeroSessionKey: 'Session key must not be the zero address.',
  ZeroDailyCap: 'Daily cap must be greater than zero.',
  MaxPerCallExceedsBudget: 'Max per call cannot exceed the total budget.',
  ExpiryInPast: 'Expiry must be in the future.',
}

/** Turns anything a wallet/viem call throws into one line for the UI. */
export function describeError(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk(err => err instanceof UserRejectedRequestError) || (e.walk() as { code?: number }).code === 4001) {
      return 'You rejected the request in your wallet.'
    }
    const revert = e.walk(err => err instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName
      if (name && REVERT_MESSAGES[name]) {
        const field = name === 'StringTooLong' ? ` (${String(revert.data?.args?.[0])})` : ''
        return `Reverted: ${REVERT_MESSAGES[name]}${field}`
      }
      if (name && name !== 'Error') return `Reverted with ${name}.`
      if (revert.reason) return `Reverted: ${revert.reason}`
      return 'The transaction would revert.'
    }
    if (/insufficient funds/i.test(e.message)) return 'Not enough USDC to pay gas on Arc Testnet.'
    return e.shortMessage || e.message.split('\n')[0]
  }
  if ((e as { code?: number })?.code === 4001) return 'You rejected the request in your wallet.'
  return e instanceof Error ? e.message.split('\n')[0] : String(e)
}

export type TxState =
  | { status: 'idle' }
  | { status: 'signing'; label: string }
  | { status: 'pending'; label: string; hash: Hash }
  | { status: 'success'; label: string; hash: Hash; receipt: TransactionReceipt }
  | { status: 'reverted'; label: string; hash: Hash }
  | { status: 'error'; label: string; message: string }

/**
 * Runs one write at a time: `send` should simulate then submit and return the
 * hash; this waits for the receipt and tracks every state in between.
 */
export function useTx() {
  const [state, setState] = useState<TxState>({ status: 'idle' })

  const run = useCallback(async (label: string, send: () => Promise<Hash>): Promise<TransactionReceipt | null> => {
    setState({ status: 'signing', label })
    let hash: Hash
    try {
      hash = await send()
    } catch (e) {
      setState({ status: 'error', label, message: describeError(e) })
      return null
    }
    setState({ status: 'pending', label, hash })
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status === 'success') {
        setState({ status: 'success', label, hash, receipt })
        return receipt
      }
      setState({ status: 'reverted', label, hash })
    } catch (e) {
      setState({ status: 'error', label, message: `Submitted ${hash}, but waiting for it failed: ${describeError(e)}` })
    }
    return null
  }, [])

  const reset = useCallback(() => setState({ status: 'idle' }), [])
  const busy = state.status === 'signing' || state.status === 'pending'
  return { state, run, reset, busy }
}
