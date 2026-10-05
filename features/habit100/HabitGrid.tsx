'use client'
import { useMemo } from 'react'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { cellStatus, programDayIndex } from '@/lib/habit100/scoring'
import { getNextDayKey } from '@/lib/engine/cutoff'

/** The 100-cell grid — a single wrapping CSS grid (`.habit100-grid`,
 *  grid-template-columns: repeat(auto-fill, minmax(32px,1fr))) that
 *  naturally reflows into however many columns fit the viewport, which is
 *  what makes it "vertical scroll only" on mobile for free — no separate
 *  mobile-specific horizontal-scroll-strip code needed, just more rows on a
 *  narrow screen. Only renders up to today's day — day 47 doesn't exist in
 *  the DOM until you're actually on day 47, not pre-rendered as an empty
 *  future cell (per explicit request). */
export function HabitGrid({ today }: { today: string }) {
  const meta = useHabit100Store(s => s.meta)
  const days = useHabit100Store(s => s.days)

  const cells = useMemo(() => {
    if (!meta) return []
    const todayIndex = Math.min(programDayIndex(meta.startDate, today), meta.totalDays)
    const out: Array<{ n: number; date: string; status: ReturnType<typeof cellStatus> }> = []
    let d = meta.startDate
    for (let n = 1; n <= todayIndex; n++) {
      out.push({ n, date: d, status: cellStatus(meta, days[d], d, today) })
      d = getNextDayKey(d)
    }
    return out
  }, [meta, days, today])

  if (!meta) return null

  return (
    <div>
      <div className="habit100-grid">
        {cells.map(c => (
          <div key={c.date} className="habit100-cell" data-status={c.status} title={`Day ${c.n} — ${c.date}`}>
            {c.n}
          </div>
        ))}
      </div>
      <div className="flex gap-3 flex-wrap mt-2.5 text-[9.5px]" style={{ color: 'var(--vx-fg-4)' }}>
        <span>● disciplined</span><span>● partial</span><span>● missed</span><span>○ today</span>
      </div>
    </div>
  )
}
