'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlannerStore } from '@/store'
import { showToast } from '@/ui/Toast'

/** Morning fallback for EndOfDayRitual's "Tomorrow's Top 3" step — if a
 *  day's picks never got made the night before (skipped, or the day wasn't
 *  submitted at all), this gives one more chance the next morning to
 *  quick-create up to 3 tasks for TODAY, same skippable pattern. Reuses
 *  `tomorrowTop3[today]` as the "already handled" signal, so a night-before
 *  pick (which by morning is keyed under today's date) suppresses this
 *  automatically — no separate coordination needed between the two flows. */
export function MorningTop3Prompt({ today }: { today: string }) {
  const cfg                  = usePlannerStore(s => s.cfg)
  const zones                = usePlannerStore(s => s.zones)
  const addTask               = usePlannerStore(s => s.addTask)
  const setTomorrowTop3       = usePlannerStore(s => s.setTomorrowTop3)
  const existingTop3          = usePlannerStore(s => s.tomorrowTop3[today])
  const morningTop3Shown      = usePlannerStore(s => s.morningTop3Shown)
  const markMorningTop3Shown  = usePlannerStore(s => s.markMorningTop3Shown)
  const morningQuoteShown     = usePlannerStore(s => s.morningQuoteShown)

  const [visible, setVisible] = useState(false)
  const [items, setItems] = useState<[string, string, string]>(['', '', ''])

  useEffect(() => {
    const hours = new Date().getHours()
    // Same 4am–noon window as MorningQuoteOverlay — wait for that one to
    // clear first (if it's due to show) so the two don't stack.
    const quoteMayBeUp = cfg.quoteMorning && !morningQuoteShown[today]
    if (hours >= 4 && hours < 12 && !existingTop3 && !morningTop3Shown[today] && !quoteMayBeUp) {
      setVisible(true)
    }
  }, [today, cfg.quoteMorning, morningQuoteShown, existingTop3, morningTop3Shown])

  function finish(skip: boolean) {
    if (!skip) {
      const filled = items.map(x => x.trim()).filter(x => x.length > 0)
      if (filled.length > 0) {
        const zoneId = zones[0]?.id ?? ''
        for (const title of filled) {
          addTask({ title, note: '', zone: zoneId, priority: 'med', slot: '', deadline: null, date: today, level: '', isSpecial: false, specialPts: 0 })
        }
        setTomorrowTop3(today, filled)
        showToast('Top 3 tasks added ✓')
      }
    }
    markMorningTop3Shown(today)
    setVisible(false)
  }

  if (!visible) return null

  return createPortal(
    <div className="vx-modal-backdrop" style={{ position: 'fixed', zIndex: 205, height: '100dvh' }} onClick={() => finish(true)}>
      <div className="vx-modal-sheet max-w-[380px]" onClick={e => e.stopPropagation()}>
        <div className="vx-eyebrow mb-1.5">📌 Quick Top 3</div>
        <h2 className="text-[19px] font-extrabold tracking-tight mb-1.5">What matters most today?</h2>
        <p className="text-[12px] text-[var(--vx-fg-3)] mb-3.5">
          Add up to 3 quick tasks for today — skip any time.
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {[0, 1, 2].map(i => (
            <input
              key={i}
              className="vx-field"
              placeholder={`Priority ${i + 1}${i === 0 ? '' : ' (optional)'}`}
              value={items[i]}
              maxLength={80}
              onChange={e => setItems(prev => { const next = [...prev] as [string, string, string]; next[i] = e.target.value; return next })}
            />
          ))}
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => finish(true)} className="vx-btn vx-btn-ghost" style={{ flex: 1, padding: '0.7rem' }}>Skip</button>
          <button onClick={() => finish(false)} className="vx-btn vx-btn-primary" style={{ flex: 1, padding: '0.7rem' }}>Add tasks</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
