'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { findAccountAction, resetPasswordAction } from '@/app/actions/auth'

const firebaseEnabled = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY

async function firebaseResetEmail(email: string): Promise<void> {
  const { sendPasswordResetEmail } = await import('firebase/auth')
  const { getClientAuth } = await import('@/lib/firebase/client')
  await sendPasswordResetEmail(getClientAuth(), email)
}

export default function ResetPasswordPage() {
  const [mode, setMode] = useState<'firebase' | 'custom'>(
    firebaseEnabled ? 'firebase' : 'custom'
  )

  // ── Firebase flow ──
  const [fEmail,   setFEmail]   = useState('')
  const [fStatus,  setFStatus]  = useState<'idle' | 'sent' | 'error'>('idle')
  const [fError,   setFError]   = useState('')
  const [fLoading, setFLoading] = useState(false)

  async function handleFirebaseSubmit(e: FormEvent) {
    e.preventDefault()
    setFError('')
    setFLoading(true)
    try {
      await firebaseResetEmail(fEmail.trim())
      setFStatus('sent')
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/user-not-found') {
        setFStatus('sent')
      } else if (code === 'auth/invalid-email') {
        setFError('Enter a valid email address.')
      } else {
        setFError('Something went wrong. Please try again.')
      }
    } finally {
      setFLoading(false)
    }
  }

  // ── Custom auth flow ──
  const [cStep,    setCStep]    = useState<'email' | 'verify' | 'done'>('email')
  const [cEmail,   setCEmail]   = useState('')
  const [cError,   setCError]   = useState('')
  const [cLoading, setCLoading] = useState(false)
  const [cQuestion, setCQuestion] = useState('')

  async function handleFindAccount(e: FormEvent) {
    e.preventDefault()
    setCError('')
    setCLoading(true)
    const form = new FormData(e.currentTarget as HTMLFormElement)
    try {
      const result = await findAccountAction(undefined, form)
      if (result?.error) {
        setCError(result.error)
      } else if (result?.step === 'verify') {
        setCQuestion(result.question || '')
        setCEmail(result.email || '')
        setCStep('verify')
      }
    } catch {
      setCError('Something went wrong.')
    } finally {
      setCLoading(false)
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    setCError('')
    setCLoading(true)
    const form = new FormData(e.currentTarget as HTMLFormElement)
    form.set('email', cEmail)
    try {
      const result = await resetPasswordAction(undefined, form)
      if (result?.error) {
        setCError(result.error)
      } else if (result?.step === 'done') {
        setCStep('done')
      }
    } catch {
      setCError('Something went wrong.')
    } finally {
      setCLoading(false)
    }
  }

  if (fStatus === 'sent') {
    return (
      <div className="auth-shell">
        <div className="auth-card text-center">
          <div className="text-4xl mb-3">📧</div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-sub" style={{ marginBottom: '1.5rem' }}>
            If an account exists for <strong>{fEmail}</strong>, a password reset link has been sent. Check your spam folder too.
          </p>
          <p className="auth-sub" style={{ marginBottom: '1.5rem' }}>
            Didn&apos;t get an email?{' '}
            <button
              className="auth-link"
              onClick={() => setMode('custom')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}
            >
              Try your security question instead
            </button>
          </p>
          <Link href="/login" className="auth-btn-primary block text-center no-underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  if (cStep === 'done') {
    return (
      <div className="auth-shell">
        <div className="auth-card text-center">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="auth-title">Password reset</h1>
          <p className="auth-sub" style={{ marginBottom: '1.5rem' }}>
            Your password has been changed successfully.
          </p>
          <Link href="/login" className="auth-btn-primary block text-center no-underline">
            Sign in with new password
          </Link>
        </div>
      </div>
    )
  }

  // ── Firebase mode ──
  if (mode === 'firebase') {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-logo">K</div>
          <h1 className="auth-title">Forgot password?</h1>
          <p className="auth-sub">
            Enter your email and we&#8203;ll send you a secure reset link.
          </p>

          <form onSubmit={handleFirebaseSubmit} className="space-y-4">
            <div>
              <label className="auth-label">Email</label>
              <input
                type="email"
                required
                className="auth-input"
                placeholder="you@example.com"
                value={fEmail}
                onChange={e => setFEmail(e.target.value)}
              />
            </div>

            {fError && <div className="auth-error">{fError}</div>}

            <button type="submit" disabled={fLoading} className="auth-btn-primary">
              {fLoading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <p className="auth-footer" style={{ flexDirection: 'column', gap: '0.25rem' }}>
            <Link href="/login" className="auth-link">← Back to sign in</Link>
            <button
              className="auth-link"
              onClick={() => setMode('custom')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Use security question instead
            </button>
          </p>
        </div>
      </div>
    )
  }

  // ── Custom auth: Step 1 - Find account ──
  if (cStep === 'email') {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-logo">K</div>
          <h1 className="auth-title">Forgot password?</h1>
          <p className="auth-sub">
            Enter your email to answer your security question.
          </p>

          <form onSubmit={handleFindAccount} className="space-y-4">
            <div>
              <label className="auth-label">Email</label>
              <input
                type="email"
                name="email"
                required
                className="auth-input"
                placeholder="you@example.com"
              />
            </div>

            {cError && <div className="auth-error">{cError}</div>}

            <button type="submit" disabled={cLoading} className="auth-btn-primary">
              {cLoading ? 'Looking up…' : 'Find account'}
            </button>
          </form>

          <p className="auth-footer">
            <Link href="/login" className="auth-link">← Back to sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  // ── Custom auth: Step 2 - Answer question + set password ──
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">K</div>
        <h1 className="auth-title">Security question</h1>
        <p className="auth-sub">
          Answer your security question to reset your password.
        </p>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="auth-label">Your security question</label>
            <p className="auth-input" style={{ background: 'var(--bg-secondary)', cursor: 'default' }}>
              {cQuestion}
            </p>
          </div>

          <div>
            <label className="auth-label">Answer</label>
            <input
              type="text"
              name="answer"
              required
              className="auth-input"
              placeholder="Your answer"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="auth-label">New password</label>
            <input
              type="password"
              name="newPassword"
              required
              minLength={8}
              className="auth-input"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="auth-label">Confirm new password</label>
            <input
              type="password"
              name="confirm"
              required
              className="auth-input"
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
          </div>

          {cError && <div className="auth-error">{cError}</div>}

          <button type="submit" disabled={cLoading} className="auth-btn-primary">
            {cLoading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/login" className="auth-link">← Back to sign in</Link>
        </p>
      </div>
    </main>
  )
}
