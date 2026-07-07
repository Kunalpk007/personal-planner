const ITERATIONS = 5_000_000
const SALT = new TextEncoder().encode('journal-encryption-v1')
const VERIFICATION_PLAINTEXT = '___journal_encryption_verified___'

export function validatePassphrase(p: string): { ok: true } | { ok: false; reason: string } {
  if (p.length < 8) return { ok: false, reason: 'At least 8 characters' }
  if (!/[A-Z]/.test(p)) return { ok: false, reason: 'Must contain a capital letter' }
  return { ok: true }
}

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

function decodeBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

export async function createEncryptionKey(passphrase: string): Promise<{ key: CryptoKey; verificationToken: string }> {
  const key = await deriveKey(passphrase)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(VERIFICATION_PLAINTEXT),
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return { key, verificationToken: encodeBase64(combined) }
}

export async function tryUnlock(passphrase: string, token: string): Promise<CryptoKey | null> {
  try {
    const key = await deriveKey(passphrase)
    const combined = decodeBase64(token)
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return key
  } catch {
    return null
  }
}

export async function encryptText(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext),
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return encodeBase64(combined)
}

export async function decryptText(encoded: string, key: CryptoKey): Promise<string> {
  const combined = decodeBase64(encoded)
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}
