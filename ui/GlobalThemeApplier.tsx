'use client'
import { useEffect } from 'react'
import { getStoredTheme, applyTheme } from '@/lib/theme'

/**
 * Applies the last-known theme on every page, including auth pages (login/
 * signup/reset-password) that sit outside the tabs layout and never mount
 * ThemeApplier. Reads from an unscoped localStorage key so the theme choice
 * survives logout instead of resetting with the per-user store.
 */
export function GlobalThemeApplier() {
  useEffect(() => {
    applyTheme(getStoredTheme())
  }, [])

  return null
}
