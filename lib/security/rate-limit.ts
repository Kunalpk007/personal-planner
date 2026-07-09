import 'server-only'

interface Bucket {
  count: number
  resetAt: number
}

const store = new Map<string, Bucket>()

// Sweep expired entries every 60s to avoid unbounded growth
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 60_000)
}

/**
 * In-memory sliding-window rate limiter.
 *
 * WARNING: This resets on server restart / serverless cold start.
 * For multi-instance deployments, replace with Redis (upstash-rate-limiter, etc.).
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxAttempts - 1, resetAt: now + windowMs }
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: maxAttempts - entry.count, resetAt: entry.resetAt }
}

/**
 * Build a rate-limit key from request — uses IP + identifier prefix.
 */
export function rateLimitKey(prefix: string, req: Request | { headers: { get: (n: string) => string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  return `${prefix}:${ip}`
}
