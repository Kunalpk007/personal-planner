'use client'
import { useState } from 'react'
import { hashPin } from '@/lib/crypto/pin'
import { PinPad } from './PinPad'

interface PinSetupProps {
  onComplete: (hash: string, question: string, answerHash: string) => void
  onCancel?:  () => void
  title?:     string
}

/**
 * Two-step PIN setup: (1) choose a 4-digit PIN, (2) set a security
 * question + answer used for recovery if the PIN is forgotten.
 */
export function PinSetup({ onComplete, onCancel, title = 'Set up PIN' }: PinSetupProps) {
  const [pinHash, setPinHash] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer,   setAnswer]   = useState('')
  const [error,    setError]    = useState('')

  if (!pinHash) {
    return <PinPad mode="set" title={title} onSuccess={(hash) => hash && setPinHash(hash)} onCancel={onCancel} />
  }

  async function handleSubmit() {
    if (!question.trim() || !answer.trim()) {
      setError('Both fields are required.')
      return
    }
    const answerHash = await hashPin(answer.trim().toLowerCase())
    onComplete(pinHash!, question.trim(), answerHash)
  }

  return (
    <div>
      <div className="text-[15px] font-semibold mb-1 text-center">Security question</div>
      <div className="text-xs mb-4 text-center" style={{ color: 'var(--vx-fg-4)' }}>
        Used to recover your PIN if you forget it.
      </div>
      <div className="mb-3">
        <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--vx-fg-4)' }}>Question</label>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="e.g. What was your first pet's name?"
          className="w-full vx-field"
        />
      </div>
      <div className="mb-3">
        <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--vx-fg-4)' }}>Answer</label>
        <input
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Your answer"
          className="w-full vx-field"
        />
      </div>
      <div className="text-xs h-4 mb-2" style={{ color: 'var(--red)' }}>{error}</div>
      <div className="flex gap-2 justify-end">
        {onCancel && <button onClick={onCancel} className="vx-btn vx-btn-ghost text-sm">Cancel</button>}
        <button onClick={handleSubmit} className="vx-btn vx-btn-primary text-sm">
          Save
        </button>
      </div>
    </div>
  )
}
