'use client'
import { useState, useEffect } from 'react'
import { hashPin, verifyPinCompat as verifyPin } from '@/lib/crypto/pin'
import { usePlannerStore } from '@/store'
import { PIN_LENGTH } from '@/constants/points'

interface PinPadProps {
  mode:        'set' | 'verify'
  storedHash?: string | null
  onSuccess:   (hash?: string) => void
  onCancel?:   () => void
  title?:      string
  /** Digit count to require — defaults to the current PIN_LENGTH. Verify mode
   *  passes a shorter length when checking a legacy PIN during the 5→6 digit
   *  migration flow (see ui/PinGate.tsx). */
  length?:     number
}

function formatRemaining(ms: number): string {
  const totalMin = Math.ceil(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function PinPad({ mode, storedHash, onSuccess, onCancel, title = 'Journal PIN', length }: PinPadProps) {
  const digits = length ?? PIN_LENGTH
  const [buf,   setBuf]   = useState('')
  const [error, setError] = useState('')

  const lockoutUntil   = usePlannerStore(s => s.pinLockoutUntil)
  const recordFailure  = usePlannerStore(s => s.recordPinFailure)
  const resetFailures  = usePlannerStore(s => s.resetPinFailures)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!lockoutUntil) return
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [lockoutUntil])

  const isLocked = mode === 'verify' && !!lockoutUntil && lockoutUntil > now

  const handleDigit = async (d: string) => {
    if (isLocked) return
    if (d === 'back')  { setBuf(b => b.slice(0, -1)); return }
    if (d === 'clear') { setBuf(''); return }

    const next = buf + d
    setBuf(next)
    if (next.length < digits) return

    setBuf('')
    if (mode === 'set') {
      const hash = await hashPin(next)
      onSuccess(hash)
    } else {
      const ok = storedHash ? await verifyPin(next, storedHash) : true
      if (ok) {
        resetFailures()
        onSuccess()
      } else {
        recordFailure()
        setError('Wrong PIN. Try again.')
        setTimeout(() => setError(''), 1500)
      }
    }
  }

  const KEYS = ['1','2','3','4','5','6','7','8','9','clear','0','back']

  if (isLocked) {
    return (
      <div className="text-center">
        <div className="text-[15px] font-semibold mb-1">{title}</div>
        <div className="text-sm mb-2" style={{ color: 'var(--red)' }}>🔒 Too many incorrect attempts</div>
        <div className="text-xs mb-4" style={{ color: 'var(--vx-fg-4)' }}>
          Try again in {formatRemaining(lockoutUntil! - now)}
        </div>
        {onCancel && (
          <button onClick={onCancel} className="vx-btn vx-btn-ghost text-sm">
            Cancel
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="text-[15px] font-semibold mb-1">{title}</div>
      <div className="text-xs mb-4" style={{ color: 'var(--vx-fg-4)' }}>
        {mode === 'set' ? `Set a ${digits}-digit PIN for your journal` : `Enter your ${digits}-digit PIN`}
      </div>
      <div className="flex gap-3 justify-center mb-2">
        {Array.from({ length: digits }).map((_, i) => (
          <div key={i} className="w-3.5 h-3.5 rounded-full border-[1.5px] transition-colors"
            style={i < buf.length
              ? { background: 'var(--vx-grad-emerald)', borderColor: 'transparent' }
              : { background: 'var(--vx-card)', borderColor: 'var(--vx-border)' }}
          />
        ))}
      </div>
      <div className="text-xs h-4 mb-2" style={{ color: 'var(--red)' }}>{error}</div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {KEYS.map(k => (
          <button
            key={k}
            onClick={() => handleDigit(k)}
            className="py-3.5 text-lg font-medium rounded-lg vx-keypad-btn active:scale-95 transition-all"
          >
            {k === 'back' ? '←' : k === 'clear' ? 'CLR' : k}
          </button>
        ))}
      </div>
      {onCancel && (
        <button onClick={onCancel} className="vx-btn vx-btn-ghost text-sm">
          Cancel
        </button>
      )}
    </div>
  )
}
