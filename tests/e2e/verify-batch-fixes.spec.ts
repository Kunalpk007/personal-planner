import { test, expect } from '@playwright/test'
import { setupAuthenticatedPage } from './auth'

const TEST_UID = 'e2e-test-user-00000000-0000-0000-0000-000000000000'
const STORAGE_KEY = 'kunals_planner_v2'
const SCOPED_KEY  = `${STORAGE_KEY}:${TEST_UID}`

// Deterministic manager-message picks (pickRand uses Math.random with no seed
// in getInactivityMessage/getDayEndMessage/getZoneNeglectMessage) — force
// index 0 of whatever pool is chosen so assertions aren't flaky.
async function freezeRandom(page: import('@playwright/test').Page) {
  await page.addInitScript(() => { Math.random = () => 0 })
}

// PwaBootstrap (mounted globally in app/(tabs)/layout.tsx, every tab) pops a
// blocking "Install app" modal ~2.5s after mount unless kp_pwa_reminder_seen
// already matches today — unrelated to anything under test here, so suppress
// it everywhere the same way a real returning user's browser would.
async function suppressPwaReminder(page: import('@playwright/test').Page, dateStr: string) {
  await page.addInitScript((d) => {
    try { localStorage.setItem('kp_pwa_reminder_seen', d) } catch {}
  }, dateStr)
}

async function setup(page: import('@playwright/test').Page, dateStr = '2026-06-12') {
  await freezeRandom(page)
  await suppressPwaReminder(page, dateStr)
}

async function readStoreState(page: import('@playwright/test').Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state ?? parsed
  }, SCOPED_KEY)
}

// Suppresses the morning quote overlay AND the morning top-3 prompt for a
// given date, so tests that don't care about those two auto-popups aren't
// blocked by them stealing focus. Test 8 (which specifically exercises the
// top-3 prompt) omits morningTop3Shown on purpose.
function noMorningPopups(date: string) {
  return { morningQuoteShown: { [date]: true }, morningTop3Shown: { [date]: true } }
}

test.describe('batch fix verification (2026-09-07 12-item batch)', () => {
  test('1. pause and resume streak require confirmation and actually work', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, { streak: 10, bestStreak: 10 })
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Streak & Badges' }).click()

    await page.getByRole('button', { name: '⏸ Pause Streak' }).click()
    await expect(page.getByRole('dialog')).toContainText('Pause Streak')
    await page.getByPlaceholder(/Spiti trip/).fill('Testing pause')
    await page.getByRole('dialog').getByRole('button', { name: 'Pause Streak' }).click()
    await expect(page.getByText('Streak paused.')).toBeVisible()

    // Button flips to Resume once paused
    await expect(page.getByRole('button', { name: '▶ Resume Streak' })).toBeVisible()
    await page.getByRole('button', { name: '▶ Resume Streak' }).click()
    await expect(page.getByRole('dialog')).toContainText('Restore your streak to')
    await expect(page.getByRole('dialog')).toContainText('10')
    await page.getByRole('dialog').getByRole('button', { name: 'Resume Streak' }).click()
    await expect(page.getByText('Streak resumed.')).toBeVisible()

    // Back to the Pause button, streak stat unchanged
    await expect(page.getByRole('button', { name: '⏸ Pause Streak' })).toBeVisible()
    const state = await readStoreState(page)
    expect(state.streak).toBe(10)
    expect(state.pausedStreak).toBeNull()
  })

  test('2/3. weekly rest cap auto-spends a freeze on the next miss', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, {
      history: [{
        date: '2026-06-10', done: 4, total: 4, pct: 100, rxp: 80, mood: '', eodMood: '',
        frozen: false, rest: false, auto: false, late: false, tasks: [], rewards: [],
      }],
      tasks: [{
        id: 'miss-1', title: 'Missed task', note: '', zone: 'z1', priority: 'low', slot: '',
        deadline: null, done: false, date: '2026-06-11', createdAt: '2026-06-11T08:00:00.000Z',
        completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0,
      }],
      streak: 5, bestStreak: 5, submittedDays: { '2026-06-10': true },
      weekRestUsed: { '2026-06-08': true }, // this week's Monday — rest already used
      freezeTokens: 2, freezesBought: 1, freezesUsed: 0,
      // The auto-frozen day created below is itself retro-fixable (see test
      // 6) — mark it already-fixed so RetroFixPanel doesn't also auto-open
      // and steal focus; this test is about the freeze fallback, not that.
      retroFixedDays: { '2026-06-11': true },
      ...noMorningPopups('2026-06-12'),
    })
    await page.goto('/dashboard')

    // Overnight logic runs on mount: rest is already used this week -> auto-spends a freeze
    await expect(page.getByText(/❄️.*Rest day already used this week/)).toBeVisible()

    await page.getByTitle('View streak history').click()
    await expect(page.getByText('❄ 1 streak freeze available')).toBeVisible()

    const state = await readStoreState(page)
    expect(state.streak).toBe(5) // protected
    expect(state.freezeTokens).toBe(1)
    expect(state.freezesUsed).toBe(1)
    expect(state.frozenDays['2026-06-11']).toBe(true)
  })

  test('2/3b. streak genuinely breaks once the weekly rest day and all freezes are used up', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, {
      history: [{
        date: '2026-06-10', done: 4, total: 4, pct: 100, rxp: 80, mood: '', eodMood: '',
        frozen: false, rest: false, auto: false, late: false, tasks: [], rewards: [],
      }],
      tasks: [{
        id: 'miss-1', title: 'Missed task', note: '', zone: 'z1', priority: 'low', slot: '',
        deadline: null, done: false, date: '2026-06-11', createdAt: '2026-06-11T08:00:00.000Z',
        completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0,
      }],
      streak: 5, bestStreak: 5, submittedDays: { '2026-06-10': true },
      weekRestUsed: { '2026-06-08': true },
      freezeTokens: 0, freezesBought: 0, freezesUsed: 3,
      ...noMorningPopups('2026-06-12'),
    })
    await page.goto('/dashboard')

    await expect(page.getByText(/💔 Streak broken/)).toBeVisible()
    const state = await readStoreState(page)
    expect(state.streak).toBe(0)
  })

  test('5. streak history calendar renders a fixed 7-per-row grid', async ({ page, context }) => {
    await setup(page)
    // Ends on 06-11 (yesterday) so the overnight logic sees no gap to
    // process on mount — otherwise it'd auto-append an 11th day.
    const history = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-06-${String(i + 2).padStart(2, '0')}`, done: 1, total: 1, pct: 100, rxp: 80,
      mood: '', eodMood: '', frozen: false, rest: false, auto: false, late: false, tasks: [], rewards: [],
    }))
    await setupAuthenticatedPage(page, context, {
      history, streak: 10, bestStreak: 10, submittedDays: { '2026-06-11': true },
      ...noMorningPopups('2026-06-12'),
    })
    await page.goto('/dashboard')
    await page.getByTitle('View streak history').click()

    const chips = page.locator('.vx-cal-chip')
    await expect(chips).toHaveCount(10)
    const boxes = await chips.evaluateAll(els => els.map(el => el.getBoundingClientRect().top))
    // First 7 chips share one row (same top), the 8th starts a new row
    expect(new Set(boxes.slice(0, 7)).size).toBe(1)
    expect(boxes[7]).toBeGreaterThan(boxes[0])
  })

  test('6. retro-fix now covers an auto-consumed freeze day (previously excluded)', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, {
      history: [{
        date: '2026-06-11', done: 0, total: 4, pct: 0, rxp: 0, mood: '', eodMood: '',
        frozen: true, rest: false, auto: true, late: false,
        tasks: [
          { title: 'A', priority: 'high', done: false, zone: 'z1', completedAt: null, level: '' },
          { title: 'B', priority: 'high', done: false, zone: 'z1', completedAt: null, level: '' },
          { title: 'C', priority: 'high', done: false, zone: 'z1', completedAt: null, level: '' },
          { title: 'D', priority: 'high', done: false, zone: 'z1', completedAt: null, level: '' },
        ], rewards: [],
      }],
      tasks: [
        { id: 't1', title: 'A', note: '', zone: 'z1', priority: 'high', slot: '', deadline: null, done: false, date: '2026-06-11', createdAt: '2026-06-11T08:00:00.000Z', completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0 },
        { id: 't2', title: 'B', note: '', zone: 'z1', priority: 'high', slot: '', deadline: null, done: false, date: '2026-06-11', createdAt: '2026-06-11T08:00:00.000Z', completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0 },
        { id: 't3', title: 'C', note: '', zone: 'z1', priority: 'high', slot: '', deadline: null, done: false, date: '2026-06-11', createdAt: '2026-06-11T08:00:00.000Z', completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0 },
        { id: 't4', title: 'D', note: '', zone: 'z1', priority: 'high', slot: '', deadline: null, done: false, date: '2026-06-11', createdAt: '2026-06-11T08:00:00.000Z', completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0 },
      ],
      submittedDays: { '2026-06-11': true },
      frozenDays: { '2026-06-11': true },
      streak: 5, bestStreak: 5, rankXP: 100,
      freezeTokens: 0, freezesUsed: 1, freezesBought: 0,
      ...noMorningPopups('2026-06-12'),
    })
    await page.goto('/dashboard')

    await expect(page.getByText('Fix Yesterday\'s Tasks?')).toBeVisible()
    await expect(page.getByText(/streak-freeze day/)).toBeVisible()
    await page.getByRole('button', { name: 'Fix Tasks' }).click()

    await expect(page.getByText('0 of 4 done')).toBeVisible()
    for (const title of ['A', 'B', 'C', 'D']) {
      const row = page.getByText(title, { exact: true }).locator('xpath=..')
      await row.getByRole('button').click()
    }
    await expect(page.getByText('Target met')).toBeVisible()
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText(/🔥 Fixed!/)).toBeVisible()

    const state = await readStoreState(page)
    expect(state.streak).toBe(6)
    expect(state.freezeTokens).toBe(1) // refunded
    expect(state.freezesUsed).toBe(0)
    expect(state.frozenDays['2026-06-11']).toBeUndefined()
  })

  test('7. focus time uses a scrollable minute picker instead of 3 fixed buttons', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, { ...noMorningPopups('2026-06-12') })
    await page.goto('/dashboard')

    await page.getByRole('button', { name: '🕐 Set Focus Time' }).click()
    await expect(page.getByRole('dialog')).toContainText('Start focus session?')
    await expect(page.locator('.vx-minute-wheel')).toBeVisible()
    await expect(page.locator('.vx-minute-wheel-item[data-active="true"]')).toHaveText('25 min')

    await page.getByRole('button', { name: 'Start Focus' }).click()
    await expect(page.locator('.vx-focus-overlay')).toContainText('Focusing — 25 min session')
    await page.getByRole('button', { name: 'Cancel session' }).click()
    await expect(page.getByText('Focus session cancelled — no reward for an interrupted session.')).toBeVisible()
  })

  test('8. Tomorrow\'s Top 3 gets a zone/priority picker, and cancel actually removes it', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, { morningQuoteShown: { '2026-06-12': true } })
    await page.goto('/dashboard')

    const promptDialog = page.locator('.vx-modal-sheet').filter({ hasText: 'What matters most today?' })
    await expect(promptDialog).toBeVisible()
    await promptDialog.getByPlaceholder('Priority 1').fill('Ship it')

    const selects = promptDialog.locator('select')
    await selects.first().selectOption({ label: 'Fitness' })
    await selects.nth(1).selectOption('high')
    await promptDialog.getByRole('button', { name: 'Add tasks' }).click()
    await expect(page.getByText('Top 3 tasks added ✓')).toBeVisible()

    const card = page.locator('.vx-glass').filter({ hasText: "Today's Top 3" })
    await expect(card.getByText('Ship it')).toBeVisible()

    // Verify the created task actually has the picked zone + priority, not
    // the old hardcoded zones[0]/'med' defaults.
    const state = await readStoreState(page)
    const created = state.tasks.find((t: { title: string }) => t.title === 'Ship it')
    expect(created.zone).toBe('z4') // Fitness
    expect(created.priority).toBe('high')

    // Cancel actually works and the item disappears (was previously a
    // read-only list with no delete control at all).
    await card.getByRole('button', { name: '✕' }).click()
    await card.getByRole('button', { name: 'Changed my mind' }).click()
    await expect(page.getByText("Today's Top 3")).not.toBeVisible()

    const stateAfter = await readStoreState(page)
    const cancelled = stateAfter.tasks.find((t: { title: string }) => t.title === 'Ship it')
    expect(cancelled.cancelledAt).toBeTruthy()
  })

  test('9. a stale incomplete recurring instance gets deleted, not left inert', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, {
      recurring: [{ id: 'r1', title: 'Standup', note: '', zone: 'z1', priority: 'med', slot: '', level: '', isSpecial: false, specialPts: 0 }],
      history: [{
        date: '2026-06-11', done: 5, total: 5, pct: 100, rxp: 100, mood: '', eodMood: '',
        frozen: false, rest: false, auto: false, late: false, tasks: [], rewards: [],
      }],
      submittedDays: { '2026-06-11': true },
      tasks: [{
        id: 'stale-1', title: 'Standup', note: '', zone: 'z1', priority: 'med', slot: '',
        deadline: null, done: false, date: '2026-06-10', createdAt: '2026-06-10T08:00:00.000Z',
        completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0, recurId: 'r1',
      }],
      streak: 5, bestStreak: 5,
      ...noMorningPopups('2026-06-12'),
    })
    await page.goto('/dashboard')
    await page.waitForTimeout(500) // let useOvernightCheck's effect settle

    const state = await readStoreState(page)
    expect(state.tasks.find((t: { id: string }) => t.id === 'stale-1')).toBeUndefined()
    const todays = state.tasks.filter((t: { recurId?: string; date: string }) => t.recurId === 'r1' && t.date === '2026-06-12')
    expect(todays).toHaveLength(1)
  })

  test('10. journal textarea grows with the content instead of staying a fixed box', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, {})
    await page.goto('/journal')

    // Journal is gated behind a mandatory PIN (PinGate) — walk through the
    // one-time setup flow (set PIN -> security question) before the actual
    // journal content becomes reachable.
    for (const d of ['1', '2', '3', '4', '5', '6']) {
      await page.getByRole('button', { name: d, exact: true }).click()
    }
    await page.getByPlaceholder("e.g. What was your first pet's name?").fill('Test question')
    await page.getByPlaceholder('Your answer').fill('Test answer')
    await page.getByRole('button', { name: 'Save' }).click()

    const textarea = page.locator('textarea.vx-field')
    const before = await textarea.evaluate(el => el.getBoundingClientRect().height)
    const longText = Array.from({ length: 25 }, (_, i) => `Line ${i} of a long journal entry.`).join('\n')
    await textarea.fill(longText)
    const after = await textarea.evaluate(el => el.getBoundingClientRect().height)
    expect(after).toBeGreaterThan(before)
  })

  test('11a. manager greeting escalates to an inactivity callout after a long real gap', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, {
      history: [{
        date: '2026-06-01', done: 3, total: 3, pct: 100, rxp: 80, mood: '', eodMood: '',
        frozen: false, rest: false, auto: false, late: false, tasks: [], rewards: [],
      }],
      submittedDays: { '2026-06-01': true },
      streak: 0, bestStreak: 3,
      ...noMorningPopups('2026-06-12'),
    })
    await page.goto('/dashboard')
    await expect(page.getByText(/It's been 11 days/)).toBeVisible()
  })

  test('11b. day-end manager praise fires when every high-priority task is done', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, {
      // 3 high (60) + 1 med (12) = 72 >= minPts(70), all high tasks done
      tasks: [
        { id: 'h1', title: 'High 1', note: '', zone: 'z1', priority: 'high', slot: '', deadline: null, done: true, date: '2026-06-12', createdAt: '2026-06-12T08:00:00.000Z', completedAt: '2026-06-12T09:00:00.000Z', subtasks: [], level: '', isSpecial: false, specialPts: 0 },
        { id: 'h2', title: 'High 2', note: '', zone: 'z1', priority: 'high', slot: '', deadline: null, done: true, date: '2026-06-12', createdAt: '2026-06-12T08:00:00.000Z', completedAt: '2026-06-12T09:00:00.000Z', subtasks: [], level: '', isSpecial: false, specialPts: 0 },
        { id: 'h3', title: 'High 3', note: '', zone: 'z1', priority: 'high', slot: '', deadline: null, done: true, date: '2026-06-12', createdAt: '2026-06-12T08:00:00.000Z', completedAt: '2026-06-12T09:00:00.000Z', subtasks: [], level: '', isSpecial: false, specialPts: 0 },
        { id: 'm1', title: 'Med 1', note: '', zone: 'z1', priority: 'med', slot: '', deadline: null, done: true, date: '2026-06-12', createdAt: '2026-06-12T08:00:00.000Z', completedAt: '2026-06-12T09:00:00.000Z', subtasks: [], level: '', isSpecial: false, specialPts: 0 },
      ],
      ...noMorningPopups('2026-06-12'),
    })
    await page.goto('/dashboard')
    await expect(page.getByText(/ready to submit!/)).toBeVisible()
    await page.getByRole('button', { name: '✓ Submit My Day' }).click({ force: true })
    await page.getByRole('button', { name: 'Confirm & lock' }).click()

    await expect(page.getByRole('heading', { name: 'The Manager' })).toBeVisible()
    await expect(page.getByText(/high-priority task done today/)).toBeVisible()
  })

  test('11c. day-end manager scold fires on a bare-minimum day', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, {
      tasks: [
        // A high task left incomplete keeps highTotal>0 without highDone===highTotal
        { id: 'h1', title: 'High (undone)', note: '', zone: 'z1', priority: 'high', slot: '', deadline: null, done: false, date: '2026-06-12', createdAt: '2026-06-12T08:00:00.000Z', completedAt: null, subtasks: [], level: '', isSpecial: false, specialPts: 0 },
        // Late high task: 20pts halved to 10
        { id: 'h2', title: 'Late high', note: '', zone: 'z1', priority: 'high', slot: '', deadline: '2026-06-11T00:00:00.000Z', done: true, date: '2026-06-12', createdAt: '2026-06-11T08:00:00.000Z', completedAt: '2026-06-12T09:00:00.000Z', subtasks: [], level: '', isSpecial: false, specialPts: 0 },
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `m${i}`, title: `Med ${i}`, note: '', zone: 'z1', priority: 'med' as const, slot: '' as const,
          deadline: null, done: true, date: '2026-06-12', createdAt: '2026-06-12T08:00:00.000Z',
          completedAt: '2026-06-12T09:00:00.000Z', subtasks: [], level: '' as const, isSpecial: false, specialPts: 0,
        })),
      ],
      ...noMorningPopups('2026-06-12'),
    })
    await page.goto('/dashboard')
    await expect(page.getByText(/ready to submit!/)).toBeVisible()
    await page.getByRole('button', { name: '✓ Submit My Day' }).click({ force: true })
    await page.getByRole('button', { name: 'Confirm & lock' }).click()

    await expect(page.getByRole('heading', { name: 'The Manager' })).toBeVisible()
    await expect(page.getByText(/just cleared the bar/)).toBeVisible()
  })

  test('11d. Weekly Review calls out the neglected zone by name', async ({ page, context }) => {
    await setup(page, '2026-06-14')
    const weekDates = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13']
    const weekHistory = weekDates.map(d => ({
      date: d, done: 1, total: 1, pct: 100, rxp: 80, mood: '', eodMood: '',
      frozen: false, rest: false, auto: false, late: false,
      tasks: [{ title: 'Work', priority: 'high', done: true, zone: 'z1', completedAt: `${d}T10:00:00.000Z`, level: '' }],
      rewards: [],
    }))
    const oldEntry = {
      date: '2026-05-01', done: 1, total: 1, pct: 100, rxp: 20, mood: '', eodMood: '',
      frozen: false, rest: false, auto: false, late: false,
      tasks: [{ title: 'Gym', priority: 'high', done: true, zone: 'z2', completedAt: '2026-05-01T10:00:00.000Z', level: '' }],
      rewards: [],
    }
    await setupAuthenticatedPage(page, context, {
      history: [oldEntry, ...weekHistory],
      submittedDays: Object.fromEntries(weekDates.map(d => [d, true])),
      // Deliberately 'med' priority (not high/special) with overflow above
      // Sunday's 20pt target — avoids also triggering the day-end manager
      // scold/praise popup (covered separately by tests 11b/11c), which
      // would otherwise stack ambiguously on top of the celebration modal.
      tasks: [
        { id: 'today-1', title: 'Sunday task 1', note: '', zone: 'z1', priority: 'med', slot: '', deadline: null, done: true, date: '2026-06-14', createdAt: '2026-06-14T08:00:00.000Z', completedAt: '2026-06-14T09:00:00.000Z', subtasks: [], level: '', isSpecial: false, specialPts: 0 },
        { id: 'today-2', title: 'Sunday task 2', note: '', zone: 'z1', priority: 'med', slot: '', deadline: null, done: true, date: '2026-06-14', createdAt: '2026-06-14T08:00:00.000Z', completedAt: '2026-06-14T09:00:00.000Z', subtasks: [], level: '', isSpecial: false, specialPts: 0 },
      ],
      streak: 6, bestStreak: 6,
      ...noMorningPopups('2026-06-14'),
    })
    await page.clock.setFixedTime(new Date('2026-06-14T20:00:00'))
    await page.goto('/dashboard')

    await expect(page.getByText(/ready to submit!/)).toBeVisible()
    await page.getByRole('button', { name: '✓ Submit My Day' }).click({ force: true })
    await page.getByRole('button', { name: 'Confirm & lock' }).click()

    await page.getByRole('button', { name: 'Nice — keep going' }).click()

    // Each ritual step's own outgoing/incoming Modal briefly overlaps during
    // its exit/enter animation (each is a separate AnimatePresence), which
    // can put two "Skip" buttons in the DOM at once — scope each click to
    // its own step's dialog instead of a bare role query.
    const focusDialog = page.locator('.vx-modal-sheet').filter({ hasText: 'How focused was today?' })
    await expect(focusDialog).toBeVisible()
    await focusDialog.getByRole('button', { name: 'Skip' }).click()

    const lifestyleDialog = page.locator('.vx-modal-sheet').filter({ hasText: 'How was your day, really?' })
    await expect(lifestyleDialog).toBeVisible()
    await lifestyleDialog.getByRole('button', { name: 'Skip' }).click()

    const top3Dialog = page.locator('.vx-modal-sheet').filter({ hasText: "Tomorrow's Top 3" })
    await expect(top3Dialog).toBeVisible()
    await top3Dialog.getByRole('button', { name: 'Skip' }).click()

    await expect(page.getByRole('heading', { name: 'Weekly Review' })).toBeVisible()
    await expect(page.getByText(/Self Project/)).toBeVisible()
  })

  test('12. History shows a compact per-day check-in row (mood/sleep/movement/stress/focus)', async ({ page, context }) => {
    await setup(page)
    await setupAuthenticatedPage(page, context, {
      history: [{
        date: '2026-06-11', done: 2, total: 2, pct: 100, rxp: 40, mood: 'motivated', eodMood: 'proud',
        frozen: false, rest: false, auto: false, late: false, tasks: [], rewards: [],
      }],
      mood: { '2026-06-11': 'motivated' },
      lifestyleCheckins: { '2026-06-11': { sleep: 'great', moved: true, stress: 2, at: '2026-06-11T22:00:00.000Z' } },
      focusCheckins: { '2026-06-11': { score: 4, distractions: [], at: '2026-06-11T22:00:00.000Z' } },
    })
    await page.goto('/history')

    await page.getByText('Thu, 11 Jun').click() // opens the day accordion (formatDateShort, no year)
    await page.getByRole('button', { name: '🧭 Check-in' }).click()
    await expect(page.getByText('⚡ Motivated')).toBeVisible()
    await expect(page.getByText('😴 Great sleep')).toBeVisible()
    await expect(page.getByText('🏃 Moved')).toBeVisible()
    await expect(page.getByText('Stress 2/5')).toBeVisible()
    await expect(page.getByText('Focus 4/5')).toBeVisible()
  })
})
