'use client'
import { useEffect, useState } from 'react'

export function PwaBootstrap() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {})

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }

    const installedHandler = () => setInstalled(true)

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  if (!installPrompt || installed) return null

  return (
    <button
      onClick={() => {
        ;(installPrompt as Event & { prompt: () => Promise<void> }).prompt()
      }}
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: 'var(--color-accent)',
        color: '#000',
        border: 'none',
        borderRadius: 12,
        padding: '10px 20px',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      Install App
    </button>
  )
}