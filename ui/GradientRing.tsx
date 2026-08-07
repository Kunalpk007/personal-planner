'use client'
import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect, useId } from 'react'

interface GradientRingProps {
  pct:    number   // 0-100
  size?:  number
  stroke?: number
  label?: string
}

/** Circular progress ring for the vibrant-redesign Dashboard (day progress).
 *  Animates in with a spring on mount/update rather than snapping straight
 *  to the target percentage. */
export function GradientRing({ pct, size = 104, stroke = 9, label = 'Day' }: GradientRingProps) {
  const gradId = useId()
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r

  const spring = useSpring(0, { stiffness: 60, damping: 18, mass: 0.8 })
  const offset = useTransform(spring, (v) => circumference - (circumference * v) / 100)
  const pctLabel = useTransform(spring, (v) => `${Math.round(v)}%`)

  useEffect(() => { spring.set(Math.max(0, Math.min(100, pct))) }, [pct, spring])

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--vx-border)" strokeWidth={stroke} />
        <motion.circle
          className="vx-ring-fg"
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset }}
        />
        <defs>
          {/* Flat, single-tone accent ring (previously a violet→pink→amber
              rainbow sweep) — premium apps read progress rings as one clean
              color, not a color-cycling gradient. Both stops use the
              theme's accent color via CSS var() in an inline `style`
              (SVG's `stop-color` presentation attribute doesn't resolve
              var() directly, but the CSS property does). */}
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--color-accent)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-accent)' }} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div className="text-[22px] font-extrabold font-[var(--font-display,inherit)]">{pctLabel}</motion.div>
        <div className="text-[9px] text-[var(--text3)] uppercase tracking-wide mt-0.5">{label}</div>
      </div>
    </div>
  )
}
