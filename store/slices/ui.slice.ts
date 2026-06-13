import type { StateCreator } from 'zustand'
import type { AppState } from '../types'

const MAX_CHANGE_LOG = 500

export interface UISlice {
  clearOvernightMsg:        () => void
  markMorningQuoteShown:    (date: string) => void
  setWeeklyReviewDone:      (date: string, reflection: string) => void
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

  setWeeklyReviewDone(date, reflection) {
    set(s => ({
      weeklyReviewDone: {
        ...s.weeklyReviewDone,
        [date]: { reflection, at: new Date().toISOString() },
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
