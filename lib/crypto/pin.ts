/**
 * PIN hashing using PBKDF2 (client-side via Web Crypto API).
 *
 * SHA-256 is too fast for low-entropy secrets like PINs or security answers.
 * PBKDF2 with 600 000 iterations adds significant verification cost,
 * making brute-force infeasible while remaining fast enough for UI use.
 *
 * NOTE: Argon2id is preferable but the Web Crypto API does not support it.
 * PBKDF2 is the next-best standard available everywhere.
 */

const ITERATIONS = 600_000
const SALT = new TextEncoder().encode('planner-pin-v2')

async function pbkdf2(input: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(input),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPin(pin: string): Promise<string> {
  return pbkdf2(pin)
}

export async function verifyPin(input: string, storedHash: string): Promise<boolean> {
  const hash = await pbkdf2(input)
  return hash === storedHash
}

/**
 * Backward-compatible verify that checks both PBKDF2 (v2) and SHA-256 (v1) hashes.
 * This ensures existing PINs are not invalidated after the upgrade.
 */
export async function verifyPinCompat(input: string, storedHash: string): Promise<boolean> {
  if (await verifyPin(input, storedHash)) return true
  return (await sha256(input)) === storedHash
}

// ── Legacy SHA-256 (kept for backward compatibility) ──────────────────────────

/** @deprecated Use `hashPin` instead — PBKDF2 is significantly more secure. */
export async function sha256(str: string): Promise<string> {
  const buf  = new TextEncoder().encode(str)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
