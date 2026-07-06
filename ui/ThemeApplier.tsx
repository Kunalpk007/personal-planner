'use client'
import { useEffect } from 'react'
import { usePlannerStore } from '@/store'

function resolveTheme(theme: string): 'light' | 'dark' {
  if (theme === 'light') return 'light'
  if (theme === 'dark') return 'dark'
  // 'system' or any unknown value → respect OS preference
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'dark'
}

/** Applies the configured theme to the document root so CSS vars switch. */
export function ThemeApplier() {
  const theme = usePlannerStore(s => s.cfg.theme)

  useEffect(() => {
    const resolved = resolveTheme(theme ?? 'system')
    document.documentElement.setAttribute('data-theme', resolved)

    if (theme !== 'system') return
    // Keep in sync with live OS preference changes when on 'system' mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return null
}
