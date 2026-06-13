'use client'
import { useState } from 'react'
import { sha256, verifyPin } from '@/lib/crypto/pin'

interface PinPadProps {
  mode:        'set' | 'verify'
  storedHash?: string | null
  onSuccess:   (hash?: string) => void
  onCancel?:   () => void
  title?:      string
}

export function PinPad({ mode, storedHash, onSuccess, onCancel, title = 'Journal PIN' }: PinPadProps) {
  const [buf,   setBuf]   = useState('')
  const [error, setError] = useState('')

  const handleDigit = async (d: string) => {
    if (d === 'back')  { setBuf(b => b.slice(0, -1)); return }
    if (d === 'clear') { setBuf(''); return }

    const next = buf + d
    setBuf(next)
    if (next.length < 4) return

    setBuf('')
    if (mode === 'set') {
      const hash = await sha256(next)
      onSuccess(hash)
    } else {
      const ok = storedHash ? await verifyPin(next, storedHash) : true
      if (ok) { onSuccess() }
      else    { setError('Wrong PIN. Try again.'); setTimeout(() => setError(''), 1500) }
    }
  }

  const KEYS = ['1','2','3','4','5','6','7','8','9','clear','0','back']

  return (
    <div className="text-center">
      <div className="text-[15px] font-semibold mb-1">{title}</div>
      <div className="text-xs text-[var(--text3)] mb-4">
        {mode === 'set' ? 'Set a 4-digit PIN for your journal' : 'Enter your 4-digit PIN'}
      </div>
      <div className="flex gap-3 justify-center mb-2">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-[1.5px] transition-colors
            ${i < buf.length ? 'bg-[var(--green-mid)] border-[var(--green-mid)]' : 'bg-[var(--bg3)] border-[var(--border2)]'}`}
          />
        ))}
      </div>
      <div className="text-xs text-red-500 h-4 mb-2">{error}</div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {KEYS.map(k => (
          <button
            key={k}
            onClick={() => handleDigit(k)}
            className="py-3.5 text-lg font-medium rounded-lg border border-[var(--border2)] bg-[var(--bg2)] hover:bg-[var(--bg3)] active:scale-95 transition-all"
          >
            {k === 'back' ? '←' : k === 'clear' ? 'CLR' : k}
          </button>
        ))}
      </div>
      {onCancel && (
        <button onClick={onCancel} className="text-sm text-[var(--text3)] hover:text-[var(--text)]">
          Cancel
        </button>
      )}
    </div>
  )
}
