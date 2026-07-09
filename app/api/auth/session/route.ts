import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { createSession } from '@/lib/auth/session'
import { checkRateLimit, rateLimitKey } from '@/lib/security/rate-limit'
import { parseJsonBody, isValidIdToken } from '@/lib/security/input-validator'

export async function POST(req: NextRequest) {
  // ── Rate limit: 20 session creations per IP per 15 minutes ──────────────────
  const rl = checkRateLimit(rateLimitKey('session', req), 20, 15 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  // ── Parse and validate body ─────────────────────────────────────────────────
  const body = await parseJsonBody<{ idToken?: string }>(req)
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status })
  }

  if (!isValidIdToken(body.data.idToken)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 })
  }

  try {
    const auth = getAdminAuth()
    const decoded = await auth.verifyIdToken(body.data.idToken)

    // Check if user account is disabled
    const userRecord = await auth.getUser(decoded.uid)
    if (userRecord.disabled) {
      return NextResponse.json({ error: 'This account has been disabled.' }, { status: 403 })
    }

    // Derive display name: prefer Firebase displayName, fall back to email prefix
    const rawName  = decoded.name || decoded.email || ''
    const displayName = decoded.name
      ? decoded.name
      : rawName.split('@')[0].replace(/[0-9]/g, '').replace(/[._]/g, ' ').trim()
          .split(/\s+/).filter(Boolean)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || rawName

    await createSession(decoded.uid, decoded.email || '', displayName)

    return NextResponse.json({ ok: true, uid: decoded.uid })
  } catch (err) {
    const fbErr = err as { code?: string }
    if (fbErr.code === 'auth/user-disabled') {
      return NextResponse.json({ error: 'This account has been disabled.' }, { status: 403 })
    }
    // Log minimal info — never expose Firebase error details to the client
    console.error('[session] Token verification failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }
}
