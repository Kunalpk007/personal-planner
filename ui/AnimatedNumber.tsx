'use client'
import { useEffect, useRef } from 'react'
import { useSpring, useTransform, motion, useInView } from 'framer-motion'

/** Count-up number used across the vibrant-redesign ("vx-") Dashboard cards.
 *  Purely presentational — animates from 0 (or the previous value) to `value`
 *  whenever it changes, using a spring so streaks/updates feel alive instead
 *  of the number just snapping. */
export function AnimatedNumber({ value, className, decimals = 0 }: { value: number; className?: string; decimals?: number }) {
  const spring = useSpring(0, { stiffness: 90, damping: 20, mass: 0.6 })
  const display = useTransform(spring, (v) => decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString())
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (inView) spring.set(value)
  }, [value, inView, spring])

  return <motion.span ref={ref} className={className}>{display}</motion.span>
}
