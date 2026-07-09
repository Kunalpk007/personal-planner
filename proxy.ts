import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/auth/session'
import { rejectCrossOrigin } from '@/lib/security/csrf'

const PUBLIC_PATHS = ['/login', '/signup', '/reset-password']

async function resolveUid(req: NextRequest): Promise<string | 'expired' | null> {
  const cookie = req.cookies.get('kp_session')?.value
  if (!cookie) return null

  const session = await decrypt(cookie)
  if (session?.userId) return session.userId
  return cookie ? 'expired' : null
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isApi    = pathname.startsWith('/api')

  // ── CSRF check for state-changing requests ──────────────────────────────────
  const unsafeMethods = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])
  if (isApi && unsafeMethods.has(req.method.toUpperCase())) {
    const csrfResp = rejectCrossOrigin(req)
    if (csrfResp) return csrfResp
  }

  const uid = await resolveUid(req)

  if (uid && uid !== 'expired' && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  if ((!uid || uid === 'expired') && !isPublic && !isApi) {
    const url = new URL('/login', req.nextUrl)
    url.searchParams.set('from', pathname)
    if (uid === 'expired') url.searchParams.set('reason', 'session_expired')
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest\\.(?:json|webmanifest)|.*\\.(?:png|svg|ico|webp|jpg|jpeg)$).*)'],
}
