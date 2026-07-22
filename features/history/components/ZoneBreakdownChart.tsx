'use client'
import { useMemo } from 'react'
import { usePlannerStore } from '@/store'
import { buildZoneBreakdown } from '@/lib/engine/historyChart'

const FALLBACK_COLOR = '#888888'

export function ZoneBreakdownChart() {
  const history = usePlannerStore(s => s.history)
  const zones   = usePlannerStore(s => s.zones)
  const weeks   = useMemo(() => buildZoneBreakdown(history), [history])

  const zoneMeta = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>()
    for (const z of zones) map.set(z.id, { name: z.name, color: z.color })
    return map
  }, [zones])

  if (weeks.length === 0) {
    return <div className="text-[13px] text-[var(--text3)] py-6 text-center">No completed tasks yet to break down by zone.</div>
  }

  const recentWeeks = weeks.slice(-12)
  const zoneIds = [...new Set(recentWeeks.flatMap(w => Object.keys(w.zones)))]
  const maxCount = Math.max(...recentWeeks.map(w => Object.values(w.zones).reduce((s, v) => s + v, 0)), 1)

  return (
    <div>
      <div className="text-[12px] text-[var(--text2)] mb-2">Completed tasks per zone, last {recentWeeks.length} weeks — watch for a zone thinning out.</div>
      <div className="flex items-end gap-1.5 h-[160px]">
        {recentWeeks.map(w => {
          const total = Object.values(w.zones).reduce((s, v) => s + v, 0)
          const heightPx = Math.max(4, (total / maxCount) * 150)
          return (
            <div key={w.weekStart} className="flex-1 flex flex-col justify-end items-center gap-0.5" title={w.weekStart}>
              <div className="w-full rounded-t-[4px] overflow-hidden flex flex-col-reverse" style={{ height: heightPx }}>
                {zoneIds.map(zid => {
                  const count = w.zones[zid] ?? 0
                  if (count === 0) return null
                  const meta = zoneMeta.get(zid) ?? { name: zid, color: FALLBACK_COLOR }
                  return (
                    <div
                      key={zid}
                      style={{ height: `${(count / total) * 100}%`, background: meta.color }}
                      title={`${meta.name}: ${count}`}
                    />
                  )
                })}
              </div>
              <div className="text-[8px] text-[var(--text3)] rotate-45 origin-top-left whitespace-nowrap mt-2">
                {w.weekStart.slice(5)}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2.5 mt-6">
        {zoneIds.map(zid => {
          const meta = zoneMeta.get(zid) ?? { name: zid, color: FALLBACK_COLOR }
          return (
            <div key={zid} className="flex items-center gap-1 text-[11px] text-[var(--text3)]">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: meta.color }} />
              {meta.name}
            </div>
          )
        })}
      </div>
    </div>
  )
}
