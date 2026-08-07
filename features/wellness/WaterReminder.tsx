'use client'
import { useEffect, useState } from 'react'
import { Modal } from '@/ui/Modal'
import { usePlannerStore } from '@/store'
import { useDayKey } from '@/hooks/useDayKey'

const STORAGE_KEY    = 'kp_water_last_reminder'
const INTERVAL_MS    = 2 * 60 * 60 * 1000 // 2 hours
const CHECK_EVERY_MS = 60 * 1000          // poll once a minute — cheap, and
                                           // catches the interval elapsing
                                           // even if the tab was backgrounded.

const MESSAGES = [
  'Time for a water break — grab a glass.',
  'Stay hydrated! Drink some water.',
  'Quick reminder: sip some water.',
  'Hydration check — have you had water recently?',
]

/** Mounted once globally (app shell). Nudges the user to drink water every
 *  2 hours while the app is open — shown as a proper popup modal (same
 *  pattern as the PWA install reminder in features/pwa/PwaBootstrap.tsx),
 *  not just a toast, since a toast is easy to miss/dismiss without acting on
 *  it. Uses localStorage (not the synced zustand store — this is a purely
 *  local, per-device reminder, not something that needs to sync across
 *  devices) so the cadence survives page reloads within the same day rather
 *  than resetting on every visit. */
export function WaterReminder() {
  const [message, setMessage] = useState<string | null>(null)
  const { today } = useDayKey()
  const addWater = usePlannerStore(s => s.addWater)

  useEffect(() => {
    if (typeof window === 'undefined') return

    function due(): boolean {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false // first-ever run seeds below, doesn't nag immediately
      const last = Number(raw)
      return Number.isFinite(last) && Date.now() - last >= INTERVAL_MS
    }

    // Seed on first-ever run so a brand-new user isn't immediately nagged —
    // the first reminder fires 2 hours after their first app open.
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    }

    function check() {
      if (!due()) return
      setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    }

    check() // in case the interval already elapsed while the app was closed
    const id = setInterval(check, CHECK_EVERY_MS)
    return () => clearInterval(id)
  }, [])

  function dismiss() {
    setMessage(null)
  }

  function logAndDismiss() {
    addWater(today, 250)
    setMessage(null)
  }

  return (
    <Modal open={!!message} onClose={dismiss} title="💧 Hydration reminder" variant="vx" maxWidth="max-w-sm">
      <p style={{ color: 'var(--vx-fg-2)', fontSize: 13, marginBottom: 16 }}>{message}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="vx-btn vx-btn-ghost" onClick={dismiss}>Later</button>
        <button className="vx-btn vx-btn-primary" onClick={logAndDismiss}>+250ml, got it</button>
      </div>
    </Modal>
  )
}
