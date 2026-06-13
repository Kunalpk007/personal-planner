'use client'
import { useEffect } from 'react'
import { usePlannerStore } from '@/store'

/** Applies the configured theme to the document root so CSS vars switch. */
export function ThemeApplier() {
  const theme = usePlannerStore(s => s.cfg.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme ?? 'dark')
  }, [theme])

  return null
}
