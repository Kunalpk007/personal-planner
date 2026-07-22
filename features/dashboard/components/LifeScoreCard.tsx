'use client'
import { useMemo } from 'react'
import { usePlannerStore } from '@/store'
import { computeLifeScore } from '@/lib/engine/goals'
import { FLAGS } from '@/constants/feature-flags'

export function LifeScoreCard() {
  const zones   = usePlannerStore(s => s.zones)
  const history = usePlannerStore(s => s.history)

  const { total, byZone } = useMemo(() => computeLifeScore(zones, history, 30), [zones, history])

  if (!FLAGS.LIFE_SCORE) return null

  return (
    <div className="card mb-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-[15px]">🧭</span>
        <span className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide">Life Score</span>
        <span className="text-[11px] text-[var(--text3)] ml-auto">last 30 days</span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-[28px] font-semibold">{total}</div>
        <div className="text-[11px] text-[var(--text3)] leading-snug">
          Weighted consistency across zones.<br />Set weights in Settings → Zones.
        </div>
      </div>
      {zones.length > 0 && (
        <div className="space-y-2">
          {zones.map(z => (
            <div key={z.id} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z.color }} />
              <span className="text-[12px] flex-1 truncate">{z.name}</span>
              <div className="w-20 h-1.5 rounded-full bg-[var(--bg3)] overflow-hidden flex-shrink-0">
                <div className="h-full rounded-full" style={{ width: `${byZone[z.id] ?? 0}%`, background: z.color }} />
              </div>
              <span className="text-[11px] text-[var(--text2)] w-8 text-right flex-shrink-0">{byZone[z.id] ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
