import defaultsJson from '@/data/defaults.json'
import type { AppStateData, AppConfig } from './types'

export const STORAGE_KEY = 'kunals_planner_v2'

export const DEFAULT_CFG: AppConfig = defaultsJson.cfg as AppConfig

export const INITIAL_STATE: AppStateData = {
  tasks:     [],
  recurring: [],

  rankXP:       0,
  bufferXP:     0,
  rewardWallet: 0,

  streak:        0,
  bestStreak:    0,
  daysActive:    0,
  freezeTokens:  0,
  freezesUsed:   0,
  freezesBought: 0,
  pausedStreak:  null,

  weekDays:      {},
  frozenDays:    {},
  submittedDays: {},
  restDays:      {},
  weekRestUsed:  {},
  retroFixedDays: {},

  history:   [],
  bufferLog: [],
  rewardRedemptions: [],

  badges:     [],
  badgeDates: {},
  rewards:    defaultsJson.rewards,
  zones:      defaultsJson.zones,

  journal:    {},
  journalPin: null,
  journalPinQuestion:   null,
  journalPinAnswerHash: null,
  pinFailedAttempts: 0,
  pinLockoutUntil:   null,

  mood:            {},
  moodLockedUntil: {},
  eodMood:         {},

  pinnedTaskId:          null,
  engagementDays:        {},
  weeklyReviewDone:      {},
  lastActiveDayForDecay: null,
  morningQuoteShown:     {},
  appFirstUsed:          null,
  overnightMsg:          null,

  changeLog: [],

  cfg: DEFAULT_CFG,
}
