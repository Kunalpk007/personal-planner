'use client'
import { useState } from 'react'
import { usePlannerStore } from '@/store'
import { PinPad } from './PinPad'
import { PinSetup } from './PinSetup'
import { sha256 } from '@/lib/crypto/pin'
import { showToast } from './Toast'

interface PinGateProps {
  children: React.ReactNode
  title?:   string
}

type Step = 'verify' | 'setup' | 'forgot-question' | 'forgot-reset'

/**
 * Wraps content behind the app-wide PIN. If no PIN is set yet, prompts
 * the user to create one along with a recovery security question.
 * Unlock state is per-session only — locks again on reload/navigation away and back.
 */
export function PinGate({ children, title = 'Enter PIN' }: PinGateProps) {
  const pin           = usePlannerStore(s => s.journalPin)
  const question      = usePlannerStore(s => s.journalPinQuestion)
  const answerHash     = usePlannerStore(s => s.journalPinAnswerHash)
  const setJournalSecurity = usePlannerStore(s => s.setJournalSecurity)

  const [unlocked, setUnlocked] = useState(false)
  const [step, setStep] = useState<Step>(pin ? 'verify' : 'setup')
  const [answerInput, setAnswerInput] = useState('')
  const [answerError, setAnswerError] = useState('')

  if (unlocked) return <>{children}</>

  if (!pin || step === 'setup') {
    return (
      <div className="flex justify-center pt-10">
        <div className="w-full max-w-sm">
          <div className="text-[15px] font-semibold mb-1 text-center">Set up {title}</div>
          <div className="text-xs text-[var(--text3)] mb-4 text-center">
            Protect your journal with a 4-digit PIN.
          </div>
          <PinSetup
            title={`Set a 4-digit ${title}`}
            onComplete={(hash, q, aHash) => {
              setJournalSecurity(hash, q, aHash)
              setUnlocked(true)
              showToast('PIN set. Journal protected.')
            }}
          />
        </div>
      </div>
    )
  }

  if (step === 'forgot-question') {
    return (
      <div className="flex justify-center pt-10">
        <div className="w-full max-w-sm text-center">
          <div className="text-[15px] font-semibold mb-1">Forgot PIN</div>
          {question ? (
            <>
              <div className="text-xs text-[var(--text3)] mb-4">{question}</div>
              <input
                value={answerInput}
                onChange={e => setAnswerInput(e.target.value)}
                placeholder="Your answer"
                className="w-full text-[13px] p-2.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none mb-2"
              />
              <div className="text-xs text-red-500 h-4 mb-2">{answerError}</div>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setStep('verify'); setAnswerInput(''); setAnswerError('') }} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const hash = await sha256(answerInput.trim().toLowerCase())
                    if (answerHash && hash === answerHash) {
                      setStep('forgot-reset')
                      setAnswerInput('')
                      setAnswerError('')
                    } else {
                      setAnswerError('Incorrect answer. Try again.')
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]"
                >
                  Verify
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-[var(--text3)] mb-4">
                No recovery question was set for this PIN. You&apos;ll need to clear the app&apos;s storage to reset it.
              </div>
              <button onClick={() => setStep('verify')} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">
                Back
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (step === 'forgot-reset') {
    return (
      <div className="flex justify-center pt-10">
        <div className="w-full max-w-sm">
          <PinSetup
            title="Set a new PIN"
            onComplete={(hash, q, aHash) => {
              setJournalSecurity(hash, q, aHash)
              setUnlocked(true)
              showToast('PIN reset. Journal unlocked.')
            }}
            onCancel={() => setStep('verify')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center pt-10">
      <div className="w-full max-w-sm text-center">
        <PinPad mode="verify" storedHash={pin} onSuccess={() => setUnlocked(true)} title={title} />
        <button onClick={() => setStep('forgot-question')} className="text-xs text-[var(--text3)] hover:text-[var(--text)] mt-1">
          Forgot PIN?
        </button>
      </div>
    </div>
  )
}
