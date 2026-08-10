'use client'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { usePlannerStore } from '@/store'
import { Modal } from '@/ui/Modal'
import { computeLifeScore } from '@/lib/engine/goals'
import { FLAGS } from '@/constants/feature-flags'
import { AnimatedNumber } from '@/ui/AnimatedNumber'

const LIFE_SCORE_PERIODS = [7, 15, 30, 60, 90] as const

/** Was a permanently-rendered card on the Dashboard, sitting directly below
 *  the StatGrid tile that already showed the same 7-day Life Score number —
 *  two copies of the same metric on one screen. Folded into a modal opened
 *  by tapping that tile instead, matching how the streak orb and Rank
 *  Progress bar already work here: a compact number on the surface, full
 *  detail (period picker + per-zone breakdown) one tap away rather than
 *  always taking up scroll space. See StatGrid.tsx's `onLifeScoreClick`. */
export function LifeScoreModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const zones   = usePlannerStore(s => s.zones)
  const history = usePlannerStore(s => s.history)
  const [periodDays, setPeriodDays] = useState<number>(30)

  const { total, byZone } = useMemo(() => computeLifeScore(zones, history, periodDays), [zones, history, periodDays])

  if (!FLAGS.LIFE_SCORE) return null

  return (
    <Modal open={open} onClose={onClose} title="🧭 Life Score" variant="vx">
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        <div className="vx-seg ml-auto">
          {LIFE_SCORE_PERIODS.map(d => (
            <button
              key={d}
              onClick={() => setPeriodDays(d)}
              className={`relative ${periodDays === d ? 'vx-active' : ''}`}
            >
              {periodDays === d && (
                <motion.div
                  layoutId="vx-lifescore-period-indicator"
                  className="vx-seg-indicator"
                  style={{ inset: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10">{d}D</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 mb-3 mt-2">
        <AnimatedNumber value={total} className="text-[34px] font-extrabold leading-none" />
        <div className="text-[11px] text-[var(--text3)] leading-snug">
          Weighted consistency across zones.<br />Set weights in Settings → Zones.
        </div>
      </div>
      {zones.length > 0 && (
        <div className="space-y-2.5">
          {zones.map((z, i) => (
            <div key={z.id} className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z.color, boxShadow: `0 0 8px ${z.color}` }} />
              <span className="text-[12px] flex-1 truncate text-[var(--text2)]">{z.name}</span>
              <div className="w-20 h-1.5 vx-zone-track flex-shrink-0">
                <motion.div
                  className="vx-zone-fill"
                  style={{ background: z.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${byZone[z.id] ?? 0}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.05 }}
                />
              </div>
              <span className="text-[11px] text-[var(--text3)] w-8 text-right flex-shrink-0">{byZone[z.id] ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
