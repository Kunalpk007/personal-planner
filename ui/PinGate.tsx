'use client'
import { useState } from 'react'
import { usePlannerStore } from '@/store'
import { PinPad } from './PinPad'
import { PinSetup } from './PinSetup'
import { hashPin } from '@/lib/crypto/pin'
import { showToast } from './Toast'
import { PIN_LENGTH, OLD_PIN_LENGTH } from '@/constants/points'

interface PinGateProps {
  children: React.ReactNode
  title?:   string
}

type Step = 'verify' | 'setup' | 'forgot-question' | 'forgot-reset' | 'migrate-verify' | 'migrate-setup'

/**
 * Wraps content behind the app-wide PIN. If no PIN is set yet, prompts
 * the user to create one along with a recovery security question.
 * Unlock state is per-session only — locks again on reload/navigation away and back.
 */
export function PinGate({ children, title = 'Enter PIN' }: PinGateProps) {
  const pin           = usePlannerStore(s => s.journalPin)
  const pinLength     = usePlannerStore(s => s.journalPinLength)
  const question      = usePlannerStore(s => s.journalPinQuestion)
  const answerHash     = usePlannerStore(s => s.journalPinAnswerHash)
  const setJournalSecurity = usePlannerStore(s => s.setJournalSecurity)

  // A PIN hashed before the 5→6 digit upgrade shipped has journalPinLength
  // unset (null) or explicitly OLD_PIN_LENGTH — either way it needs the
  // one-time migrate flow (verify the old PIN, then set a new PIN_LENGTH one)
  // before it can be used with the current PinPad, which now only accepts
  // PIN_LENGTH-digit input.
  const needsMigration = !!pin && (pinLength == null || pinLength !== PIN_LENGTH)

  const [unlocked, setUnlocked] = useState(false)
  const [step, setStep] = useState<Step>(pin ? (needsMigration ? 'migrate-verify' : 'verify') : 'setup')
  const [answerInput, setAnswerInput] = useState('')
  const [answerError, setAnswerError] = useState('')

  if (unlocked) return <>{children}</>

  if (pin && needsMigration && (step === 'migrate-verify' || step === 'migrate-setup')) {
    return (
      <div className="flex justify-center items-end min-h-[80vh] pb-20">
        <div className="w-full max-w-sm">
          {step === 'migrate-verify' ? (
            <>
              <div className="text-[15px] font-semibold mb-1 text-center">PIN security upgrade</div>
              <div className="text-xs mb-4 text-center" style={{ color: 'var(--vx-fg-4)' }}>
                We&apos;ve upgraded the {title} from {OLD_PIN_LENGTH} to {PIN_LENGTH} digits. Enter your current {OLD_PIN_LENGTH}-digit PIN to continue.
              </div>
              <PinPad
                mode="verify"
                storedHash={pin}
                length={OLD_PIN_LENGTH}
                title={`Enter your current ${OLD_PIN_LENGTH}-digit PIN`}
                onSuccess={() => setStep('migrate-setup')}
              />
            </>
          ) : (
            <>
              <div className="text-[15px] font-semibold mb-1 text-center">Set your new PIN</div>
              <div className="text-xs mb-4 text-center" style={{ color: 'var(--vx-fg-4)' }}>
                Choose a new {PIN_LENGTH}-digit PIN to finish the upgrade.
              </div>
              <PinSetup
                title={`Set a new ${PIN_LENGTH}-digit ${title}`}
                onComplete={(hash, q, aHash) => {
                  setJournalSecurity(hash, q, aHash)
                  setUnlocked(true)
                  showToast('PIN upgraded to 6 digits.')
                }}
              />
            </>
          )}
        </div>
      </div>
    )
  }

  if (!pin || step === 'setup') {
    return (
      <div className="flex justify-center items-end min-h-[80vh] pb-20">
        <div className="w-full max-w-sm">
          <div className="text-[15px] font-semibold mb-1 text-center">Set up {title}</div>
          <div className="text-xs mb-4 text-center" style={{ color: 'var(--vx-fg-4)' }}>
            Protect your journal with a {PIN_LENGTH}-digit PIN.
          </div>
          <PinSetup
            title={`Set a ${PIN_LENGTH}-digit ${title}`}
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
      <div className="flex justify-center items-end min-h-[80vh] pb-20">
        <div className="w-full max-w-sm text-center">
          <div className="text-[15px] font-semibold mb-1">Forgot PIN</div>
          {question ? (
            <>
              <div className="text-xs mb-4" style={{ color: 'var(--vx-fg-4)' }}>{question}</div>
              <input
                value={answerInput}
                onChange={e => setAnswerInput(e.target.value)}
                placeholder="Your answer"
                className="w-full vx-field mb-2"
              />
              <div className="text-xs h-4 mb-2" style={{ color: 'var(--red)' }}>{answerError}</div>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setStep('verify'); setAnswerInput(''); setAnswerError('') }} className="vx-btn vx-btn-ghost text-sm">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const hash = await hashPin(answerInput.trim().toLowerCase())
                    if (answerHash && hash === answerHash) {
                      setStep('forgot-reset')
                      setAnswerInput('')
                      setAnswerError('')
                    } else {
                      setAnswerError('Incorrect answer. Try again.')
                    }
                  }}
                  className="vx-btn vx-btn-primary text-sm"
                >
                  Verify
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs mb-4" style={{ color: 'var(--vx-fg-4)' }}>
                No recovery question was set for this PIN. You&apos;ll need to clear the app&apos;s storage to reset it.
              </div>
              <button onClick={() => setStep('verify')} className="vx-btn vx-btn-ghost text-sm">
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
      <div className="flex justify-center items-end min-h-[80vh] pb-20">
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
    <div className="flex justify-center items-end min-h-[80vh] pb-20">
      <div className="w-full max-w-sm text-center">
        <PinPad mode="verify" storedHash={pin} onSuccess={() => setUnlocked(true)} title={title} />
        <button onClick={() => setStep('forgot-question')} className="vx-btn vx-btn-ghost mt-3 w-full py-2.5 text-sm">
          Forgot PIN?
        </button>
      </div>
    </div>
  )
}
