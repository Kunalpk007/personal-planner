'use client'
import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { loginAction } from '@/app/actions/auth'

// Firebase imports are only invoked in the browser when Firebase is configured
async function firebaseLogin(email: string, password: string): Promise<string> {
  const { signInWithEmailAndPassword } = await import('firebase/auth')
  const { getClientAuth }              = await import('@/lib/firebase/client')
  const cred    = await signInWithEmailAndPassword(getClientAuth(), email, password)
  return cred.user.getIdToken()
}

async function firebaseGoogleLogin(): Promise<string> {
  const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth')
  const { getClientAuth }                       = await import('@/lib/firebase/client')
  const cred = await signInWithPopup(getClientAuth(), new GoogleAuthProvider())
  return cred.user.getIdToken()
}

async function exchangeToken(idToken: string): Promise<void> {
  const res = await fetch('/api/auth/session', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ idToken }),
  })
  if (!res.ok) throw new Error('Session creation failed')
}

function firebaseError(err: unknown): string {
  const code = (err as { code?: string }).code ?? ''
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password')
    return 'Invalid email or password.'
  if (code === 'auth/too-many-requests')
    return 'Too many failed attempts. Try again later or reset your password.'
  if (code === 'auth/user-disabled')
    return 'This account has been disabled.'
  return 'Sign-in failed. Please try again.'
}

function LoginForm() {
  const router    = useRouter()
  const params    = useSearchParams()
  const from      = params.get('from') ?? '/dashboard'
  const expired   = params.get('reason') === 'session_expired'
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoad, setSsoLoad] = useState(false)

  const firebaseEnabled = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const data = new FormData(e.currentTarget)

    try {
      if (firebaseEnabled) {
        const idToken = await firebaseLogin(
          data.get('email') as string,
          data.get('password') as string,
        )
        await exchangeToken(idToken)
        router.push(from)
      } else {
        // Fallback: custom Argon2id auth (works without Firebase)
        const result = await loginAction(undefined, data)
        if (result?.error) setError(result.error)
        // loginAction redirects on success — no router.push needed
      }
    } catch (err) {
      // NEXT_REDIRECT is thrown by redirect() in server actions — re-throw so Next.js handles the navigation
      if ((err as { digest?: string })?.digest?.startsWith?.('NEXT_REDIRECT')) throw err
      setError(firebaseEnabled ? firebaseError(err) : 'Sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setSsoLoad(true)
    try {
      const idToken = await firebaseGoogleLogin()
      await exchangeToken(idToken)
      router.push(from)
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      if (code !== 'auth/popup-closed-by-user') setError(firebaseError(err))
    } finally {
      setSsoLoad(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {expired && (
        <div className="auth-error" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', borderColor: '#EF9F27' }}>
          Your session expired. Please sign in again.
        </div>
      )}
      <div>
        <label className="auth-label">Email</label>
        <input name="email" type="email" required autoComplete="email"
          className="auth-input" placeholder="you@example.com" />
      </div>

      <div>
        <label className="auth-label">Password</label>
        <input name="password" type="password" required autoComplete="current-password"
          className="auth-input" placeholder="••••••••" />
      </div>

      {error && <div className="auth-error">{error}</div>}

      <button type="submit" disabled={loading} className="auth-btn-primary">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      {firebaseEnabled && (
        <>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center text-xs text-[var(--color-text-muted)]">
              <span className="bg-[var(--color-bg-card)] px-2">or</span>
            </div>
          </div>

          <button type="button" onClick={handleGoogle} disabled={ssoLoad}
            className="auth-btn-sso" style={{ cursor: 'pointer', opacity: ssoLoad ? 0.6 : 1 }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {ssoLoad ? 'Opening Google…' : 'Continue with Google'}
          </button>
        </>
      )}
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">K</div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to Kunal's Planner</p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="auth-footer">
          No account?{' '}
          <Link href="/signup" className="auth-link">Create one</Link>
          {' · '}
          <Link href="/reset-password" className="auth-link">Forgot password?</Link>
        </p>
      </div>
    </div>
  )
}
