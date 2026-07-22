'use client'
import { useEffect } from 'react'

/** Detects the various shapes a stale-bundle / failed-chunk error can take —
 *  Turbopack and webpack word them differently across versions. */
function isChunkError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null | undefined
  const name = e?.name ?? ''
  const msg  = e?.message ?? ''
  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError|Loading chunk|Failed to load chunk|Loading CSS chunk|error loading dynamically imported module/i.test(msg)
  )
}

/**
 * Shared fallback for every route-level error.tsx. Goals:
 *  1. A user should never be stuck staring at an error — a stale bundle
 *     (ChunkLoadError, common in dev after a recompile and possible in prod
 *     right after a deploy) auto-reloads once to fetch fresh chunks.
 *  2. "Try again" first calls Next's reset() (re-renders the route); if that
 *     doesn't clear it, a "Reload app" hard-reload always recovers.
 *  3. We only auto-reload ONCE per error (guarded by a sessionStorage stamp)
 *     so a genuinely broken build can't get stuck in a reload loop.
 */
export function RouteErrorFallback({
  error,
  reset,
  label = 'This page',
}: {
  error: Error & { digest?: string }
  reset: () => void
  label?: string
}) {
  const chunk = isChunkError(error)
  const reloadKey = `kp_chunk_reload:${error.digest ?? error.message ?? 'x'}`
  // Auto-reload on a chunk error, but only the first time this session (guard
  // against a reload loop on a genuinely broken build). Computed as a plain
  // value during render — the component unmounts on reload, so `reloading`
  // just suppresses the buttons for the brief moment before navigation.
  let reloading = false
  if (chunk && typeof window !== 'undefined') {
    try { reloading = !sessionStorage.getItem(reloadKey) } catch {}
  }

  useEffect(() => {
    if (!reloading) return
    try { sessionStorage.setItem(reloadKey, '1') } catch {}
    window.location.reload()
  }, [reloading, reloadKey])

  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 22, background: 'var(--amber-bg)', color: 'var(--amber)',
      }}>!</div>
      <p style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--text)' }}>
        {chunk ? 'The app just updated' : `${label} hit a snag`}
      </p>
      <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: 0, maxWidth: 300, lineHeight: 1.5 }}>
        {chunk
          ? (reloading ? 'Reloading with the latest version…' : 'Reload to get the newest version.')
          : 'Something went wrong loading this section. Your data is safe — try again.'}
      </p>
      {!reloading && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]"
          >
            Reload app
          </button>
        </div>
      )}
    </div>
  )
}
