'use client'
import { motion } from 'framer-motion'
import { usePlannerStore } from '@/store'
import { WaterGlassIcon } from '@/ui/WaterGlassIcon'

const STEP_ML = 250

/** Dashboard "Water Drank" tile — cumulative litres so far today, with
 *  +/- 250ml buttons (a full glass at a time). Mirrors FocusTimeCard's
 *  layout/animation so the two sit consistently side by side. */
export function WaterTrackerCard({ today }: { today: string }) {
  const waterMl  = usePlannerStore(s => s.waterMl[today] ?? 0)
  const target   = usePlannerStore(s => s.cfg.waterTargetMl)
  const addWater = usePlannerStore(s => s.addWater)

  const litres = (waterMl / 1000).toFixed(2)
  const fillPct = target > 0 ? (waterMl / target) * 100 : 0

  return (
    <motion.div
      className="vx-glass"
      initial={{ opacity: 0, y: 22, scale: 0.97, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.46 }}
    >
      <div className="vx-eyebrow mb-2">💧 Water Drank</div>
      <div className="text-[15px] font-semibold mb-3">{litres} ltrs so far</div>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => addWater(today, -STEP_ML)}
          disabled={waterMl <= 0}
          className="vx-btn vx-btn-ghost"
          style={{ width: 40, height: 40, borderRadius: '50%', padding: 0, fontSize: 18, fontWeight: 700 }}
          aria-label="Remove 250ml"
          title="-250ml"
        >
          −
        </button>

        <div className="flex flex-col items-center gap-1">
          <WaterGlassIcon fillPct={fillPct} size={34} />
          <span className="text-[10px] text-[var(--text3)]">250ml</span>
        </div>

        <button
          onClick={() => addWater(today, STEP_ML)}
          className="vx-btn vx-btn-primary"
          style={{ width: 40, height: 40, borderRadius: '50%', padding: 0, fontSize: 18, fontWeight: 700 }}
          aria-label="Add 250ml"
          title="+250ml"
        >
          +
        </button>
      </div>
      <p className="text-[11px] text-[var(--text3)] mt-3 text-center">Drink more — every glass counts.</p>
    </motion.div>
  )
}
