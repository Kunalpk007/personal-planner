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
  complete?: boolean
}

/** Down to 2 tiles, both tap-to-expand — per explicit feedback that having
 *  5 different progress numbers visible at once (this grid's 4 tiles + the
 *  streak orb up top) made it impossible to tell "am I actually doing well"
 *  at a glance.
 *
 *  - "Reward wallet" removed entirely: it's already shown at the point it
 *    actually matters (redeeming on the Rewards page), so showing it here
 *    too was just a second number with no decision attached to it.
 *  - "Streak" removed entirely: exact duplicate of the streak orb in the
 *    dashboard header (also clickable, opens the same StreakHistoryModal) —
 *    showing the same number twice on one screen.
 *  - "7D Life Score" stays, but is now a tap target (`onLifeScoreClick`)
 *    instead of a static number — opens `LifeScoreModal`, matching how the
 *    streak orb/RankProgress already work (a compact number on the surface,
 *    full detail one tap away instead of always rendered inline). The old
 *    always-visible `LifeScoreCard` further down the page was folded into
 *    that same modal rather than kept as a second, redundant copy of the
 *    same data — see app/(tabs)/dashboard/page.tsx.
 *  - "Water Intake" stays as-is (kept per explicit request — it's the one
 *    tile with a same-day actionable number, not a progress metric). */
export function StatGrid({ today, onLifeScoreClick }: { today: string; onLifeScoreClick?: () => void }) {
  const zones   = usePlannerStore(s => s.zones)
  const history = usePlannerStore(s => s.history)
  const waterMl = usePlannerStore(s => s.waterMl[today] ?? 0)
  const waterTargetMl = usePlannerStore(s => s.cfg.waterTargetMl)

  const lifeScore7d = useMemo(() => computeLifeScore(zones, history, 7).total, [zones, history])
  const waterLitres = waterMl / 1000
  const waterTargetLitres = waterTargetMl / 1000
  const waterComplete = waterTargetMl > 0 && waterMl >= waterTargetMl

  const cards: StatCard[] = [
    { label: '🧭 7D Life Score', val: lifeScore7d, sub: 'tap for the full breakdown', tone: 'vx-text-cyan' },
    {
      label: '💧 Water Intake',
      val: waterLitres,
      decimals: 2,
      sub: `of ${waterTargetLitres.toFixed(waterTargetLitres % 1 === 0 ? 0 : 2)}L`,
      tone: 'vx-text-emerald',
      complete: waterComplete,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 mb-3.5">
      {cards.map((c, i) => {
        const isLifeScore = c.label.includes('Life Score')
        const Tag: React.ElementType = isLifeScore && onLifeScoreClick ? 'button' : 'div'
        return (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.28 + i * 0.06 }}
          >
            <Tag
              className={`vx-glass vx-glass-tap text-left w-full ${isLifeScore && onLifeScoreClick ? 'cursor-pointer' : ''} ${c.complete ? 'vx-tile-complete' : ''}`}
              style={{ marginBottom: 0, padding: '1rem 1.1rem' }}
              {...(isLifeScore && onLifeScoreClick ? { onClick: onLifeScoreClick } : {})}
            >
              <div className="vx-eyebrow">{c.label}</div>
              <AnimatedNumber value={c.val} decimals={c.decimals} className={`block text-2xl font-extrabold leading-none mt-2 ${c.tone}`} />
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
