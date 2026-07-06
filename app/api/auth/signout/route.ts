import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAdminAuth } from '@/lib/firebase/admin'

export async function POST(req: NextRequest) {
  const jar    = await cookies()
  const cookie = jar.get('kp_session')?.value

  if (cookie) {
    try {
      // Revoke all tokens for this session (kicks user from all devices)
      const auth    = getAdminAuth()
      const decoded = await auth.verifySessionCookie(cookie)
      await auth.revokeRefreshTokens(decoded.sub)
    } catch {
      // Session already expired — still clear the cookie
    }
  }

  jar.delete('kp_session')
  jar.delete('kp_uid')
  jar.delete('kp_display')
  return NextResponse.json({ ok: true })
}
