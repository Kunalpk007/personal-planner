import type { Page } from '@playwright/test'

export const STORAGE_KEY = 'kunals_planner_v2'

// Friday, weekday — minPts = 70, getDayKey() resolves to '2026-06-12'
export const FIXED_TIME = '2026-06-12T10:00:00'
export const TODAY = '2026-06-12'

/**
 * Seeds localStorage with a partial AppStateData fixture before any app
 * script runs, and freezes the clock so getDayKey()/getWeekMonday() are
 * deterministic. Call before page.goto().
 */
export async function seedStore(page: Page, fixture: Record<string, unknown>) {
  await page.addInitScript(
    ([key, state]) => {
      localStorage.setItem(key, JSON.stringify({ state, version: 2 }))
    },
    [STORAGE_KEY, fixture] as [string, Record<string, unknown>]
  )
  await page.clock.setFixedTime(new Date(FIXED_TIME))
}
