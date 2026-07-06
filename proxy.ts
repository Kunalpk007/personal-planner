import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, isFirebaseConfigured } from '@/lib/firebase/admin'
import { decrypt, COOKIE_NAME }            from '@/lib/auth/session'

const PUBLIC_PATHS = ['/login', '/signup', '/reset-password']

/** Returns the uid if session is valid, 'expired' if cookie exists but is invalid, null if no cookie. */
async function resolveUid(req: NextRequest): Promise<string | 'expired' | null> {
  const cookie = req.cookies.get('kp_session')?.value
  if (!cookie) return null

  if (isFirebaseConfigured()) {
    try {
      const decoded = await getAdminAuth().verifySessionCookie(cookie, true)
      return decoded.uid
    } catch {
      return 'expired'
    }
  }

  // Fallback: custom JWT (used when Firebase is not yet configured)
  const session = await decrypt(cookie)
  if (session?.userId) return session.userId
  return cookie ? 'expired' : null
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isApi    = pathname.startsWith('/api')

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webp|jpg|jpeg)$).*)'],
}
