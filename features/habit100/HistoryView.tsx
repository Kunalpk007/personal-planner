'use client'
import { useMemo, useState } from 'react'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { DayLogForm } from './DayLogForm'
import { dayStats } from '@/lib/habit100/scoring'
import { formatDateShort, getPrevDayKey } from '@/lib/engine/cutoff'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/ui/Pagination'

const PAGE_SIZE = 10

/** View-only day list — tapping a LOCKED day opens its full detail (the
 *  same DayLogForm used for input, just read-only; see project.md's
 *  Consistency Tracker design: the catch-up queue is the only place any
 *  day is ever edited, History never is). An unresolved day shows as
 *  pending rather than its (possibly blank) data, since nothing is final
 *  until it locks. */
export function HistoryView({ today }: { today: string }) {
  const meta = useHabit100Store(s => s.meta)
  const days = useHabit100Store(s => s.days)
  const [selected, setSelected] = useState<string | null>(null)

  const dates = useMemo(() => {
    if (!meta) return []
    const out: string[] = []
    let d = today
    while (d >= meta.startDate) {
      out.push(d)
      d = getPrevDayKey(d)
    }
    return out
  }, [meta, today])

  const { page, totalPages, pageItems, hasPrev, hasNext, prevPage, nextPage } = usePagination(dates, PAGE_SIZE)

  if (!meta) return null

  if (selected) {
    const day = days[selected]
    return (
      <div>
        <button onClick={() => setSelected(null)} className="vx-btn vx-btn-ghost text-xs mb-3">← History</button>
        <div className="vx-glass mb-3">
          <div className="text-[14px] font-bold">{formatDateShort(selected)}</div>
          {!day?.locked && <div className="text-[11px] mt-1" style={{ color: 'var(--vx-amber)' }}>⏳ pending — catch up from Home</div>}
        </div>
        {day?.locked && <DayLogForm key={selected} date={selected} readOnly />}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-2">
        {pageItems.map(date => {
          const day = days[date]
          const locked = !!day?.locked
          const { pct } = dayStats(meta, day)
          return (
            <button key={date} onClick={() => setSelected(date)} className="vx-glass vx-glass-tap text-left w-full" style={{ padding: '0.75rem 0.9rem' }}>
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-bold">{formatDateShort(date)}</span>
                {locked ? (
                  <span className="text-[11px] ml-auto font-bold" style={{ color: pct >= meta.disciplinedThresholdPct ? 'var(--color-accent)' : pct > 0 ? 'var(--vx-amber)' : 'var(--red)' }}>
                    {pct}%
                  </span>
                ) : (
                  <span className="text-[11px] ml-auto" style={{ color: 'var(--vx-amber)' }}>⏳ pending</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} hasPrev={hasPrev} hasNext={hasNext} onPrev={prevPage} onNext={nextPage} />
    </div>
  )
}
