'use client'
import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signupAction } from '@/app/actions/auth'
import { signInWithPopup, signInWithRedirect, GoogleAuthProvider, getRedirectResult, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { getClientAuth } from '@/lib/firebase/client'

function isMobile() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
}

async function firebaseSignup(email: string, password: string, name: string): Promise<string> {
  const cred = await createUserWithEmailAndPassword(getClientAuth(), email, password)
  if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() })
  return cred.user.getIdToken()
}

async function firebaseGoogleSignup(useRedirect: boolean): Promise<string> {
  const auth     = getClientAuth()
  const provider = new GoogleAuthProvider()

  if (useRedirect) {
    await signInWithRedirect(auth, provider)
    return ''
  }

  const cred = await signInWithPopup(auth, provider)
  return cred.user.getIdToken()
}

async function exchangeToken(idToken: string): Promise<void> {
  const res = await fetch('/api/auth/session', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ idToken }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error || 'Session creation failed')
  }
}

function firebaseError(err: unknown): string {
  const code = (err as { code?: string }).code ?? ''
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.'
  if (code === 'auth/weak-password')        return 'Password must be at least 8 characters.'
  if (code === 'auth/invalid-email')        return 'Please enter a valid email address.'
  if (code === 'auth/invalid-api-key' || code === 'auth/app-not-authorized')
    return 'Firebase is not configured. Ask the app owner to set up authentication.'
  if (code === 'auth/popup-blocked')        return 'Sign-in popup was blocked. Please allow popups or try signing in with email.'
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is not enabled. Contact the app owner.'
  if (code === 'auth/unauthorized-domain')  return 'This domain is not authorized for sign-in in Firebase Console.'
  if (code === 'auth/network-request-failed') return 'Network error. Check your internet connection.'
  if (code === 'auth/account-exists-with-different-credential')
    return 'An account already exists with this email using a different sign-in method.'
  return `Sign-up failed. Please try again.`
}

export default function SignupPage() {
  const router            = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoad] = useState(false)
  const [ssoLoad, setSso]  = useState(false)
  const mounted  = useRef(true)
  const ssoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const auth = getClientAuth()

    getRedirectResult(auth).then(cred => {
      if (!cred || !mounted.current) return
      cred.user.getIdToken().then(idToken => exchangeToken(idToken)).then(() => {
        window.location.href = '/dashboard'
      }).catch(err => {
        const code = (err as { code?: string }).code ?? ''
        if (code !== 'auth/popup-closed-by-user') setError(firebaseError(err))
      })
    }).catch(err => {
      const code = (err as { code?: string }).code ?? ''
      if (code !== 'auth/popup-closed-by-user') setError(firebaseError(err))
    })

    return () => { mounted.current = false; clearTimeout(ssoTimer.current) }
  }, [])

  const firebaseEnabled = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const data     = new FormData(e.currentTarget)
    const email    = data.get('email')    as string
    const password = data.get('password') as string
    const confirm  = data.get('confirm')  as string
    const name     = (data.get('name')    as string) ?? ''

    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }

    setLoad(true)
    try {
      if (firebaseEnabled) {
        const idToken = await firebaseSignup(email, password, name)
        await exchangeToken(idToken)
        router.push('/dashboard')
      } else {
        // Fallback: custom Argon2id auth (works without Firebase)
        const result = await signupAction(undefined, data)
        if (result?.error) setError(result.error)
        // signupAction redirects on success
      }
    } catch (err) {
      if ((err as { digest?: string })?.digest?.startsWith?.('NEXT_REDIRECT')) throw err
      setError(firebaseEnabled ? firebaseError(err) : 'Sign-up failed. Please try again.')
    } finally {
      setLoad(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setSso(true)
    const redirect = isMobile()
    ssoTimer.current = setTimeout(() => { if (mounted.current) setSso(false) }, 30000)
    try {
      const idToken = await firebaseGoogleSignup(redirect)
      clearTimeout(ssoTimer.current)
      if (!redirect) {
        await exchangeToken(idToken)
        router.push('/dashboard')
      }
      // redirect mode: page will navigate away, no further action needed
    } catch (err) {
      clearTimeout(ssoTimer.current)
      const code = (err as { code?: string }).code ?? ''
      if (code !== 'auth/popup-closed-by-user') setError(firebaseError(err))
    } finally {
      if (mounted.current) setSso(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">K</div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">Join Kunal&apos;s Planner</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="auth-label">
              Name <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
            </label>
            <input name="name" type="text" autoComplete="name"
              className="auth-input" placeholder="Your name" />
          </div>

          <div>
            <label className="auth-label">Email</label>
            <input name="email" type="email" required autoComplete="email"
              className="auth-input" placeholder="you@example.com" />
          </div>

          <div>
            <label className="auth-label">Password</label>
            <input name="password" type="password" required autoComplete="new-password"
              className="auth-input" placeholder="Min 8 characters" />
            <p className="auth-hint">Use letters, numbers and a symbol (e.g. Test@1234)</p>
          </div>

          <div>
            <label className="auth-label">Confirm Password</label>
            <input name="confirm" type="password" required autoComplete="new-password"
              className="auth-input" placeholder="Repeat password" />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={loading} className="auth-btn-primary">
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          {firebaseEnabled && (
            <>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--color-border)]" />
                </div>
            <div className="relative flex justify-center text-xs text-[var(--color-text-secondary)]">
              <span className="bg-[var(--color-bg-card)] px-2">or</span>
                </div>
              </div>

              <button type="button" onClick={handleGoogle} disabled={ssoLoad}
                className="auth-btn-sso">
                {ssoLoad ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="spinner" />
                    Signing in…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign up with Google
                  </span>
                )}
              </button>
            </>
          )}
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link href="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
