'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const INTERACTIVE_SELECTOR = 'button, a, [role="button"], input[type="submit"], input[type="button"], select'

/**
 * Shows a small spinner overlay for any tap/click on an interactive element
 * that hasn't visibly resolved within ~100ms. Perceived latency under 100ms
 * reads as instant; above it, users can't tell whether their tap registered
 * without some feedback. This is a coarse, app-wide proxy (not tied to any
 * specific action's completion) so it auto-hides after a short window.
 */
export function ClickFeedback() {
  const [visible, setVisible] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    // A route change is itself proof the tap registered — clear immediately.
    if (showTimer.current) clearTimeout(showTimer.current)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setVisible(false)
  }, [pathname])

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target
      if (!(target instanceof Element) || !target.closest(INTERACTIVE_SELECTOR)) return
      if (showTimer.current) clearTimeout(showTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      showTimer.current = setTimeout(() => setVisible(true), 100)
      // Most local state updates/re-renders settle within this window; route
      // changes clear it sooner via the pathname effect above.
      hideTimer.current = setTimeout(() => setVisible(false), 1000)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      if (showTimer.current) clearTimeout(showTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  if (!visible) return null
  return (
    <div className="click-loader-overlay" role="status" aria-label="Loading">
      <div className="click-loader-spinner" />
    </div>
  )
}
