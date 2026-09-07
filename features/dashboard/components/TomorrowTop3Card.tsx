'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePlannerStore } from '@/store'

const CANCEL_REASONS = ['Changed my mind', 'No longer relevant', 'Too ambitious for now', 'Ran out of time', 'Other']

/** Surfaces the priorities picked the night before (see EndOfDayRitual's
 *  "Tomorrow's Top 3" step) on the Dashboard for the day they apply to.
 *  Renders nothing if no pick exists for today — this is what was missing
 *  before: the pick was being captured but never shown anywhere. Each item
 *  links to the real Task it created, so it can be cancelled here directly —
 *  a cancelled item won't come back tomorrow since cancelTask excludes it
 *  from carry-forward. */
export function TomorrowTop3Card({ today }: { today: string }) {
  const top3 = usePlannerStore(s => s.tomorrowTop3[today])
  const tasks = usePlannerStore(s => s.tasks)
  const cancelTask = usePlannerStore(s => s.cancelTask)
  const [cancelId, setCancelId] = useState<string | null>(null)

  if (!top3 || top3.items.length === 0) return null

  const visible = top3.items.filter(item => {
    const t = tasks.find(x => x.id === item.taskId)
    return !t || !t.cancelledAt
  })
  if (visible.length === 0) return null

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
        {visible.map((item, i) => {
          const t = tasks.find(x => x.id === item.taskId)
          return (
            <div key={item.taskId} className="flex items-center gap-2 text-[13.5px]">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{ background: 'var(--vx-surface-tint)', border: '1px solid var(--vx-border)' }}>
                {i + 1}
              </span>
              <span className={`min-w-0 break-words flex-1 ${t?.done ? 'line-through opacity-60' : ''}`}>{item.title}</span>
              {t && !t.done && (
                <button onClick={() => setCancelId(item.taskId)} className="text-[11px] flex-shrink-0" style={{ color: 'var(--vx-fg-4)' }}>✕</button>
              )}
            </div>
          )
        })}
      </div>

      {cancelId && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--vx-border)' }}>
          <div className="text-[11.5px] mb-1.5" style={{ color: 'var(--vx-fg-3)' }}>Cancel this task — why?</div>
          <div className="flex flex-wrap gap-1.5">
            {CANCEL_REASONS.map(r => (
              <button key={r} className="vx-chip" style={{ cursor: 'pointer' }}
                onClick={() => { cancelTask(cancelId, r); setCancelId(null) }}>
                {r}
              </button>
            ))}
            <button className="vx-chip" style={{ cursor: 'pointer' }} onClick={() => setCancelId(null)}>Back</button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
