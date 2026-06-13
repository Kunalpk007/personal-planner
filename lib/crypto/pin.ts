export async function sha256(str: string): Promise<string> {
  const buf  = new TextEncoder().encode(str)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPin(input: string, storedHash: string): Promise<boolean> {
  const hash = await sha256(input)
  return hash === storedHash
}
