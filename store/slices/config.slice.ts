import type { StateCreator } from 'zustand'
import type { AppState, AppConfig, Mood } from '../types'

export interface ConfigSlice {
  setConfig:    (updates: Partial<AppConfig>) => void
  setMood:      (today: string, mood: Mood) => void
  setEodMood:   (today: string, mood: string) => void
  setPinnedTask:(id: string | null) => void
}

export const createConfigSlice: StateCreator<AppState, [], [], ConfigSlice> = (set, get) => ({
  setConfig(updates) {
    set(s => ({ cfg: { ...s.cfg, ...updates } }))
  },

  setMood(today, mood) {
    const now = new Date()
    // Lock immediately if after noon, 2hr grace if before noon
    const lockUntil = now.getHours() >= 12
      ? new Date(now.getTime() + 5000).toISOString()
      : new Date(now.getTime() + 2 * 3600000).toISOString()

    set(s => ({
      mood:            { ...s.mood,            [today]: mood },
      moodLockedUntil: { ...s.moodLockedUntil, [today]: lockUntil },
    }))
  },

  setEodMood(today, mood) {
    set(s => ({ eodMood: { ...s.eodMood, [today]: mood as any } }))
  },

  setPinnedTask(id) {
    set({ pinnedTaskId: id })
  },
})
