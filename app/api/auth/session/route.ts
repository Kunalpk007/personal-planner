import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { createSession } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const { idToken } = await req.json()
  if (!idToken) return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })

  try {
    const auth = getAdminAuth()
    const decoded = await auth.verifyIdToken(idToken)

    // Derive display name: prefer Firebase displayName, fall back to email prefix
    const rawName  = decoded.name || decoded.email || ''
    const displayName = decoded.name
      ? decoded.name
      : rawName.split('@')[0].replace(/[0-9]/g, '').replace(/[._]/g, ' ').trim()
          .split(/\s+/).filter(Boolean)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || rawName

    // Use custom JWT session (edge-compatible for middleware, no Firebase session cookie)
    await createSession(decoded.uid, decoded.email || '', displayName)

    return NextResponse.json({ ok: true, uid: decoded.uid })
  } catch (err) {
    console.error('[session] Token verification failed:', err)
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }
}
