import type { StateCreator } from 'zustand'
import type { AppState, FocusCheckin, DistractionTag, LifestyleCheckin, SleepQuality, TomorrowTop3Item } from '../types'

const MAX_CHANGE_LOG = 500

export interface UISlice {
  clearOvernightMsg:        () => void
  markMorningQuoteShown:    (date: string) => void
  markMorningTop3Shown:     (date: string) => void
  setWeeklyReviewDone:      (weekStart: string, review: { whatWorked: string; whatDidnt: string; oneChange: string }) => void
  setFocusCheckin:          (date: string, score: FocusCheckin['score'], distractions: DistractionTag[]) => void
  setLifestyleCheckin:      (date: string, sleep: SleepQuality, moved: boolean, stress: LifestyleCheckin['stress']) => void
  setTomorrowTop3:          (date: string, items: TomorrowTop3Item[]) => void
  markEngagementDay:        (date: string) => void
  setAppFirstUsed:          (date: string) => void
  applyOvernightPatch:      (patch: Partial<AppState>) => void
  logChange:                (action: string, detail: string) => void
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  clearOvernightMsg() {
    set({ overnightMsg: null })
  },

  markMorningQuoteShown(date) {
    set(s => ({ morningQuoteShown: { ...s.morningQuoteShown, [date]: true } }))
  },

  markMorningTop3Shown(date) {
    set(s => ({ morningTop3Shown: { ...s.morningTop3Shown, [date]: true } }))
  },

  setWeeklyReviewDone(weekStart, review) {
    set(s => ({
      weeklyReviewDone: {
        ...s.weeklyReviewDone,
        [weekStart]: { ...review, at: new Date().toISOString() },
      },
    }))
  },

  setFocusCheckin(date, score, distractions) {
    set(s => ({
      focusCheckins: {
        ...s.focusCheckins,
        [date]: { score, distractions, at: new Date().toISOString() },
      },
    }))
  },

  setLifestyleCheckin(date, sleep, moved, stress) {
    set(s => ({
      lifestyleCheckins: {
        ...s.lifestyleCheckins,
        [date]: { sleep, moved, stress, at: new Date().toISOString() },
      },
    }))
  },

  setTomorrowTop3(date, items) {
    set(s => ({
      tomorrowTop3: {
        ...s.tomorrowTop3,
        [date]: { items: items.slice(0, 3), at: new Date().toISOString() },
      },
    }))
  },

  markEngagementDay(date) {
    set(s => ({ engagementDays: { ...s.engagementDays, [date]: true } }))
  },

  setAppFirstUsed(date) {
    set(s => ({ appFirstUsed: s.appFirstUsed ?? date }))
  },

  applyOvernightPatch(patch) {
    set(patch)
  },

  logChange(action, detail) {
    set(s => ({
      changeLog: [...s.changeLog, { ts: new Date().toISOString(), action, detail }].slice(-MAX_CHANGE_LOG),
    }))
  },
})
