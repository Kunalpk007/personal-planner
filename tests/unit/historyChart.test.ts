import { describe, it, expect } from 'vitest'
import {
  buildDailyTrend, filterTrendRange, findBestWindow, compareToBaseline,
  buildMoodCorrelation, correlationCoefficient, linearRegression, summarizeMoodCorrelation,
  buildZoneBreakdown, buildHeatmap,
} from '@/lib/engine/historyChart'
import type { HistoryEntry, AppConfig } from '@/store/types'

const CFG: AppConfig = {
  minPts: 70, weekendPts: 20, cutoffHour: 1, tone: 'balanced', managerName: 'Manager',
  moodMot: 1.2, moodSick: 0.5, pomoDuration: 25, quoteMorning: true, quoteEvening: true,
  autoExportEnabled: false, theme: 'dark', fontScale: 'normal',
}

function makeEntry(date: string, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    date, done: 1, total: 1, pct: 100, rxp: 80, mood: 'neutral', eodMood: '',
    frozen: false, rest: false, auto: false, late: false, tasks: [], rewards: [],
    ...overrides,
  }
}

describe('buildDailyTrend', () => {
  it('sorts by date and computes target + metTarget', () => {
    const history = [
      makeEntry('2024-01-08', { rxp: 80, mood: 'neutral' }), // Monday, target 70
      makeEntry('2024-01-06', { rxp: 10, mood: 'neutral' }), // Saturday, target 20
    ]
    const trend = buildDailyTrend(history, CFG)
    expect(trend.map(p => p.date)).toEqual(['2024-01-06', '2024-01-08'])
    expect(trend[0]).toMatchObject({ target: 20, metTarget: false })
    expect(trend[1]).toMatchObject({ target: 70, metTarget: true })
  })

  it('returns empty array for empty history', () => {
    expect(buildDailyTrend([], CFG)).toEqual([])
  })
})

describe('filterTrendRange', () => {
  const trend = buildDailyTrend(
    ['01', '02', '03', '04', '05'].map(d => makeEntry(`2024-01-${d}`)),
    CFG
  )

  it('returns all when days is null', () => {
    expect(filterTrendRange(trend, null)).toHaveLength(5)
  })

  it('returns last N days', () => {
    expect(filterTrendRange(trend, 2).map(p => p.date)).toEqual(['2024-01-04', '2024-01-05'])
  })

  it('clamps when N exceeds length', () => {
    expect(filterTrendRange(trend, 100)).toHaveLength(5)
  })
})

describe('findBestWindow', () => {
  it('returns null when history is shorter than the window', () => {
    const trend = buildDailyTrend([makeEntry('2024-01-01')], CFG)
    expect(findBestWindow(trend, 7)).toBeNull()
  })

  it('finds the highest-total 7-day window', () => {
    const dates = Array.from({ length: 10 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`)
    const pts = [5, 5, 5, 5, 5, 5, 5, 90, 90, 90] // best window is the last 7 days
    const history = dates.map((d, i) => makeEntry(d, { rxp: pts[i] }))
    const trend = buildDailyTrend(history, CFG)
    const best = findBestWindow(trend, 7)
    expect(best).not.toBeNull()
    expect(best!.startDate).toBe('2024-01-04')
    expect(best!.endDate).toBe('2024-01-10')
  })

  it('keeps the earlier best window when a later window is not better', () => {
    const dates = Array.from({ length: 9 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`)
    const pts = [90, 90, 90, 90, 90, 90, 90, 5, 5] // best window is the first 7 days
    const history = dates.map((d, i) => makeEntry(d, { rxp: pts[i] }))
    const trend = buildDailyTrend(history, CFG)
    const best = findBestWindow(trend, 7)
    expect(best).not.toBeNull()
    expect(best!.startDate).toBe('2024-01-01')
    expect(best!.endDate).toBe('2024-01-07')
  })
})

describe('compareToBaseline', () => {
  it('returns null deltaPct when there is no prior data', () => {
    const trend = buildDailyTrend([makeEntry('2024-01-01', { rxp: 50 })], CFG)
    const cmp = compareToBaseline(trend, 7, 4)
    expect(cmp.deltaPct).toBeNull()
    expect(cmp.baselineAvg).toBe(0)
  })

  it('computes current total vs. prior average', () => {
    const dates = Array.from({ length: 14 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`)
    const pts = [...Array(7).fill(10), ...Array(7).fill(20)]
    const history = dates.map((d, i) => makeEntry(d, { rxp: pts[i] }))
    const trend = buildDailyTrend(history, CFG)
    const cmp = compareToBaseline(trend, 7, 4)
    expect(cmp.currentTotal).toBe(140)
    expect(cmp.baselineAvg).toBe(70)
    expect(cmp.deltaPct).toBe(100)
  })

  it('returns null deltaPct when a non-empty prior window has a zero baseline average', () => {
    const dates = Array.from({ length: 14 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`)
    const pts = [...Array(7).fill(0), ...Array(7).fill(20)]
    const history = dates.map((d, i) => makeEntry(d, { rxp: pts[i] }))
    const trend = buildDailyTrend(history, CFG)
    const cmp = compareToBaseline(trend, 7, 4)
    expect(cmp.baselineAvg).toBe(0)
    expect(cmp.deltaPct).toBeNull()
  })
})

describe('buildMoodCorrelation', () => {
  it('filters out entries without a recognized mood and sorts by date', () => {
    const history = [
      makeEntry('2024-01-02', { mood: 'motivated', rxp: 90 }),
      makeEntry('2024-01-01', { mood: '', rxp: 10 }),
      makeEntry('2024-01-03', { mood: 'sick', rxp: 20 }),
    ]
    const points = buildMoodCorrelation(history)
    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ date: '2024-01-02', moodScore: 2 })
    expect(points[1]).toMatchObject({ date: '2024-01-03', moodScore: 0 })
  })
})

describe('correlationCoefficient', () => {
  it('returns null for fewer than 2 points', () => {
    expect(correlationCoefficient([{ x: 1, y: 1 }])).toBeNull()
  })

  it('returns null when one axis has zero variance', () => {
    expect(correlationCoefficient([{ x: 1, y: 5 }, { x: 1, y: 10 }])).toBeNull()
  })

  it('returns 1 for perfectly correlated data', () => {
    const points = [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }]
    expect(correlationCoefficient(points)).toBeCloseTo(1)
  })

  it('returns -1 for perfectly inversely correlated data', () => {
    const points = [{ x: 0, y: 20 }, { x: 1, y: 10 }, { x: 2, y: 0 }]
    expect(correlationCoefficient(points)).toBeCloseTo(-1)
  })
})

describe('linearRegression', () => {
  it('returns null for fewer than 2 points', () => {
    expect(linearRegression([{ x: 1, y: 1 }])).toBeNull()
  })

  it('returns null when x has zero variance', () => {
    expect(linearRegression([{ x: 1, y: 5 }, { x: 1, y: 10 }])).toBeNull()
  })

  it('fits a line through simple linear data', () => {
    const points = [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }]
    const fit = linearRegression(points)
    expect(fit).not.toBeNull()
    expect(fit!.slope).toBeCloseTo(10)
    expect(fit!.intercept).toBeCloseTo(0)
  })
})

describe('summarizeMoodCorrelation', () => {
  it('reports insufficient data when fewer than needed moods are present', () => {
    const summary = summarizeMoodCorrelation([{ date: '2024-01-01', mood: 'motivated', moodScore: 2, pts: 50 }])
    expect(summary.sentence).toMatch(/Not enough mood data/)
  })

  it('reports a positive delta sentence when motivated days clearly outperform neutral', () => {
    const points = [
      { date: '2024-01-01', mood: 'motivated', moodScore: 2, pts: 100 },
      { date: '2024-01-02', mood: 'motivated', moodScore: 2, pts: 100 },
      { date: '2024-01-03', mood: 'neutral', moodScore: 1, pts: 50 },
      { date: '2024-01-04', mood: 'neutral', moodScore: 1, pts: 50 },
    ]
    const summary = summarizeMoodCorrelation(points)
    expect(summary.sentence).toMatch(/more pts/)
    expect(summary.avgByMood.motivated).toBe(100)
    expect(summary.avgByMood.neutral).toBe(50)
    expect(summary.r).not.toBeNull()
  })

  it('reports a negative-direction sentence when motivated days underperform', () => {
    const points = [
      { date: '2024-01-01', mood: 'motivated', moodScore: 2, pts: 20 },
      { date: '2024-01-02', mood: 'neutral', moodScore: 1, pts: 50 },
    ]
    const summary = summarizeMoodCorrelation(points)
    expect(summary.sentence).toMatch(/fewer pts/)
  })

  it('reports no strong link when the difference is small', () => {
    const points = [
      { date: '2024-01-01', mood: 'motivated', moodScore: 2, pts: 52 },
      { date: '2024-01-02', mood: 'neutral', moodScore: 1, pts: 50 },
    ]
    const summary = summarizeMoodCorrelation(points)
    expect(summary.sentence).toMatch(/No strong link/)
  })
})

describe('buildZoneBreakdown', () => {
  it('buckets completed tasks by zone into Monday-start weeks', () => {
    const history: HistoryEntry[] = [
      makeEntry('2024-01-08', { // Monday
        tasks: [
          { title: 'a', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' },
          { title: 'b', priority: 'low', done: false, zone: 'Health', completedAt: null, level: '' },
          { title: 'c', priority: 'med', done: true, zone: 'Work', completedAt: null, level: '' },
        ],
      }),
      makeEntry('2024-01-09', { // same week
        tasks: [
          { title: 'd', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' },
        ],
      }),
    ]
    const weeks = buildZoneBreakdown(history)
    expect(weeks).toHaveLength(1)
    expect(weeks[0].weekStart).toBe('2024-01-08')
    expect(weeks[0].zones).toEqual({ Health: 2, Work: 1 })
  })

  it('buckets a Sunday date into the Monday of that same week', () => {
    const history: HistoryEntry[] = [
      makeEntry('2024-01-07', { // Sunday — belongs to the week starting 2024-01-01 (Monday)
        tasks: [{ title: 'a', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' }],
      }),
    ]
    const weeks = buildZoneBreakdown(history)
    expect(weeks).toHaveLength(1)
    expect(weeks[0].weekStart).toBe('2024-01-01')
  })

  it('sorts weeks chronologically even when history is given newest-first', () => {
    const history: HistoryEntry[] = [
      makeEntry('2024-01-15', { tasks: [{ title: 'b', priority: 'high', done: true, zone: 'Work', completedAt: null, level: '' }] }),
      makeEntry('2024-01-08', { tasks: [{ title: 'a', priority: 'high', done: true, zone: 'Health', completedAt: null, level: '' }] }),
    ]
    const weeks = buildZoneBreakdown(history)
    expect(weeks.map(w => w.weekStart)).toEqual(['2024-01-08', '2024-01-15'])
  })

  it('falls back to "Unassigned" when zone is empty', () => {
    const history: HistoryEntry[] = [
      makeEntry('2024-01-08', {
        tasks: [{ title: 'a', priority: 'high', done: true, zone: '', completedAt: null, level: '' }],
      }),
    ]
    expect(buildZoneBreakdown(history)[0].zones).toEqual({ Unassigned: 1 })
  })

  it('returns empty array for empty history', () => {
    expect(buildZoneBreakdown([])).toEqual([])
  })

  it('treats a missing tasks array as no tasks for that day', () => {
    const history = [makeEntry('2024-01-08', {})]
    delete (history[0] as { tasks?: unknown }).tasks
    const weeks = buildZoneBreakdown(history)
    expect(weeks).toHaveLength(1)
    expect(weeks[0].zones).toEqual({})
  })
})

describe('buildHeatmap', () => {
  it('returns empty array for empty history', () => {
    expect(buildHeatmap([], '2024-01-10')).toEqual([])
  })

  it('fills gaps between entries with null pct', () => {
    const history = [makeEntry('2024-01-01', { pct: 50 }), makeEntry('2024-01-03', { pct: 100 })]
    const days = buildHeatmap(history, '2024-01-03')
    expect(days).toHaveLength(3)
    expect(days[0]).toEqual({ date: '2024-01-01', pct: 50 })
    expect(days[1]).toEqual({ date: '2024-01-02', pct: null })
    expect(days[2]).toEqual({ date: '2024-01-03', pct: 100 })
  })
})
