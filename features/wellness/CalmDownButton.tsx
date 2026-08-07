'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getRandomQuote } from '@/constants/motivationalQuotes'

// Simple, generic breathing pace suitable for a general audience — no
// breath-holding (holding can feel uncomfortable or dizzying to some
// people), just an extended exhale, which is a widely-used gentle calming
// pattern. Not a clinical/personalized program — just enough structure to
// give someone a rhythm to follow.
const INHALE_S  = 4
const EXHALE_S  = 6
const SESSION_S = 5 * 60 // 5 minutes total

type Phase = 'in' | 'out'

/** Fixed floating "Calm down" button — mounted on the Dashboard only (per
 *  explicit request; it used to be mounted globally in the app shell).
 *  `position: fixed` so it never moves when the page scrolls. Opens a
 *  full-screen guided breathing exercise: a circle that visually expands on
 *  the inhale and contracts on the exhale, for 5 minutes, with a rotating
 *  motivational quote and an explicit Cancel button — closing early is
 *  always available since this is a wellbeing tool, not something that
 *  should feel like one more task to finish. */
export function CalmDownButton() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // The button itself must be portalled to document.body too, not just the
  // overlay — otherwise it renders inside `page-container`, whose route-
  // transition animation puts a non-`none` `filter` on an ancestor. That
  // establishes a new containing block for any `position: fixed`
  // descendant (same rule as `transform`/`will-change`/`backdrop-filter`),
  // so the button would drift with page scroll instead of staying pinned
  // to the real viewport. See the matching note on `TaskActionFab`.
  // Plain stacked text ("calm" / "down!", two lines, centered) instead of an
  // emoji icon — per explicit feedback that the wind emoji read as an
  // unclear symbol rather than a recognizable label.
  const button = (
    <button
      onClick={() => setOpen(true)}
      className="vx-calm-fab"
      title="Take a moment to breathe"
      aria-label="Open breathing exercise"
    >
      <span className="vx-calm-fab-label">Calm</span>
      <span className="vx-calm-fab-label">Down!</span>
    </button>
  )

  return (
    <>
      {mounted ? createPortal(button, document.body) : null}
      <BreathingOverlay open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function BreathingOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [phase, setPhase]     = useState<Phase>('in')
  const [remaining, setRemaining] = useState(SESSION_S)
  // Picked fresh each time the overlay opens (not on every render) so it
  // stays stable for the whole session instead of flickering between
  // quotes as the phase/remaining state ticks.
  const [quote, setQuote] = useState('')
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (open) setQuote(getRandomQuote())
  }, [open])

  // Drive the in/out phase cycle for as long as the overlay is open.
  useEffect(() => {
    if (!open) return
    setPhase('in')
    setRemaining(SESSION_S)

    function cycle(next: Phase) {
      setPhase(next)
      const dur = next === 'in' ? INHALE_S : EXHALE_S
      phaseTimerRef.current = setTimeout(() => cycle(next === 'in' ? 'out' : 'in'), dur * 1000)
    }
    phaseTimerRef.current = setTimeout(() => cycle('out'), INHALE_S * 1000)

    return () => { if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current) }
  }, [open])

  // Overall 5-minute countdown — auto-closes when it reaches zero, same as
  // a natural end of the session (no reward/gate tied to finishing).
  useEffect(() => {
    if (!open) return
    if (remaining <= 0) { onClose(); return }
    const id = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(id)
  }, [open, remaining, onClose])

  if (!mounted || !open) return null

  const mm = Math.floor(remaining / 60)
  const ss = remaining % 60

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="vx-calm-overlay"
          style={{ height: '100dvh' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <button onClick={onClose} className="vx-calm-close" aria-label="Close breathing exercise">×</button>

          <div className="vx-calm-timer">{mm}:{String(ss).padStart(2, '0')}</div>

          <p className="vx-calm-quote">&ldquo;{quote}&rdquo;</p>

          <div className="vx-calm-circle-wrap">
            <motion.div
              className="vx-calm-circle"
              animate={{ scale: phase === 'in' ? 1.35 : 0.72 }}
              transition={{ duration: phase === 'in' ? INHALE_S : EXHALE_S, ease: 'easeInOut' }}
            />
            <div className="vx-calm-circle-label">
              {phase === 'in' ? 'Breathe in…' : 'Breathe out…'}
            </div>
          </div>

          <p className="vx-calm-hint">
            Follow the circle — in as it grows, out as it shrinks.
          </p>

          <button onClick={onClose} className="vx-btn vx-btn-ghost vx-calm-cancel">
            Cancel
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
