'use client'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { dayStats } from '@/lib/habit100/scoring'
import { getPrevDayKey } from '@/lib/engine/cutoff'

const WINDOW_DAYS = 14

/** Compact sparkline preview, tap-to-expand into the tracker's full trend
 *  charts on the Progress page — same "compact + tap for detail" pattern as
 *  the Life Score / Streak tiles. Renders nothing until a tracker exists. */
export function ConsistencyTrendPreview({ today }: { today: string }) {
  const router = useRouter()
  const meta = useHabit100Store(s => s.meta)
  const days = useHabit100Store(s => s.days)

  const points = useMemo(() => {
    if (!meta) return []
    const out: number[] = []
    let d = today
    for (let i = 0; i < WINDOW_DAYS; i++) {
      if (d < meta.startDate) break
      out.unshift(dayStats(meta, days[d]).pct)
      d = getPrevDayKey(d)
    }
    return out
  }, [meta, days, today])

  if (!meta || points.length < 2) return null

  const w = 400, h = 56
  const step = w / (points.length - 1)
  const coords = points.map((p, i) => [i * step, h - (p / 100) * (h - 6) - 3] as const)
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `${line} ${w},${h} 0,${h}`

  return (
    <motion.button
      type="button"
      onClick={() => router.push('/habit100/progress')}
      className="vx-glass vx-glass-tap text-left w-full mb-3.5"
      style={{ padding: '1rem 1.1rem' }}
      initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.33 }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="vx-eyebrow">📈 Consistency Trend</div>
        <span className="text-[10.5px]" style={{ color: 'var(--vx-fg-4)' }}>{points.length} days · tap for detail</span>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline points={area} fill="color-mix(in srgb, var(--color-accent) 14%, transparent)" stroke="none" />
        <polyline points={line} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </motion.button>
  )
}
