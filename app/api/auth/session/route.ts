import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAdminAuth } from '@/lib/firebase/admin'

const SESSION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function POST(req: NextRequest) {
  const { idToken } = await req.json()
  if (!idToken) return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })

  try {
    // Firebase Admin creates a signed session cookie (handles expiry + revocation)
    const auth = getAdminAuth()
    const [sessionCookie, decoded] = await Promise.all([
      auth.createSessionCookie(idToken, { expiresIn: SESSION_MS }),
      auth.verifyIdToken(idToken),
    ])

    const expires = new Date(Date.now() + SESSION_MS)
    const jar    = await cookies()
    const secure = process.env.NODE_ENV === 'production'

    // Derive display name: prefer Firebase displayName, fall back to email prefix
    const rawName  = decoded.name || decoded.email || ''
    const displayName = decoded.name
      ? decoded.name
      : rawName.split('@')[0].replace(/[0-9]/g, '').replace(/[._]/g, ' ').trim()
          .split(/\s+/).filter(Boolean)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || rawName

    // httpOnly — the real auth credential, JS cannot read this
    jar.set('kp_session', sessionCookie, { httpOnly: true, secure, expires, sameSite: 'lax', path: '/' })

    // Readable by JS — used to namespace localStorage per user (not a secret)
    jar.set('kp_uid', decoded.uid, { httpOnly: false, secure, expires, sameSite: 'lax', path: '/' })

    // Readable by JS — user's display name for the UI (not a secret)
    jar.set('kp_display', encodeURIComponent(displayName), { httpOnly: false, secure, expires, sameSite: 'lax', path: '/' })

    return NextResponse.json({ ok: true, uid: decoded.uid })
  } catch (err) {
    console.error('[session] Token verification failed:', err)
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }
}
