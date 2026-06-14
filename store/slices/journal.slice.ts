import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import { JOURNAL_XP }   from '@/constants/points'
import { pad }          from '@/lib/engine/cutoff'
import { PIN_LOCKOUT_THRESHOLD, PIN_LOCKOUT_MS } from '@/constants/points'

export interface JournalSlice {
  saveJournalEntry: (today: string, text: string, editKey?: string) => { isFirst: boolean }
  deleteJournalEntry: (key: string) => void
  setJournalPin:    (hash: string | null) => void
  setJournalSecurity: (hash: string, question: string, answerHash: string) => void
  recordPinFailure: () => void
  resetPinFailures: () => void
}

export const createJournalSlice: StateCreator<AppState, [], [], JournalSlice> = (set, get) => ({
  saveJournalEntry(today, text, editKey) {
    const s = get()

    if (editKey) {
      set(s2 => ({ journal: { ...s2.journal, [editKey]: text } }))
      return { isFirst: false }
    }

    const todayEntries = Object.keys(s.journal).filter(k => k.startsWith(today))
    const isFirst      = todayEntries.length === 0

    const now     = new Date()
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    let key       = `${today} ${timeStr}`
    if (s.journal[key]) key = `${today} ${timeStr}:${pad(now.getSeconds())}`

    set(s2 => ({
      journal: { ...s2.journal, [key]: text },
      rankXP:  isFirst ? s2.rankXP + JOURNAL_XP : s2.rankXP,
    }))

    return { isFirst }
  },

  deleteJournalEntry(key) {
    set(s => {
      const journal = { ...s.journal }
      delete journal[key]
      return { journal }
    })
  },

  setJournalPin(hash) {
    if (hash === null) {
      set({ journalPin: null, journalPinQuestion: null, journalPinAnswerHash: null })
    } else {
      set({ journalPin: hash })
    }
  },

  setJournalSecurity(hash, question, answerHash) {
    set({ journalPin: hash, journalPinQuestion: question, journalPinAnswerHash: answerHash })
  },

  recordPinFailure() {
    set(s => {
      const attempts = s.pinFailedAttempts + 1
      const lockout  = attempts >= PIN_LOCKOUT_THRESHOLD ? Date.now() + PIN_LOCKOUT_MS : s.pinLockoutUntil
      return { pinFailedAttempts: attempts, pinLockoutUntil: lockout }
    })
  },

  resetPinFailures() {
    set({ pinFailedAttempts: 0, pinLockoutUntil: null })
  },
})
