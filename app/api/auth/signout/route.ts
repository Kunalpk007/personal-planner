import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isFirebaseConfigured, getAdminAuth } from '@/lib/firebase/admin'
import { checkRateLimit, rateLimitKey } from '@/lib/security/rate-limit'

export async function POST(req: NextRequest) {
  // ── Rate limit: 10 signouts per IP per 5 minutes ────────────────────────────
  const rl = checkRateLimit(rateLimitKey('signout', req), 10, 5 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  const jar    = await cookies()
  const cookie = jar.get('kp_session')?.value

  if (cookie && isFirebaseConfigured()) {
    try {
      const auth    = getAdminAuth()
      const decoded = await auth.verifySessionCookie(cookie)
      await auth.revokeRefreshTokens(decoded.sub)
    } catch { /* session expired or Firebase not available */ }
  }

  jar.delete('kp_session')
  jar.delete('kp_uid')
  jar.delete('kp_display')
  return NextResponse.json({ ok: true })
}
