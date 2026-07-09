'use server'
import { redirect } from 'next/navigation'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createSession, deleteSession }  from '@/lib/auth/session'
import { findUserByEmail, createUser, updatePassword } from '@/lib/auth/users'
export type AuthState = { error?: string; step?: string; question?: string; email?: string } | undefined

// ─── Login ────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email    = (formData.get('email')    as string)?.trim().toLowerCase()
  const password = (formData.get('password') as string)

  if (!email || !password) return { error: 'Email and password are required.' }

  const user = await findUserByEmail(email)
  if (!user) {
    // Perform a dummy verify to keep response time constant (prevent user enumeration)
    await hashPassword('dummy_prevent_timing_attack')
    return { error: 'Invalid email or password.' }
  }

  const ok = await verifyPassword(user.passwordHash, password)
  if (!ok) return { error: 'Invalid email or password.' }

  await createSession(user.id, user.email)
  redirect('/dashboard')
}

// ─── Signup ───────────────────────────────────────────────────────────────────

export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email     = (formData.get('email')    as string)?.trim().toLowerCase()
  const password  = (formData.get('password') as string)
  const confirm   = (formData.get('confirm')  as string)
  const name      = ((formData.get('name')    as string)?.trim()) || ''
  const question  = ((formData.get('question') as string)?.trim()) || 'n/a'
  const answer    = ((formData.get('answer')   as string)?.trim())  || 'n/a'

  if (!email || !password) return { error: 'Email and password are required.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (password !== confirm) return { error: 'Passwords do not match.' }

  const existing = await findUserByEmail(email)
  if (existing) return { error: 'An account with this email already exists.' }

  const passwordHash       = await hashPassword(password)
  const securityAnswerHash = await hashPassword(answer.toLowerCase())

  const user = await createUser(email, passwordHash, question, securityAnswerHash)
  await createSession(user.id, user.email, name || undefined)
  redirect('/dashboard')
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  await deleteSession()
  redirect('/login')
}

// ─── Reset password ───────────────────────────────────────────────────────────

// Step 1: find user by email, return security question
export async function findAccountAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email) return { error: 'Enter your email address.' }

  const user = await findUserByEmail(email)
  if (!user || !user.securityQuestion) {
    // vague on purpose — don't reveal whether the email exists
    return { error: 'No account found with that email, or no security question set.' }
  }
  return { step: 'verify', question: user.securityQuestion, email }
}

// Step 2+3: verify answer + set new password
export async function resetPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email       = (formData.get('email')       as string)?.trim().toLowerCase()
  const answer      = (formData.get('answer')      as string)?.trim()
  const newPassword = (formData.get('newPassword') as string)
  const confirm     = (formData.get('confirm')     as string)

  if (!email || !answer || !newPassword) return { error: 'All fields are required.' }
  if (newPassword !== confirm) return { error: 'Passwords do not match.' }
  if (newPassword.length < 8) return { error: 'Password must be at least 8 characters.' }

  const user = await findUserByEmail(email)
  if (!user) return { error: 'Account not found.' }

  const answerHash = await hashPassword(answer.toLowerCase())
  if (answerHash !== user.securityAnswerHash) {
    return { error: 'Incorrect answer. Try again.' }
  }

  const newHash = await hashPassword(newPassword)
  await updatePassword(user.id, newHash)
  return { step: 'done' }
}
