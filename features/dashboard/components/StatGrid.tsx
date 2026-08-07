'use client'
import { useMemo }                from 'react'
import { motion }                 from 'framer-motion'
import { usePlannerStore }        from '@/store'
import { computeLifeScore } from '@/lib/engine/goals'
import { AnimatedNumber } from '@/ui/AnimatedNumber'

interface StatCard {
  label: string
  val: number
  sub: string
  tone: string
  decimals?: number
  fire?: boolean
  complete?: boolean
}

/** "Points today" duplicated the Day-progress card just above it (same
 *  points, same target) and "Done today" duplicated the task count that now
 *  also lives in that card's text — both replaced per explicit feedback
 *  that they had no distinct purpose. "Points today" → a 7-day Life Score
 *  snapshot (nothing else on the Dashboard surfaces it at a glance without
 *  opening the Life Score card's own period picker); "Done today" → a
 *  Water Intake tile, mirroring the same litres-of-target framing as the
 *  bigger Water Drank card, with its own small celebration flourish once
 *  the day's target is met. */
export function StatGrid({ today, onStreakClick }: { today: string; onStreakClick?: () => void }) {
  const wallet  = usePlannerStore(s => s.rewardWallet)
  const streak  = usePlannerStore(s => s.streak)
  const zones   = usePlannerStore(s => s.zones)
  const history = usePlannerStore(s => s.history)
  const waterMl = usePlannerStore(s => s.waterMl[today] ?? 0)
  const waterTargetMl = usePlannerStore(s => s.cfg.waterTargetMl)

  const lifeScore7d = useMemo(() => computeLifeScore(zones, history, 7).total, [zones, history])
  const waterLitres = waterMl / 1000
  const waterTargetLitres = waterTargetMl / 1000
  const waterComplete = waterTargetMl > 0 && waterMl >= waterTargetMl

  const cards: StatCard[] = [
    { label: '🧭 7D Life Score', val: lifeScore7d, sub: 'weighted zone consistency', tone: 'vx-text-cyan' },
    { label: 'Reward wallet',    val: wallet,      sub: 'earned via consistency',    tone: 'vx-text-amber' },
    {
      label: '💧 Water Intake',
      val: waterLitres,
      decimals: 2,
      sub: `of ${waterTargetLitres.toFixed(waterTargetLitres % 1 === 0 ? 0 : 2)}L`,
      tone: 'vx-text-emerald',
      complete: waterComplete,
    },
    { label: 'Streak', val: streak, sub: 'days', fire: true, tone: 'vx-text-cyan' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3.5">
      {cards.map((c, i) => {
        const Tag: React.ElementType = c.fire && onStreakClick ? 'button' : 'div'
        return (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.28 + i * 0.06 }}
          >
            <Tag
              className={`vx-glass vx-glass-tap text-left w-full ${c.fire && onStreakClick ? 'cursor-pointer' : ''} ${c.complete ? 'vx-tile-complete' : ''}`}
              style={{ marginBottom: 0, padding: '1rem 1.1rem' }}
              {...(c.fire && onStreakClick ? { onClick: onStreakClick } : {})}
            >
              <div className="vx-eyebrow">{c.label}</div>
              {c.fire ? (
                <div className="relative inline-flex items-center justify-center min-w-[1.5em] mt-2">
                  <span className="absolute text-[28px] opacity-20 select-none leading-none">🔥</span>
                  <AnimatedNumber value={c.val} className={`relative text-2xl font-extrabold leading-none ${c.tone}`} />
                </div>
              ) : (
                <AnimatedNumber value={c.val} decimals={c.decimals} className={`block text-2xl font-extrabold leading-none mt-2 ${c.tone}`} />
              )}
              <div className="text-[10.5px] text-[var(--text3)] mt-1.5">
                {c.complete ? '🎉 Target reached!' : c.sub}
              </div>
            </Tag>
          </motion.div>
        )
      })}
    </div>
  )
}
