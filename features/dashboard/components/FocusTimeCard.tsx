'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlannerStore } from '@/store'
import { Modal } from '@/ui/Modal'
import { showToast } from '@/ui/Toast'
import { fireConfetti } from '@/ui/Confetti'
import { GradientRing } from '@/ui/GradientRing'

const MINUTE_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 5) // 5..120, step 5
const WHEEL_ITEM_H = 36

/** iOS-alarm-style scrollable minute picker — native CSS scroll-snap, no
 *  dependency. The centered item (tracked via scroll position) is the value. */
function MinuteWheel({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollTo({ top: MINUTE_OPTIONS.indexOf(value) * WHEEL_ITEM_H })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleScroll() {
    const el = ref.current
    if (!el) return
    const idx = Math.min(MINUTE_OPTIONS.length - 1, Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM_H)))
    const v = MINUTE_OPTIONS[idx]
    if (v !== value) onChange(v)
  }

  return (
    <div className="vx-minute-wheel" ref={ref} onScroll={handleScroll}>
      <div style={{ height: WHEEL_ITEM_H }} />
      {MINUTE_OPTIONS.map(m => (
        <div key={m} className="vx-minute-wheel-item" data-active={m === value} style={{ height: WHEEL_ITEM_H }}>
          {m} min
        </div>
      ))}
      <div style={{ height: WHEEL_ITEM_H }} />
      <div className="vx-minute-wheel-highlight" />
    </div>
  )
}

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Dashboard Focus Time. Tapping the tile opens a duration picker (an
 *  iOS-alarm-style scrollable minute wheel) — no reward preview on the tile
 *  itself, per explicit request (the reward still applies on completion,
 *  it's just not advertised up front). Starting a session runs in a
 *  dedicated full-screen overlay (not inline on the tile) that blocks
 *  interaction with the rest of the app for the duration — the closest a web
 *  app can get to an OS-level focus lock. Cancelling early forfeits the
 *  reward — otherwise there'd be nothing stopping someone from starting and
 *  immediately cancelling repeatedly to farm points. */
export function FocusTimeCard({ today }: { today: string }) {
  const completeFocusSession = usePlannerStore(s => s.completeFocusSession)
  const focusSessions = usePlannerStore(s => s.focusSessions)

  const [pickerOpen, setPickerOpen]         = useState(false)
  const [pickedMinutes, setPickedMinutes]   = useState(25)
  const [activeMinutes, setActiveMinutes]   = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft]       = useState(0)

  useEffect(() => {
    if (activeMinutes === null) return
    if (secondsLeft <= 0) {
      const reward = completeFocusSession(today, activeMinutes)
      fireConfetti()
      showToast(`🧠 Focus session complete! +${reward.pts} 🪙 · +${reward.xp} XP`)
      setActiveMinutes(null)
      return
    }
    const id = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [activeMinutes, secondsLeft, completeFocusSession, today])

  function confirmStart() {
    setSecondsLeft(pickedMinutes * 60)
    setActiveMinutes(pickedMinutes)
    setPickerOpen(false)
  }

  function cancelRun() {
    setActiveMinutes(null)
    showToast('Focus session cancelled — no reward for an interrupted session.')
  }

  const todayMinutes = focusSessions.filter(f => f.date === today).reduce((sum, f) => sum + f.minutes, 0)

  return (
    <>
      <motion.div
        className="vx-glass"
        initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="vx-eyebrow">🧠 Focus Time</div>
          {todayMinutes > 0 && (
            <span className="text-[11px] text-[var(--text3)]">{todayMinutes} min focused today</span>
          )}
        </div>

        <p className="text-[11.5px] text-[var(--text3)] mb-3 leading-relaxed">
          Start an uninterrupted focus session to earn bonus reward points and XP.
        </p>
        <button onClick={() => setPickerOpen(true)} className="vx-pill vx-tinted w-full justify-center py-2.5" data-tone="cyan">
          <span className="font-semibold">🕐 Set Focus Time</span>
        </button>
      </motion.div>

      {/* Duration picker doubles as the confirm step — a focus session locks
          the screen until it ends, so picking a length is the deliberate step. */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Start focus session?" variant="vx" maxWidth="max-w-sm">
        <MinuteWheel value={pickedMinutes} onChange={setPickedMinutes} />
        <p style={{ color: 'var(--vx-fg-2)', fontSize: 12.5, margin: '14px 0 16px', textAlign: 'center' }}>
          Takes over the screen until it ends — you can cancel any time, but an interrupted session earns no reward.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="vx-btn vx-btn-ghost" onClick={() => setPickerOpen(false)}>Cancel</button>
          <button className="vx-btn vx-btn-primary" onClick={confirmStart}>Start Focus</button>
        </div>
      </Modal>

      <FocusRunOverlay activeMinutes={activeMinutes} secondsLeft={secondsLeft} onCancel={cancelRun} />
    </>
  )
}

function FocusRunOverlay({ activeMinutes, secondsLeft, onCancel }: {
  activeMinutes: number | null; secondsLeft: number; onCancel: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || activeMinutes === null) return null

  const pct = Math.round((1 - secondsLeft / (activeMinutes * 60)) * 100)

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="vx-focus-overlay"
        style={{ height: '100dvh' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="vx-focus-eyebrow">🧠 Focusing — {activeMinutes} min session</div>
        <div className="vx-focus-ring-wrap">
          <GradientRing pct={pct} size={260} stroke={14} label={fmt(secondsLeft)} />
        </div>
        <p className="vx-focus-hint">Stay on task. Reward credits when the timer hits zero.</p>
        <button onClick={onCancel} className="vx-btn vx-btn-ghost vx-focus-cancel">Cancel session</button>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
