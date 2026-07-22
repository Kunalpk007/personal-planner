'use client'
import { useMemo, useState } from 'react'
import { usePlannerStore } from '@/store'
import { useDayKey } from '@/hooks/useDayKey'
import { buildHeatmap, type HeatmapDay } from '@/lib/engine/historyChart'

function colorFor(pct: number | null): string {
  if (pct == null) return 'var(--bg3)'
  if (pct >= 100) return 'var(--green-mid)'
  if (pct >= 70)  return 'var(--green)'
  if (pct >= 40)  return 'var(--amber)'
  if (pct > 0)    return 'var(--red)'
  return 'var(--border2)'
}

export function CalendarHeatmap() {
  const history = usePlannerStore(s => s.history)
  const { today } = useDayKey()
  const days = useMemo(() => buildHeatmap(history, today), [history, today])
  const [hovered, setHovered] = useState<HeatmapDay | null>(null)

  if (days.length === 0) {
    return <div className="text-[13px] text-[var(--text3)] py-6 text-center">No history yet — this fills in as you go.</div>
  }

  // Pad to start on a Sunday so weeks line up into 7-row columns.
  const first = new Date(`${days[0].date}T12:00:00`)
  const padStart = first.getDay()
  const padded: Array<HeatmapDay | null> = [...Array(padStart).fill(null), ...days]
  const weekCount = Math.ceil(padded.length / 7)
  const cell = 11

  return (
    <div>
      <div className="text-[12px] text-[var(--text2)] mb-2">
        {hovered ? `${hovered.date}: ${hovered.pct == null ? 'no entry' : `${hovered.pct}% complete`}` : 'Hover a day for details.'}
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${weekCount * (cell + 2)} ${7 * (cell + 2)}`}
          className="h-[90px]"
          style={{ width: weekCount * (cell + 2) * 1.4 }}
        >
          {padded.map((day, i) => {
            const week = Math.floor(i / 7)
            const row  = i % 7
            if (!day) return null
            return (
              <rect
                key={day.date}
                x={week * (cell + 2)}
                y={row * (cell + 2)}
                width={cell}
                height={cell}
                rx={2}
                fill={colorFor(day.pct)}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(h => (h?.date === day.date ? null : h))}
                className="cursor-pointer"
              />
            )
          })}
        </svg>
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-[var(--text3)]">
        Less
        {[null, 0, 40, 70, 100].map((v, i) => (
          <span key={i} className="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ background: colorFor(v) }} />
        ))}
        More
      </div>
    </div>
  )
}
