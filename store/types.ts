// ─── Core domain types ───────────────────────────────────────────────────────

export type Priority  = 'high' | 'med' | 'low' | 'special'
export type Mood      = 'motivated' | 'neutral' | 'sick'
export type EodMood   = 'motivated' | 'neutral' | 'tired' | 'content'
export type Slot      = 'morning' | 'afternoon' | 'evening' | 'night' | ''
export type Tone      = 'balanced' | 'strict' | 'encouraging'
export type Level     = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | ''

export interface Subtask {
  id:    string
  title: string
  done:  boolean
}

export interface Task {
  id:          string
  title:       string
  note:        string
  zone:        string
  priority:    Priority
  slot:        Slot
  deadline:    string | null
  done:        boolean
  date:        string
  createdAt:   string
  completedAt: string | null
  recurId?:    string
  subtasks:    Subtask[]
  level:       Level
  isSpecial:   boolean
  specialPts:  number
  specialCat?: Priority
  carriedDays?: number
}

export interface RecurringTemplate {
  id:         string
  title:      string
  note:       string
  zone:       string
  priority:   Priority
  slot:       Slot
  level:      Level
  isSpecial:  boolean
  specialPts: number
}

export interface Zone {
  id:    string
  name:  string
  color: string
}

export interface Reward {
  id:    string
  title: string
  cost:  number
}

export interface Badge {
  id:    string
  label: string
  icon:  string
  date:  string
}

export interface HistoryEntry {
  date:     string
  done:     number
  total:    number
  pct:      number
  rxp:      number
  mood:     string
  eodMood:  string
  frozen:   boolean
  rest:     boolean
  auto:     boolean
  late:     boolean
  tasks:    Array<{
    title:       string
    priority:    string
    done:        boolean
    zone:        string
    completedAt: string | null
    level:       string
  }>
  rewards:  string[]
}

export interface PausedStreak {
  date:          string
  reason:        string
  streakAtPause: number
}

export type ThemeMode = 'light' | 'dark'

export interface AppConfig {
  minPts:       number
  weekendPts:   number
  cutoffHour:   number
  tone:         Tone
  managerName:  string
  moodMot:      number
  moodSick:     number
  pomoDuration: number
  quoteMorning: boolean
  quoteEvening: boolean
  autoExportEnabled: boolean
  theme:        ThemeMode
}

// ─── State-only (persisted data) ─────────────────────────────────────────────

export interface AppStateData {
  tasks:     Task[]
  recurring: RecurringTemplate[]

  rankXP:       number
  bufferXP:     number
  rewardWallet: number

  streak:        number
  bestStreak:    number
  daysActive:    number
  freezeTokens:  number
  freezesUsed:   number
  freezesBought: number
  pausedStreak:  PausedStreak | null

  weekDays:      Record<string, boolean>
  frozenDays:    Record<string, boolean>
  submittedDays: Record<string, boolean>
  restDays:      Record<string, boolean>
  weekRestUsed:  Record<string, boolean>

  history:   HistoryEntry[]
  bufferLog: Array<{ date: string; note: string; xp: string; type: string }>
  rewardRedemptions: Array<{ date: string; title: string; cost: number; at: string }>

  badges:     Badge[]
  badgeDates: Record<string, string>
  rewards:    Reward[]
  zones:      Zone[]

  journal:    Record<string, string>
  journalPin: string | null
  journalPinQuestion:   string | null
  journalPinAnswerHash: string | null

  mood:            Record<string, Mood>
  moodLockedUntil: Record<string, string>
  eodMood:         Record<string, EodMood>

  pinnedTaskId:          string | null
  engagementDays:        Record<string, boolean>
  weeklyReviewDone:      Record<string, { reflection: string; at: string }>
  lastActiveDayForDecay: string | null
  morningQuoteShown:     Record<string, boolean>
  appFirstUsed:          string | null
  overnightMsg:          string | null

  changeLog: ChangeLogEntry[]

  cfg: AppConfig
}

export interface ChangeLogEntry {
  ts:     string
  action: string
  detail: string
}

// ─── Actions (all slice methods merged) ──────────────────────────────────────

export interface AppActions {
  // Tasks
  addTask:               (task: Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>) => void
  removeTask:            (id: string) => void
  toggleTask:            (id: string) => { pts: number; walletPts: number } | null
  toggleTaskRetro:       (id: string) => { pts: number; walletPts: number } | null
  editTask:              (id: string, updates: Partial<Task>) => void
  pinTask:               (id: string | null) => void
  toggleSubtask:         (taskId: string, subId: string) => void
  addSubtask:            (taskId: string, title: string) => void
  removeSubtask:         (taskId: string, subId: string) => void
  addRecurring:          (r: Omit<RecurringTemplate, 'id'>) => void
  removeRecurring:       (id: string) => void
  editRecurring:         (id: string, updates: Partial<RecurringTemplate>) => void
  injectRecurring:       (today: string) => void
  carryTask:             (taskId: string, tomorrowKey: string) => void
  processExpiredCarries: () => void

  // Streak
  submitDay:         (entry: HistoryEntry) => { freezeBonus: number; milestoneStreak: number | null }
  useFreeze:         (today: string) => void
  buyFreeze:         () => boolean
  useBuffer:         (amount: number) => void
  pauseStreak:       (reason: string) => void
  restoreStreak:     () => void
  checkPausedExpiry: () => void
  invalidateStreak:  () => void
  resetRankXP:       () => void
  declareRestDay:    (today: string) => void

  // Rewards
  addReward:    (r: Omit<Reward, 'id'>) => void
  removeReward: (id: string) => void
  redeemReward: (id: string, today: string) => boolean
  addZone:      (name: string, color: string) => void
  removeZone:   (id: string) => void

  // Journal
  saveJournalEntry:   (today: string, text: string, editKey?: string) => { isFirst: boolean }
  deleteJournalEntry: (key: string) => void
  setJournalPin:      (hash: string | null) => void
  setJournalSecurity: (hash: string, question: string, answerHash: string) => void

  // Config
  setConfig:    (updates: Partial<AppConfig>) => void
  setMood:      (today: string, mood: Mood) => void
  setEodMood:   (today: string, mood: string) => void
  setPinnedTask: (id: string | null) => void

  // UI
  clearOvernightMsg:     () => void
  markMorningQuoteShown: (date: string) => void
  setWeeklyReviewDone:   (date: string, reflection: string) => void
  markEngagementDay:     (date: string) => void
  setAppFirstUsed:       (date: string) => void
  applyOvernightPatch:   (patch: Partial<AppStateData>) => void
  logChange:             (action: string, detail: string) => void
}

// ─── Full store type = data + actions ────────────────────────────────────────

export type AppState = AppStateData & AppActions
