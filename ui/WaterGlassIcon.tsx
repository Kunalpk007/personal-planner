'use client'
import { motion } from 'framer-motion'

/** A plain drinking glass with a blue water level inside, replacing the
 *  🥤 (juice-with-straw) emoji that was previously used for the water
 *  tracker — per explicit feedback that a juice glass/straw was the wrong
 *  symbol for a water tracker. `fillPct` (0-100) controls how full the
 *  glass appears; the water level animates smoothly when it changes. */
export function WaterGlassIcon({ fillPct = 50, size = 34 }: { fillPct?: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, fillPct))
  // Glass interior spans roughly y=3 (rim) to y=21 (base) in the 24x24
  // viewBox below — water rises from the base as pct increases.
  const glassTop = 3
  const glassBottom = 21
  const waterY = glassBottom - ((glassBottom - glassTop) * pct) / 100

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <clipPath id="vx-water-glass-clip">
          <path d="M6.2 3h11.6l-1.4 16.8a1.6 1.6 0 0 1-1.6 1.5H9.2a1.6 1.6 0 0 1-1.6-1.5L6.2 3z" />
        </clipPath>
        <linearGradient id="vx-water-fill-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <g clipPath="url(#vx-water-glass-clip)">
        <motion.rect
          x="4" width="16" height="24"
          fill="url(#vx-water-fill-grad)"
          initial={false}
          animate={{ y: waterY }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        />
        {/* Subtle surface highlight so the fill line reads clearly rather
            than looking like a flat color block. */}
        <motion.rect
          x="4" width="16" height="1.4"
          fill="rgba(255,255,255,0.45)"
          initial={false}
          animate={{ y: waterY }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        />
      </g>
      <path
        d="M6.2 3h11.6l-1.4 16.8a1.6 1.6 0 0 1-1.6 1.5H9.2a1.6 1.6 0 0 1-1.6-1.5L6.2 3z"
        stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"
      />
      <path d="M6.2 3h11.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
