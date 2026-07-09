import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'kp_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const MIN_SECRET_LENGTH = 32

function getKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET env var is not set')
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length})`)
  }
  return new TextEncoder().encode(secret)
}

export interface SessionPayload {
  userId: string
  email:  string
  exp?:   number
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getKey())
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ['HS256'] })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

/** Derives a friendly first name from an email address.
 *  e.g. kunalpk007@gmail.com → "Kunal", john.doe@x.com → "John Doe" */
function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0]
  const clean = local.replace(/[0-9]/g, '').replace(/[._]/g, ' ').trim()
  return clean
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || email
}

export async function createSession(userId: string, email: string, displayName?: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const token = await encrypt({ userId, email })
  const jar = await cookies()
  const secure = process.env.NODE_ENV === 'production'

  // httpOnly JWT — the real auth token, JS cannot read this
  // sameSite: 'strict' prevents the browser from sending the cookie on
  // cross-site requests, mitigating CSRF on state-changing API calls.
  jar.set(COOKIE_NAME, token, { httpOnly: true, secure, expires: expiresAt, sameSite: 'strict', path: '/' })

  // Readable by JS — used to namespace localStorage per user (not a secret)
  jar.set('kp_uid', userId, { httpOnly: false, secure, expires: expiresAt, sameSite: 'lax', path: '/' })

  // Readable by JS — user's display name for the UI (not a secret)
  let name = displayName || displayNameFromEmail(email)
  try { name = decodeURIComponent(name) } catch {} // guard against double-encoding from OAuth providers
  jar.set('kp_display', encodeURIComponent(name), { httpOnly: false, secure, expires: expiresAt, sameSite: 'lax', path: '/' })
}

export async function deleteSession() {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
  jar.delete('kp_uid')
  jar.delete('kp_display')
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  return decrypt(token)
}

export { COOKIE_NAME }
