'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { sendPasswordResetEmail } from 'firebase/auth'
import { getClientAuth } from '@/lib/firebase/client'

export default function ResetPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [status,  setStatus]  = useState<'idle' | 'sent' | 'error'>('idle')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await sendPasswordResetEmail(getClientAuth(), email.trim())
      setStatus('sent')
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      // Don't reveal whether the email exists
      if (code === 'auth/user-not-found') {
        setStatus('sent') // same UX — attacker can't enumerate users
      } else if (code === 'auth/invalid-email') {
        setError('Enter a valid email address.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (status === 'sent') {
    return (
      <div className="auth-shell">
        <div className="auth-card text-center">
          <div className="text-4xl mb-3">📧</div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-sub" style={{ marginBottom: '1.5rem' }}>
            If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your spam folder too.
          </p>
          <Link href="/login" className="auth-btn-primary block text-center no-underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">K</div>
        <h1 className="auth-title">Forgot password?</h1>
        <p className="auth-sub">
          Enter your email and Firebase will send you a secure reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="auth-label">Email</label>
            <input
              type="email"
              required
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={loading} className="auth-btn-primary">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/login" className="auth-link">← Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
