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
  pendingRewardApprovals: [],
  focusSessions: [],

  badges:     [],
  badgeDates: {},
  rewards:    defaultsJson.rewards,
  zones:      defaultsJson.zones,
  goals:      [],

  journal:    {},
  journalPin: null,
  journalPinQuestion:   null,
  journalPinAnswerHash: null,
  journalPinLength:  null,
  pinFailedAttempts: 0,
  pinLockoutUntil:   null,
  journalEncryptionToken: null,

  mood:            {},
  eodMood:         {},
  moodCheckins:    0,
  moodChangeLog:   [],
  waterMl:         {},

  pinnedTaskId:          null,
  engagementDays:        {},
  weeklyReviewDone:      {},
  morningQuoteShown:     {},
  appFirstUsed:          null,
  overnightMsg:          null,
  lastShowedUpBonus:     null,

  changeLog: [],

  cfg: DEFAULT_CFG,

  lastModified: null,
}
