'use client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useHabit100Store } from '@/store/habit100/habit100.store'
import { dayStats, programDayIndex } from '@/lib/habit100/scoring'

/** Day Progress / Track Consistency — split into two tiles side by side, per
 *  explicit request. Left keeps the existing task/point progress (narrowed);
 *  right opens the Consistency Tracker (reads only the already-hydrated
 *  local store — no sync bootstrap here, that only happens once you
 *  actually open /habit100, see useHabit100Bootstrap). */
export function ConsistencyRow({ today, earned, target, done, total }: {
  today: string; earned: number; target: number; done: number; total: number
}) {
  const router = useRouter()
  const meta = useHabit100Store(s => s.meta)
  const day  = useHabit100Store(s => s.days[today])
  const pct  = target > 0 ? Math.round(earned / target * 100) : 0

  const dayIndex = meta ? Math.min(Math.max(programDayIndex(meta.startDate, today), 1), meta.totalDays) : null
  const todayPct = meta ? dayStats(meta, day).pct : 0

  return (
    <div className="grid grid-cols-2 gap-3 mb-3.5">
      <motion.div
        className="vx-glass flex items-center gap-3"
        style={{ padding: '1rem 1.1rem' }}
        initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.21 }}
      >
        <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--vx-border)" strokeWidth="4.5" />
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-accent)" strokeWidth="4.5" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 18} strokeDashoffset={2 * Math.PI * 18 * (1 - Math.min(100, pct) / 100)} />
        </svg>
        <div className="min-w-0">
          <div className="vx-eyebrow">Day progress</div>
          <div className="text-[11.5px] text-[var(--text3)] leading-snug mt-1.5">
            {pct >= 100 ? 'Target hit!' : `${earned}/${target} pts`}<br />{done}/{total} tasks
          </div>
        </div>
      </motion.div>

      <motion.button
        type="button"
        onClick={() => router.push('/habit100')}
        className="vx-glass vx-glass-tap text-left"
        style={{
          padding: '1rem 1.1rem',
          background: 'linear-gradient(145deg, color-mix(in srgb, var(--vx-violet) 14%, transparent), color-mix(in srgb, var(--vx-cyan) 6%, transparent))',
          borderColor: 'color-mix(in srgb, var(--vx-violet) 28%, transparent)',
        }}
        initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.27 }}
      >
        <div className="vx-eyebrow" style={{ color: 'var(--vx-violet)' }}>🧩 Track Consistency</div>
        {meta ? (
          <>
            <div className="text-[20px] font-extrabold mt-2" style={{ color: 'var(--vx-violet)' }}>
              Day {dayIndex}<span className="text-[12px] font-semibold" style={{ color: 'var(--vx-fg-4)' }}> / {meta.totalDays}</span>
            </div>
            <div className="text-[10.5px] mt-1" style={{ color: 'var(--text3)' }}>{todayPct}% logged today</div>
          </>
        ) : (
          <div className="text-[12px] mt-2" style={{ color: 'var(--text3)' }}>Set up your consistency run →</div>
        )}
      </motion.button>
    </div>
  )
}
