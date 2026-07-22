import type { ThemeMode } from '@/store/types'

// Unscoped — deliberately outside the per-user Zustand store so the visual
// theme survives logout/account switching instead of resetting to the default.
const THEME_KEY = 'kp_theme'

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function setStoredTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(THEME_KEY, theme)
}

export function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'light') return 'light'
  if (theme === 'dark') return 'dark'
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'dark'
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolveTheme(theme))
}
