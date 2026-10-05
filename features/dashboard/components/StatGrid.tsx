'use client'
import { useMemo }                from 'react'
import { motion }                 from 'framer-motion'
import { usePlannerStore }        from '@/store'
import { computeLifeScore } from '@/lib/engine/goals'
import { AnimatedNumber } from '@/ui/AnimatedNumber'

const WATER_STEP_ML = 250

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
 *  - "Water Intake" stays as-is (kept per explicit request) — but the old
 *    full-width "Water Drank" card that was its only input mechanism is
 *    gone (see ConsistencyRow.tsx/project.md), so this tile now carries its
 *    own compact +/- buttons directly, rather than becoming a number with
 *    no way to update it. */
export function StatGrid({ today, onLifeScoreClick }: { today: string; onLifeScoreClick?: () => void }) {
  const zones   = usePlannerStore(s => s.zones)
  const history = usePlannerStore(s => s.history)
  const waterMl = usePlannerStore(s => s.waterMl[today] ?? 0)
  const waterTargetMl = usePlannerStore(s => s.cfg.waterTargetMl)
  const addWater = usePlannerStore(s => s.addWater)

  const lifeScore7d = useMemo(() => computeLifeScore(zones, history, 7).total, [zones, history])
  const waterLitres = waterMl / 1000
  const waterTargetLitres = waterTargetMl / 1000
  const waterComplete = waterTargetMl > 0 && waterMl >= waterTargetMl

  return (
    <div className="grid grid-cols-2 gap-3 mb-3.5">
      <motion.button
        type="button"
        onClick={onLifeScoreClick}
        className="vx-glass vx-glass-tap text-left w-full cursor-pointer"
        style={{ marginBottom: 0, padding: '1rem 1.1rem' }}
        initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.28 }}
      >
        <div className="vx-eyebrow">🧭 7D Life Score</div>
        <AnimatedNumber value={lifeScore7d} className="block text-2xl font-extrabold leading-none mt-2 vx-text-cyan" />
        <div className="text-[10.5px] text-[var(--text3)] mt-1.5">tap for the full breakdown</div>
      </motion.button>

      <motion.div
        className={`vx-glass w-full ${waterComplete ? 'vx-tile-complete' : ''}`}
        style={{ marginBottom: 0, padding: '1rem 1.1rem' }}
        initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.34 }}
      >
        <div className="flex items-start justify-between">
          <div className="vx-eyebrow">💧 Water Intake</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => addWater(today, -WATER_STEP_ML)}
              disabled={waterMl <= 0}
              className="vx-btn vx-btn-ghost"
              style={{ width: 22, height: 22, borderRadius: '50%', padding: 0, fontSize: 13, fontWeight: 700 }}
              aria-label="Remove 250ml"
            >−</button>
            <button
              type="button"
              onClick={() => addWater(today, WATER_STEP_ML)}
              className="vx-btn vx-btn-primary"
              style={{ width: 22, height: 22, borderRadius: '50%', padding: 0, fontSize: 13, fontWeight: 700 }}
              aria-label="Add 250ml"
            >+</button>
          </div>
        </div>
        <AnimatedNumber value={waterLitres} decimals={2} className="block text-2xl font-extrabold leading-none mt-2 vx-text-emerald" />
        <div className="text-[10.5px] text-[var(--text3)] mt-1.5">
          {waterComplete ? '🎉 Target reached!' : `of ${waterTargetLitres.toFixed(waterTargetLitres % 1 === 0 ? 0 : 2)}L`}
        </div>
      </motion.div>
    </div>
  )
}
