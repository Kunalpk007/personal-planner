'use client'
import { useState } from 'react'
import { sha256 } from '@/lib/crypto/pin'
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
    const answerHash = await sha256(answer.trim().toLowerCase())
    onComplete(pinHash!, question.trim(), answerHash)
  }

  return (
    <div>
      <div className="text-[15px] font-semibold mb-1 text-center">Security question</div>
      <div className="text-xs text-[var(--text3)] mb-4 text-center">
        Used to recover your PIN if you forget it.
      </div>
      <div className="mb-3">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-1 block">Question</label>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="e.g. What was your first pet's name?"
          className="w-full text-[13px] p-2.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none"
        />
      </div>
      <div className="mb-3">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-1 block">Answer</label>
        <input
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Your answer"
          className="w-full text-[13px] p-2.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none"
        />
      </div>
      <div className="text-xs text-red-500 h-4 mb-2">{error}</div>
      <div className="flex gap-2 justify-end">
        {onCancel && <button onClick={onCancel} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>}
        <button onClick={handleSubmit} className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
          Save
        </button>
      </div>
    </div>
  )
}
