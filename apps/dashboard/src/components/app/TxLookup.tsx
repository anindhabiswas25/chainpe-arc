'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const HASH_RE = /^0x[0-9a-fA-F]{64}$/

export default function TxLookup() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const hash = value.trim()
    if (!HASH_RE.test(hash)) {
      setInvalid(true)
      return
    }
    router.push(`/tx/${hash}`)
  }

  return (
    <form className="waitlist-form" onSubmit={submit}>
      <input
        className="waitlist-input"
        placeholder="0x… transaction hash"
        value={value}
        onChange={e => {
          setValue(e.target.value)
          setInvalid(false)
        }}
        aria-label="Transaction hash"
        aria-invalid={invalid}
      />
      <button type="submit" className="btn btn-primary">Look up</button>
      {invalid && <span className="app-error app-small">Enter a 32-byte hex hash (0x + 64 hex chars).</span>}
    </form>
  )
}
