'use client'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/ui/Modal'

const REMINDER_SEEN_KEY = 'kp_pwa_reminder_seen'

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  // iPadOS 13+ deliberately reports a desktop Safari UA ("Macintosh...") when
  // "Request Desktop Website" is the default — the classic /iPad/ check
  // alone misses it. maxTouchPoints > 1 on a "Macintosh" UA is the standard
  // workaround (a real Mac reports 0).
  const isIpadDesktopMode = /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1
  const isIOS = (/iPad|iPhone|iPod/.test(ua) || isIpadDesktopMode) && !(window as unknown as { MSStream?: unknown }).MSStream
  if (isIOS) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  // iOS Safari doesn't support the display-mode media query pre-install; it
  // exposes navigator.standalone instead once the PWA is added to the home screen.
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return mq || iosStandalone
}

export function PwaBootstrap() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)
  const [installed, setInstalled] = useState(() => detectStandalone())
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [showReminder, setShowReminder] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV === 'development') {
      // Never register (and actively remove any previously-registered) SW in
      // dev — Next's dev build rebuilds JS chunks on every change without
      // content-hashing them the way prod does, so a cached chunk under the
      // stale-while-revalidate strategy can silently serve stale code and
      // make new changes look like they "aren't showing up".
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister())
      })
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
      }
    } else {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }

    const installedHandler = () => {
      setInstalled(true)
      setShowReminder(false)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  // Reminder popup: only for a genuine browser tab (not already installed),
  // shown at most once per calendar day so it nudges without nagging.
  useEffect(() => {
    if (installed) return
    if (typeof window === 'undefined') return
    const today = new Date().toISOString().slice(0, 10)
    let lastSeen: string | null = null
    try { lastSeen = localStorage.getItem(REMINDER_SEEN_KEY) } catch { /* ignore */ }
    if (lastSeen === today) return
    const timer = setTimeout(() => setShowReminder(true), 2500)
    return () => clearTimeout(timer)
  }, [installed])

  const dismissReminder = () => {
    setShowReminder(false)
    try {
      localStorage.setItem(REMINDER_SEEN_KEY, new Date().toISOString().slice(0, 10))
    } catch { /* ignore */ }
  }

  const steps = useMemo(() => {
    if (platform === 'ios') {
      return [
        'Tap the Share icon (square with an upward arrow) in Safari’s toolbar.',
        'Scroll down and tap "Add to Home Screen".',
        'Tap "Add" in the top-right corner.',
      ]
    }
    if (platform === 'android') {
      return [
        'Tap the ⋮ menu in the top-right corner of Chrome.',
        'Tap "Install app" (or "Add to Home screen").',
        'Confirm by tapping "Install".',
      ]
    }
    return [
      'Look for the install icon (⊕) in your browser’s address bar.',
      'If you don’t see it, open the browser menu and choose "Install Kunal’s Planner".',
      'Confirm the install prompt.',
    ]
  }, [platform])

  return (
    <>
      {installPrompt && !installed && (
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
      )}

      <Modal open={showReminder} onClose={dismissReminder} title="Install Kunal's Planner" variant="vx" maxWidth="max-w-sm">
        <p style={{ color: 'var(--vx-fg-2)', fontSize: 13, marginBottom: 12 }}>
          You&apos;re using the browser version. Install the app to your{' '}
          {platform === 'ios' ? 'home screen' : platform === 'android' ? 'home screen' : 'device'}{' '}
          for a faster, full-screen experience with offline support.
        </p>
        <ol style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, paddingLeft: 18, color: 'var(--vx-fg-1)', fontSize: 13, lineHeight: 1.4 }}>
          {steps.map((s, i) => (
            <li key={i} style={{ listStyleType: 'decimal' }}>{s}</li>
          ))}
        </ol>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {installPrompt ? (
            <button
              className="vx-btn vx-btn-primary"
              onClick={() => {
                ;(installPrompt as Event & { prompt: () => Promise<void> }).prompt()
                dismissReminder()
              }}
            >
              Install now
            </button>
          ) : null}
          <button className="vx-btn vx-btn-ghost" onClick={dismissReminder}>
            Remind me tomorrow
          </button>
        </div>
      </Modal>
    </>
  )
}
