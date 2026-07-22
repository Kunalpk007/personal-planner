'use client'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // ChunkLoadError means the browser has stale JS bundle references (e.g. after
    // a hot-reload recompile or a fresh deploy). Force a full reload to fetch the
    // fresh chunks — but only once per error, so a genuinely broken build can't
    // trap the user in an infinite reload loop.
    const isChunk = error?.name === 'ChunkLoadError'
      || /ChunkLoadError|Loading chunk|Failed to load chunk|Loading CSS chunk|dynamically imported module/i.test(error?.message ?? '')
    if (!isChunk) return
    const key = `kp_chunk_reload:${error?.digest ?? error?.message ?? 'x'}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {}
    window.location.reload()
  }, [error])

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          gap: 16,
          padding: 24,
          background: '#0e1117',
          color: '#c9d1d9',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</h2>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0, textAlign: 'center', maxWidth: 360 }}>
            {error?.message?.includes('chunk') || error?.name === 'ChunkLoadError'
              ? 'The app updated while you were browsing. Reloading...'
              : 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '8px 20px',
              background: '#3B6D11',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
