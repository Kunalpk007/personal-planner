import type { ThemeMode } from '@/store/types'

// Unscoped — deliberately outside the per-user Zustand store so the visual
// theme survives logout/account switching instead of resetting to the default.
const THEME_KEY = 'kp_theme'

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' || v === 'cream' ? v : 'dark'
}

export function setStoredTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(THEME_KEY, theme)
}

/** No more "system" option — it never actually tracked live OS changes in a
 *  way that was visible to the user, so Settings now offers exactly three
 *  concrete themes (Light/Dark/Cream) and whatever's picked is applied as-is.
 *  Kept as a passthrough (rather than removed) so call sites don't change. */
export function resolveTheme(theme: ThemeMode): ThemeMode {
  return theme
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolveTheme(theme))
}
