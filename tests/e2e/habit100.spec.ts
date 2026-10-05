import { test, expect, type Page } from '@playwright/test'
import { setupAuthenticatedPage } from './auth'

const TODAY = '2026-06-12' // Friday, matches tests/e2e/helpers.ts's fixed clock

async function freezeRandomAndSuppressPopups(page: Page, date = TODAY) {
  await page.addInitScript(() => { Math.random = () => 0 })
  await page.addInitScript((d) => {
    try {
      localStorage.setItem('kp_pwa_reminder_seen', d)
    } catch {}
  }, date)
}

/** Seeds the Consistency Tracker's own, separate localStorage key —
 *  mirrors zustand persist's on-disk shape ({state, version}). Call before
 *  page.goto(); pairs with setupAuthenticatedPage for the main store/clock. */
async function seedHabit100(page: Page, state: Record<string, unknown>) {
  await page.addInitScript((s) => {
    localStorage.setItem('habit100_v1', JSON.stringify({ state: s, version: 0 }))
  }, state)
}

function habit(overrides: Record<string, unknown> = {}) {
  return { id: 'h1', label: 'Drink water', type: 'checkbox', counted: true, ...overrides }
}

function meta(overrides: Record<string, unknown> = {}) {
  return {
    startDate: '2026-06-10', totalDays: 100, disciplinedThresholdPct: 80,
    habits: [habit()], goals: ['Reach 74kg'], badges: [],
    createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-10T00:00:00.000Z',
    ...overrides,
  }
}

test.describe('Consistency Tracker (habit100)', () => {
  test('Dashboard tile prompts setup before a tracker exists, and routes to /habit100', async ({ page, context }) => {
    await freezeRandomAndSuppressPopups(page)
    await setupAuthenticatedPage(page, context, { morningQuoteShown: { [TODAY]: true }, morningTop3Shown: { [TODAY]: true } })
    await page.goto('/dashboard')

    await expect(page.getByText('Set up your 100-day run')).toBeVisible()
    await page.getByText('Set up your 100-day run').click()
    await expect(page).toHaveURL(/\/habit100$/)
    await expect(page.getByText('Set up your 100-day run')).toBeVisible() // the SetupWizard itself
  })

  test('Setup wizard: remove a habit, start the run, land on Home with Day 1', async ({ page, context }) => {
    await freezeRandomAndSuppressPopups(page)
    await setupAuthenticatedPage(page, context, { morningQuoteShown: { [TODAY]: true }, morningTop3Shown: { [TODAY]: true } })
    await page.goto('/habit100')

    await expect(page.getByText('Set up your 100-day run')).toBeVisible()
    // Remove the first habit row
    await page.getByRole('button', { name: /Remove/ }).first().click()
    await page.getByRole('button', { name: 'Start my 100 days' }).click()

    await expect(page.getByText(/Day 1 \/ 100/)).toBeVisible()
  })

  test('Setup wizard: a time-type habit\'s target shows a real time picker, not raw minutes', async ({ page, context }) => {
    await freezeRandomAndSuppressPopups(page)
    await setupAuthenticatedPage(page, context, { morningQuoteShown: { [TODAY]: true }, morningTop3Shown: { [TODAY]: true } })
    await page.goto('/habit100')

    const row = page.locator('.habit100-row').filter({ hasText: 'Asleep before 11 PM' })
    const timeInput = row.locator('input[type="time"]')
    await expect(timeInput).toHaveValue('23:00') // not "1380"
    // No raw number input should be showing for this row
    await expect(row.locator('input[type="number"]')).toHaveCount(0)

    await timeInput.fill('22:30')
    await page.getByRole('button', { name: 'Start my 100 days' }).click()
    await expect(page.getByText(/Day 1 \/ 100/)).toBeVisible()

    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('habit100_v1')!).state)
    const sleepHabit = state.meta.habits.find((h: { id: string }) => h.id === 'sleep11')
    expect(sleepHabit.target).toBe(22 * 60 + 30)
  })

  test('Home: habit log autosaves (checkbox immediate, numeric on blur) without a submit button', async ({ page, context }) => {
    await freezeRandomAndSuppressPopups(page)
    await setupAuthenticatedPage(page, context, { morningQuoteShown: { [TODAY]: true }, morningTop3Shown: { [TODAY]: true } })
    await seedHabit100(page, {
      meta: meta({
        startDate: TODAY,
        habits: [habit({ id: 'water', label: 'Drink water' }), habit({ id: 'steps', label: '8k steps', type: 'numeric', unit: 'steps', target: 8000, comparison: 'gte' })],
      }),
      days: {}, weeks: {},
    })
    await page.goto('/habit100')

    await expect(page.getByText(/Day 1 \/ 100/)).toBeVisible()

    // Checkbox commits immediately
    const waterRow = page.locator('.habit100-row').filter({ hasText: 'Drink water' })
    await waterRow.getByRole('button').click()
    await expect(waterRow.getByRole('button')).toHaveText('✓')

    // Numeric commits on blur
    const stepsRow = page.locator('.habit100-row').filter({ hasText: '8k steps' })
    await stepsRow.locator('input[type="number"]').fill('9000')
    await stepsRow.locator('input[type="number"]').blur()

    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('habit100_v1')!).state)
    expect(state.days[TODAY].values.water).toBe(true)
    expect(state.days[TODAY].values.steps).toBe(9000)
  })

  test('Catch-up queue auto-opens for a pending past day; "Not now" leaves it unlocked, Confirm & lock locks it', async ({ page, context }) => {
    await freezeRandomAndSuppressPopups(page)
    await setupAuthenticatedPage(page, context, { morningQuoteShown: { [TODAY]: true }, morningTop3Shown: { [TODAY]: true } })
    await seedHabit100(page, {
      meta: meta({ startDate: '2026-06-11', habits: [habit({ id: 'water' })] }),
      days: {}, weeks: {},
    })
    await page.goto('/habit100')

    await expect(page.getByText('Catch up — Thu, 11 Jun')).toBeVisible()

    // "Not now" dismisses without locking
    await page.getByRole('button', { name: 'Not now' }).click()
    await expect(page.getByText('Catch up — Thu, 11 Jun')).not.toBeVisible()
    let state = await page.evaluate(() => JSON.parse(localStorage.getItem('habit100_v1')!).state)
    expect(state.days['2026-06-11']?.locked).toBeFalsy()

    // Reload — queue reappears since nothing was confirmed
    await page.reload()
    await expect(page.getByText('Catch up — Thu, 11 Jun')).toBeVisible()

    // Fill in the habit, confirm, and lock (scope to the dialog — the Home
    // page's own form for today renders the same habit row behind it)
    const dialog = page.getByRole('dialog')
    await dialog.locator('.habit100-row').filter({ hasText: 'Drink water' }).getByRole('button').click()
    await dialog.getByRole('button', { name: 'Confirm & lock' }).click()
    await expect(page.getByText('No further changes will be possible')).toBeVisible()
    await page.getByRole('button', { name: 'Lock it' }).click()

    await expect(page.getByText('Catch up — Thu, 11 Jun')).not.toBeVisible()
    state = await page.evaluate(() => JSON.parse(localStorage.getItem('habit100_v1')!).state)
    expect(state.days['2026-06-11'].locked).toBe(true)
    expect(state.days['2026-06-11'].values.water).toBe(true)
  })

  test('Progress page shows stats, grid, breakdown, and the day-100 report when finished', async ({ page, context }) => {
    await freezeRandomAndSuppressPopups(page)
    await setupAuthenticatedPage(page, context, { morningQuoteShown: { [TODAY]: true }, morningTop3Shown: { [TODAY]: true } })
    await seedHabit100(page, {
      meta: meta({ startDate: '2026-03-04', habits: [habit({ id: 'water' })], badges: [] }), // 2026-03-04 -> day 100 on 2026-06-12
      days: {
        '2026-06-11': { date: '2026-06-11', values: { water: true }, locked: true, updatedAt: 't' },
      },
      weeks: {},
    })
    await page.goto('/habit100/progress')

    await expect(page.getByText(/100.*\/ 100/)).toBeVisible()
    await expect(page.getByText('🎉 100 days complete')).toBeVisible()
    await expect(page.getByText('Habit breakdown')).toBeVisible()
    await expect(page.getByText('Trends')).not.toBeVisible() // no mood/weight data seeded
  })

  test('History: locked days show %, pending days show "pending", tapping a locked day opens read-only detail', async ({ page, context }) => {
    await freezeRandomAndSuppressPopups(page)
    await setupAuthenticatedPage(page, context, { morningQuoteShown: { [TODAY]: true }, morningTop3Shown: { [TODAY]: true } })
    await seedHabit100(page, {
      meta: meta({ startDate: '2026-06-10', habits: [habit({ id: 'water' })] }),
      days: {
        '2026-06-10': { date: '2026-06-10', values: { water: true }, locked: true, updatedAt: 't', gratitude: 'Good start' },
        '2026-06-11': { date: '2026-06-11', values: {}, locked: false, updatedAt: 't' },
      },
      weeks: {},
    })
    await page.goto('/habit100/history')

    const lockedRow = page.getByRole('button', { name: /Wed, 10 Jun/ })
    await expect(lockedRow).toContainText('100%')
    const pendingRow = page.getByRole('button', { name: /Thu, 11 Jun/ })
    await expect(pendingRow).toContainText('pending')

    await lockedRow.click()
    await expect(page.getByText('Good start')).toBeVisible()
    // Read-only: the habit checkbox is disabled
    await expect(page.locator('.habit100-row').filter({ hasText: 'Drink water' }).getByRole('button')).toBeDisabled()

    await page.getByRole('button', { name: '← History' }).click()
    await expect(lockedRow).toBeVisible()
  })

  test('StatGrid Water Intake tile keeps its own +/- buttons after the full-width card removal', async ({ page, context }) => {
    await freezeRandomAndSuppressPopups(page)
    await setupAuthenticatedPage(page, context, { morningQuoteShown: { [TODAY]: true }, morningTop3Shown: { [TODAY]: true } })
    await page.goto('/dashboard')

    await expect(page.getByText('💧 Water Intake')).toBeVisible()
    await expect(page.getByText('💧 Water Drank')).not.toBeVisible()
    await expect(page.getByText('🕐 Set Focus Time')).not.toBeVisible()

    await page.getByRole('button', { name: 'Add 250ml' }).click()
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('kunals_planner_v2:e2e-test-user-00000000-0000-0000-0000-000000000000')!).state)
    expect(state.waterMl[TODAY]).toBe(250)
  })
})
