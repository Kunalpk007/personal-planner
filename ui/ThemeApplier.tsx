'use client'
import { useEffect } from 'react'
import { usePlannerStore } from '@/store'
import { setStoredTheme, applyTheme } from '@/lib/theme'
import type { ThemeMode } from '@/store/types'

/**
 * Applies the configured theme to the document root so CSS vars switch, and
 * mirrors the choice to an unscoped localStorage key (lib/theme.ts) so
 * GlobalThemeApplier can apply it on auth pages and across logout.
 */
export function ThemeApplier() {
  const theme = (usePlannerStore(s => s.cfg.theme) ?? 'system') as ThemeMode

  useEffect(() => {
    setStoredTheme(theme)
    applyTheme(theme)

    if (theme !== 'system') return
    // Keep in sync with live OS preference changes when on 'system' mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return null
}
