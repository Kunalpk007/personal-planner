/**
 * Tracks the currently authenticated user ID so the persistence layer
 * can namespace all localStorage keys as `{baseKey}:{userId}`.
 *
 * Firebase migration: replace the localStorage calls in store/index.ts
 * with Firestore reads/writes using the same userId from getUserScope().
 */

// Read uid synchronously at module init so Zustand's auto-rehydration (which
// fires when store/index.ts is first imported) already uses the correct scoped
// key rather than the generic __anon__ key.
export function readUidFromCookieSync(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)kp_uid=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

let _userId: string | null = readUidFromCookieSync()

export function setUserScope(userId: string | null): void {
  _userId = userId
}

export function getUserScope(): string | null {
  return _userId
}

/** Returns the storage key namespaced to the current user. */
export function scopedStorageKey(baseKey: string): string {
  if (!_userId) return `${baseKey}:__anon__`
  return `${baseKey}:${_userId}`
}
