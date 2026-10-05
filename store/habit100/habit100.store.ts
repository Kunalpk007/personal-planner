'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Habit100Day, Habit100Meta, Habit100Value, Habit100Week, HabitDef } from './types'

/** Consistency Tracker's own store — deliberately NOT merged into
 *  usePlannerStore and NOT using its sync pipeline (see lib/firebase/
 *  habit100.ts's header comment: own per-day/per-week Firestore docs,
 *  own debounced sync in lib/habit100/sync.ts). Offline-first via Zustand's
 *  own `persist`, same as the main store, but under its own storage key.
 *
 *  Single fixed storage key (not per-uid scoped like the main store) —
 *  this app is built for one person; the main store's per-uid scoping
 *  exists for its anonymous-to-signed-in migration history, which this
 *  fully-separate, newer feature has no need to replicate. */
const STORAGE_KEY = 'habit100_v1'

export interface Habit100State {
  uid:    string | null
  loaded: boolean
  meta:   Habit100Meta | null
  days:   Record<string, Habit100Day>
  weeks:  Record<number, Habit100Week>

  init:               (uid: string | null) => void
  setupTracker:       (habits: HabitDef[], startDate: string, disciplinedThresholdPct: number, goals: string[], totalDays: number) => void
  setDayValue:        (date: string, habitId: string, value: Habit100Value | undefined) => void
  setDayExtra:        (date: string, field: 'mood' | 'energy' | 'stress' | 'anxiety' | 'sleepHours' | 'weight' | 'gratitude' | 'wrong', value: number | string | undefined) => void
  lockDay:            (date: string) => void
  saveWeeklyReview:   (weekIndex: number, worked: string, change: string) => void
  unlockMilestone:    (day: number) => void
  resetTracker:       () => void
  /** Merges a Firestore snapshot into local state on load — last-write-wins
   *  per doc via `updatedAt`, mirroring the main app's cloud-vs-local merge
   *  philosophy (see StoreBootstrap.tsx) at a much smaller scale. */
  mergeFromCloud:     (meta: Habit100Meta | null, days: Habit100Day[], weeks: Habit100Week[]) => void
}

/** Only meta/days/weeks persist to localStorage — `uid`/`loaded` are
 *  session-derived, re-set by init() on every load. Named + exported so it
 *  can be unit-tested directly rather than relying on zustand persist's own
 *  internal write-scheduling to exercise it. */
export function partializeHabit100(s: Habit100State): Pick<Habit100State, 'meta' | 'days' | 'weeks'> {
  return { meta: s.meta, days: s.days, weeks: s.weeks }
}

function ensureDay(days: Record<string, Habit100Day>, date: string): Habit100Day {
  return days[date] ?? { date, values: {}, locked: false, updatedAt: new Date().toISOString() }
}

export const useHabit100Store = create<Habit100State>()(
  persist(
    (set, get) => ({
      uid: null,
      loaded: false,
      meta: null,
      days: {},
      weeks: {},

      init(uid) {
        set({ uid, loaded: true })
      },

      setupTracker(habits, startDate, disciplinedThresholdPct, goals, totalDays) {
        const now = new Date().toISOString()
        const meta: Habit100Meta = {
          startDate, totalDays, disciplinedThresholdPct,
          habits, goals: goals.slice(0, 3), badges: [],
          createdAt: now, updatedAt: now,
        }
        set({ meta })
      },

      setDayValue(date, habitId, value) {
        set(s => {
          const day = ensureDay(s.days, date)
          if (day.locked) return s
          const values = { ...day.values }
          if (value === undefined || value === '') delete values[habitId]
          else values[habitId] = value
          return { days: { ...s.days, [date]: { ...day, values, updatedAt: new Date().toISOString() } } }
        })
      },

      setDayExtra(date, field, value) {
        set(s => {
          const day = ensureDay(s.days, date)
          if (day.locked) return s
          const updated: Habit100Day = { ...day, updatedAt: new Date().toISOString() }
          const bag = updated as unknown as Record<string, unknown>
          if (value === undefined || value === '') delete bag[field]
          else bag[field] = value
          return { days: { ...s.days, [date]: updated } }
        })
      },

      lockDay(date) {
        set(s => {
          const day = ensureDay(s.days, date)
          return { days: { ...s.days, [date]: { ...day, locked: true, updatedAt: new Date().toISOString() } } }
        })
      },

      saveWeeklyReview(weekIndex, worked, change) {
        set(s => ({
          weeks: { ...s.weeks, [weekIndex]: { weekIndex, worked, change, updatedAt: new Date().toISOString() } },
        }))
      },

      unlockMilestone(day) {
        set(s => {
          if (!s.meta || s.meta.badges.includes(day)) return s
          return { meta: { ...s.meta, badges: [...s.meta.badges, day], updatedAt: new Date().toISOString() } }
        })
      },

      resetTracker() {
        set({ meta: null, days: {}, weeks: {} })
      },

      mergeFromCloud(cloudMeta, cloudDays, cloudWeeks) {
        set(s => {
          const meta = !s.meta || (cloudMeta && cloudMeta.updatedAt > s.meta.updatedAt) ? cloudMeta : s.meta
          const days = { ...s.days }
          for (const d of cloudDays) {
            const local = days[d.date]
            if (!local || d.updatedAt > local.updatedAt) days[d.date] = d
          }
          const weeks = { ...s.weeks }
          for (const w of cloudWeeks) {
            const local = weeks[w.weekIndex]
            if (!local || w.updatedAt > local.updatedAt) weeks[w.weekIndex] = w
          }
          return { meta, days, weeks }
        })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: partializeHabit100,
    }
  )
)
