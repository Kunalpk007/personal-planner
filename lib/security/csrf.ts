import 'server-only'

/**
 * Lightweight origin/referer check to prevent CSRF.
 *
 * Only applies to state-changing methods (POST, PUT, DELETE, PATCH).
 * GET/HEAD/OPTIONS are considered safe per the HTTP spec.
 *
 * WARNING: This check is bypassed when the Origin header is absent
 * (e.g. native apps, curl, Postman). For those cases you'd need a
 * CSRF token — but for a personal planner the origin check is sufficient.
 */
export function rejectCrossOrigin(
  req: Request,
  opts?: { allowMethods?: string[] },
): Response | null {
  const method = req.method.toUpperCase()
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS', ...(opts?.allowMethods ?? [])].map(m => m.toUpperCase()))
  if (safeMethods.has(method)) return null

  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host = req.headers.get('host')

  // No origin/referer header — allow (can't CSRF without a page context)
  if (!origin && !referer) return null

  if (origin) {
    try {
      const originUrl = new URL(origin)
      if (originUrl.host !== host) {
        return new Response(JSON.stringify({ error: 'Cross-origin request rejected' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid origin header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  if (!origin && referer) {
    try {
      const refererUrl = new URL(referer)
      if (refererUrl.host !== host) {
        return new Response(JSON.stringify({ error: 'Cross-origin request rejected' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid referer header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  return null
}
