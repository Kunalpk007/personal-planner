'use client'
import { useEffect } from 'react'
import { usePlannerStore } from '@/store'

const SCALE_MAP = { normal: 1, large: 1.15, xlarge: 1.3 } as const

/**
 * Most text in this app uses fixed px sizes (Tailwind arbitrary values like
 * text-[13px]), not rem, so scaling the root font-size wouldn't reach them.
 * Instead we zoom the page-content container as a whole via a CSS variable —
 * nav bars sit outside it so they stay a consistent, fixed size.
 */
export function FontScaleApplier() {
  const fontScale = usePlannerStore(s => s.cfg.fontScale) ?? 'normal'

  useEffect(() => {
    const scale = SCALE_MAP[fontScale as keyof typeof SCALE_MAP] ?? 1
    document.documentElement.style.setProperty('--content-zoom', String(scale))
  }, [fontScale])

  return null
}
