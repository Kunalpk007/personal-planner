import 'server-only'

const MAX_BODY_BYTES = 10_240 // 10 KB

/**
 * Read and validate a JSON request body.
 * - Enforces a 10 KB size limit to prevent DoS
 * - Returns `{ ok: true, data: T }` or `{ ok: false, status, error }`
 */
export async function parseJsonBody<T>(req: Request): Promise<
  { ok: true; data: T } | { ok: false; status: number; error: string }
> {
  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'Request body too large' }
  }

  let raw: string
  try {
    const ab = await req.arrayBuffer()
    if (ab.byteLength > MAX_BODY_BYTES) {
      return { ok: false, status: 413, error: 'Request body too large' }
    }
    raw = new TextDecoder().decode(ab)
  } catch {
    return { ok: false, status: 400, error: 'Failed to read request body' }
  }

  try {
    const data = JSON.parse(raw) as T
    return { ok: true, data }
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' }
  }
}

/**
 * Validate that a string looks like a Firebase ID token.
 * ID tokens are JWTs: three dot-separated base64url segments.
 * This is a lightweight format check — the real verification is done by Firebase Admin.
 */
export function isValidIdToken(s: unknown): s is string {
  return typeof s === 'string' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(s) && s.length < 4096
}
