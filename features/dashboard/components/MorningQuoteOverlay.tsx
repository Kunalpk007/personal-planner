'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlannerStore } from '@/store'
import { getDailyQuote }   from '@/lib/engine/quotes'
import type { Mood } from '@/store/types'

const MORNING_MOODS: { key: Mood; label: string }[] = [
  { key: 'motivated', label: '⚡ Motivated' },
  { key: 'neutral',   label: '😐 Neutral' },
  { key: 'sick',      label: '🤒 Sick' },
]

export function MorningQuoteOverlay({ today }: { today: string }) {
  const cfg                  = usePlannerStore(s => s.cfg)
  const morningQuoteShown    = usePlannerStore(s => s.morningQuoteShown)
  const markMorningQuoteShown = usePlannerStore(s => s.markMorningQuoteShown)
  const todayMood            = usePlannerStore(s => s.mood[today])
  const setMood              = usePlannerStore(s => s.setMood)
  const lastShowedUpBonus    = usePlannerStore(s => s.lastShowedUpBonus)
  const [visible, setVisible] = useState(false)
  const [pickedMood, setPickedMood] = useState<Mood | ''>('')

  // useOvernightCheck claims the "you showed up" wallet bonus on mount,
  // independently of this overlay — by the time this renders it's usually
  // already set for today (see store/slices/config.slice.ts#claimShowedUpBonus).
  const todaysBonus = lastShowedUpBonus?.date === today ? lastShowedUpBonus : null
  const bonusPct = todaysBonus ? Math.round((todaysBonus.bonus / todaysBonus.minPts) * 100) : 0

  useEffect(() => {
    const hours = new Date().getHours()
    if (cfg.quoteMorning && hours >= 4 && hours < 12 && !morningQuoteShown[today]) {
      setVisible(true)
    }
  }, [today, cfg.quoteMorning, morningQuoteShown])

  function dismiss() {
    if (pickedMood && !todayMood) setMood(today, pickedMood)
    markMorningQuoteShown(today)
    setVisible(false)
  }

  if (!visible) return null

  const quote = getDailyQuote(today, 'morning')

  // Portalled to <body>: this overlay lives inside app/(tabs)/layout.tsx's
  // `page-container` motion.div, which animates `filter` (blur in/out on
  // route change). A non-`none` `filter` on an ancestor creates a new
  // containing block for `position: fixed` descendants (same rule as
  // `transform`), so a non-portalled fixed overlay here gets centered
  // against the full scrollable page instead of the actual viewport —
  // portalling to `document.body` escapes that ancestor entirely.
  return createPortal(
    <div className="vx-modal-backdrop" style={{ position: 'fixed', zIndex: 210, height: '100dvh' }} onClick={dismiss}>
      {/* "First page of the day" — a calm, premium welcome card (illustration
          badge + headline + supporting quote + a single clear CTA), in the
          spirit of a clean onboarding-style screen rather than a dense
          modal. Mood check-in and the showed-up bonus keep their existing
          logic/placement, just restyled to match. */}
      <div className="vx-modal-sheet max-w-[420px] text-center" onClick={e => e.stopPropagation()}>
        <div
          className="mx-auto mb-5 flex items-center justify-center"
          style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-dim)', fontSize: 32 }}
        >
          🌅
        </div>

        <h2 className="text-[22px] font-extrabold tracking-tight mb-2">Good morning</h2>
        <p className="text-[14px] leading-relaxed mb-1" style={{ color: 'var(--vx-fg-2)' }}>&ldquo;{quote.t}&rdquo;</p>
        <p className="text-[12px] mb-6" style={{ color: 'var(--vx-fg-4)' }}>— {quote.a}</p>

        {/* "You showed up" wallet bonus — 5% of the day's (mood-adjusted) min
            points, credited automatically on first open (see project.md
            Decision #8: "Progress % shown = bonus/minPts ratio"). */}
        {todaysBonus && (
          <div className="vx-tile vx-accent-l mb-5 text-left" data-tone="amber">
            <div className="text-[13px] font-semibold" style={{ color: 'var(--vx-amber)' }}>
              🎁 +{todaysBonus.bonus} 🪙 for showing up today
            </div>
            <div className="text-[11px] text-[var(--text3)] mt-0.5">
              Day progress bonus: {bonusPct}% of today&apos;s target, credited to your wallet.
            </div>
          </div>
        )}

        {/* Quick mood check-in for the day */}
        {!todayMood && (
          <div className="mb-6">
            <div className="text-[11px] text-[var(--text3)] mb-2">How are you feeling today?</div>
            <div className="flex gap-2 justify-center flex-wrap">
              {MORNING_MOODS.map(m => (
                <button key={m.key} onClick={() => setPickedMood(m.key)}
                  className={`vx-pill ${pickedMood === m.key ? 'vx-sel' : ''}`}
                  data-tone={m.key === 'motivated' ? 'emerald' : m.key === 'sick' ? 'amber' : 'neutral'}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={dismiss} className="vx-submit-btn">Let&apos;s Go →</button>
      </div>
    </div>,
    document.body
  )
}
