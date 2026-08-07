import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import { JOURNAL_XP, WALLET_RATIO, PIN_LENGTH } from '@/constants/points'
import { pad }          from '@/lib/engine/cutoff'
import { checkJournalMilestone } from '@/lib/engine/badges'
import { PIN_LOCKOUT_THRESHOLD, PIN_LOCKOUT_MS } from '@/constants/points'

export interface JournalSlice {
  saveJournalEntry: (today: string, text: string, editKey?: string) => { isFirst: boolean }
  deleteJournalEntry: (key: string) => void
  setJournalPin:    (hash: string | null) => void
  setJournalSecurity: (hash: string, question: string, answerHash: string) => void
  recordPinFailure: () => void
  resetPinFailures: () => void
  setJournalEncryptionToken: (token: string | null) => void
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

    const walletBonus = Math.floor(JOURNAL_XP / WALLET_RATIO)
    set(s2 => {
      let badges = s2.badges
      if (isFirst) {
        // Every prior key belongs to a distinct day already covered by
        // isFirst's "no entries yet today" check, so +1 for today is exact.
        const journalDays = new Set(Object.keys(s2.journal).map(k => k.slice(0, 10))).size + 1
        const milestone = checkJournalMilestone(journalDays)
        if (milestone && !badges.some(b => b.id === milestone.id)) {
          badges = [...badges, { ...milestone, date: today }]
        }
      }
      return {
        journal:      { ...s2.journal, [key]: text },
        rankXP:       isFirst ? s2.rankXP + JOURNAL_XP : s2.rankXP,
        rewardWallet: isFirst ? s2.rewardWallet + walletBonus : s2.rewardWallet,
        badges,
      }
    })

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
      set({ journalPin: null, journalPinQuestion: null, journalPinAnswerHash: null, journalPinLength: null })
    } else {
      set({ journalPin: hash, journalPinLength: PIN_LENGTH })
    }
  },

  setJournalSecurity(hash, question, answerHash) {
    set({ journalPin: hash, journalPinQuestion: question, journalPinAnswerHash: answerHash, journalPinLength: PIN_LENGTH })
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

  setJournalEncryptionToken(token) {
    set({ journalEncryptionToken: token })
  },
})
