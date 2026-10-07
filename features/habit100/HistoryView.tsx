'use client'
import { useMemo, useState } from 'react'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { DayLogForm } from './DayLogForm'
import { dayStats } from '@/lib/habit100/scoring'
import { formatDateShort, getPrevDayKey } from '@/lib/engine/cutoff'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/ui/Pagination'
import type { Habit100Day, Habit100Meta } from '@/store/habit100/types'

const PAGE_SIZE = 10

type Row =
  | { kind: 'day'; date: string; meta: Habit100Meta; day: Habit100Day | undefined; archived: boolean }
  | { kind: 'divider'; key: string; label: string }

/** View-only day list — tapping a LOCKED day in the CURRENT run opens its
 *  full detail (the same DayLogForm used for input, just read-only; see
 *  project.md's Consistency Tracker design: the catch-up queue is the only
 *  place any day is ever edited, History never is). An unresolved day
 *  shows as pending rather than its (possibly blank) data, since nothing
 *  is final until it locks.
 *
 *  Archived runs (from a Settings reset) are folded into the same
 *  newest-first list behind a divider, each scored against ITS OWN
 *  meta/habits (a reset can redefine the habit list, so an old day's % has
 *  to be computed against what it actually counted at the time) — but kept
 *  summary-only (no tap-to-expand), since DayLogForm is wired to the live
 *  store's current meta, not an arbitrary historical one. */
export function HistoryView({ today }: { today: string }) {
  const meta = useHabit100Store(s => s.meta)
  const days = useHabit100Store(s => s.days)
  const archivedRuns = useHabit100Store(s => s.archivedRuns)
  const [selected, setSelected] = useState<string | null>(null)

  const rows = useMemo(() => {
    const out: Row[] = []
    if (meta) {
      let d = today
      while (d >= meta.startDate) {
        out.push({ kind: 'day', date: d, meta, day: days[d], archived: false })
        d = getPrevDayKey(d)
      }
    }
    const runsNewestFirst = [...archivedRuns].sort((a, b) => b.meta.startDate.localeCompare(a.meta.startDate))
    for (const run of runsNewestFirst) {
      if (run.days.length === 0) continue
      const sorted = [...run.days].sort((a, b) => b.date.localeCompare(a.date))
      out.push({ kind: 'divider', key: `reset-${run.meta.startDate}`, label: `↺ Reset — previous run (${formatDateShort(run.meta.startDate)} – ${formatDateShort(sorted[0].date)})` })
      for (const day of sorted) out.push({ kind: 'day', date: day.date, meta: run.meta, day, archived: true })
    }
    return out
  }, [meta, days, archivedRuns, today])

  const { page, totalPages, pageItems, hasPrev, hasNext, prevPage, nextPage } = usePagination(rows, PAGE_SIZE)

  if (!meta && archivedRuns.length === 0) return null

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
        {pageItems.map(row => {
          if (row.kind === 'divider') {
            return <div key={row.key} className="text-[10.5px] text-center py-1.5" style={{ color: 'var(--vx-fg-4)' }}>{row.label}</div>
          }
          const { date, meta: rowMeta, day, archived } = row
          const locked = !!day?.locked
          const { pct } = dayStats(rowMeta, day)
          const pctColor = pct >= rowMeta.disciplinedThresholdPct ? 'var(--color-accent)' : pct > 0 ? 'var(--vx-amber)' : 'var(--red)'
          const content = (
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-bold">{formatDateShort(date)}</span>
              {archived || locked ? (
                <span className="text-[11px] ml-auto font-bold" style={{ color: pctColor }}>{pct}%</span>
              ) : (
                <span className="text-[11px] ml-auto" style={{ color: 'var(--vx-amber)' }}>⏳ pending</span>
              )}
            </div>
          )
          return archived ? (
            <div key={`a-${date}`} className="vx-glass text-left w-full" style={{ padding: '0.75rem 0.9rem', opacity: 0.75 }}>{content}</div>
          ) : (
            <button key={date} onClick={() => setSelected(date)} className="vx-glass vx-glass-tap text-left w-full" style={{ padding: '0.75rem 0.9rem' }}>{content}</button>
          )
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} hasPrev={hasPrev} hasNext={hasNext} onPrev={prevPage} onNext={nextPage} />
    </div>
  )
}
