'use client'
import { motion } from 'framer-motion'
import { usePlannerStore } from '@/store'

/** Surfaces the priorities picked the night before (see EndOfDayRitual's
 *  "Tomorrow's Top 3" step) on the Dashboard for the day they apply to.
 *  Renders nothing if no pick exists for today — this is what was missing
 *  before: the pick was being captured but never shown anywhere. */
export function TomorrowTop3Card({ today }: { today: string }) {
  const top3 = usePlannerStore(s => s.tomorrowTop3[today])
  if (!top3 || top3.items.length === 0) return null

  return (
    <motion.div
      className="vx-glass"
      style={{ background: 'var(--color-accent-dim)', borderColor: 'color-mix(in srgb, var(--vx-cyan) 30%, transparent)' }}
      initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.07 }}
    >
      <div className="vx-eyebrow mb-2">📌 Today&apos;s Top 3 — picked last night</div>
      <div className="flex flex-col gap-1.5">
        {top3.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-[13.5px]">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{ background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
              {i + 1}
            </span>
            <span className="min-w-0 break-words">{item}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
