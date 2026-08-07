// ─── Core domain types ───────────────────────────────────────────────────────

export type Priority  = 'high' | 'med' | 'low' | 'special'
export type Mood      = 'motivated' | 'neutral' | 'sick'
export type EodMood   = 'motivated' | 'neutral' | 'tired' | 'content' | 'sad' | 'anxious' | 'proud' | 'frustrated'
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
  blocked?:    boolean
  blockedByTaskId?: string
  blockedByTitle?:  string

  /** Section 1.3/1.4 of docs/PHASE2_SOCIAL_LIFE_OS.md — a task the owner has
   *  opted to require a friend's sign-off on. Checking it off does NOT set
   *  `done`/award points by itself while `validationStatus` is 'pending' or
   *  unset — see requestTaskValidation/resolveTaskValidation in
   *  store/slices/tasks.slice.ts. `done` only flips true once the validator
   *  approves, which is what "withhold points until approved" means in
   *  practice: this task is simply invisible to the scoring engine
   *  (todayEarned et al. only sum done tasks) until then. */
  needsValidation?:  boolean
  validatorUid?:      string
  validatorName?:      string
  validationStatus?: 'pending' | 'approved' | 'rejected'
  validationNote?:    string | null

  /** Set when this task was created locally from an accepted friend
   *  challenge (see store/social/social.store.ts#acceptChallenge) — purely
   *  cosmetic (shows "Challenged by {name}" on the task row), does not
   *  affect scoring. The task counts toward the recipient's own points like
   *  any other task once completed. */
  challengedBy?: string
  challengeId?:  string

  /** Set when a challenged task is cancelled (with a reason) rather than
   *  completed or deleted — see cancelTask in store/slices/tasks.slice.ts.
   *  Cancelled tasks drop out of the active day list, same as completed
   *  goals, but the record (and reason) is kept for the challenger's
   *  notification rather than being destroyed like a plain delete. */
  cancelledAt?:  string | null
  cancelReason?: string
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
  /** Manual Life Score weight (Section 4 of docs/PHASE2_SOCIAL_LIFE_OS.md —
   *  user explicitly chose manual weights over auto-derived ones). Undefined
   *  is treated as 1 (equal weight) so existing zones need no migration. */
  weight?: number
}

export interface Reward {
  id:    string
  title: string
  cost:  number
  /** Section 1.5b of docs/PHASE2_SOCIAL_LIFE_OS.md — flagged by the user as
   *  linked to a habit they're actively trying to reduce (e.g. a cheap
   *  "Drink tea" reward). Always gets a cooldown before redemption finalizes,
   *  regardless of cost — this is a self-control friction device, a
   *  different threat model than the cost-based anti-cheat gate. */
  habitLinked?:        boolean
  habitCooldownHours?: number   // 6-12, default HABIT_FLAG_COOLDOWN_HOURS
}

export type RewardApprovalGate  = 'cost' | 'habit'
export type PendingApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

/** A completed Dashboard Focus Time session (see constants/points.ts's
 *  FOCUS_REWARDS) — logged so today's total focus time/reward can be shown
 *  and so a session can never be double-counted (see completeFocusSession). */
export interface FocusSessionLog {
  date:    string        // day-key the session was completed on
  minutes: 25 | 45 | 60
  pts:     number
  xp:      number
  at:      string        // ISO completion timestamp
}

/** Local (offline-first) mirror of the owner's own pending reward-approval
 *  requests — see store/slices/rewardApprovals.slice.ts. The authoritative
 *  approve/reject action happens on the Notary's device via the Firestore
 *  `rewardApprovals` collection (lib/firebase/social.ts); this local copy is
 *  what lets the wallet pts stay locked and the UI show "pending" even
 *  offline, and is reconciled from Firestore once a listener resolves it. */
export interface PendingRewardApproval {
  id:             string   // matches the Firestore rewardApprovals doc id once synced
  rewardId:       string
  title:          string
  cost:           number
  gate:           RewardApprovalGate
  notaryUid:      string
  notaryName:     string
  status:         PendingApprovalStatus
  createdAt:      string
  cooldownEndsAt: string
}

export type GoalCadence   = 'weekly' | 'monthly'
/** 'checklist' — the goal consists of an explicit set of tasks (see
 *  GoalChecklistItem) rather than an aggregate points/task-count threshold.
 *  Progress = items checked / total items, independent of cadence. */
export type GoalTargetType = 'points' | 'taskCount' | 'checklist'

export interface GoalChecklistItem {
  id:    string
  title: string
  done:  boolean
  /** Per-subtask points, only meaningful when the goal's pointsMode is
   *  'perSubtask' — each completed subtask awards these points. */
  points?: number
}

/** How a goal awards points on completion:
 *  - 'whole'      → one point value for finishing the whole goal (Goal.points)
 *  - 'perSubtask' → each subtask carries its own points (GoalChecklistItem.points),
 *                   awarded as each is checked off. */
export type GoalPointsMode = 'whole' | 'perSubtask'

/** A user-defined Goal — Section 3 of docs/PHASE2_SOCIAL_LIFE_OS.md.
 *  Only the *definition* is stored here. Progress is always derived at
 *  render time from history[]/tasks[] (see lib/engine/goals.ts) and is
 *  never separately persisted, so it can't drift out of sync with the
 *  underlying task data. */
export interface Goal {
  id:         string
  title:      string
  cadence:    GoalCadence
  zoneId?:    string   // omitted = across all zones
  targetType: GoalTargetType
  target:     number   // for 'checklist' goals, kept in sync with checklist.length
  createdAt:  string

  /** Only present when targetType === 'checklist' — the specific tasks that
   *  make up this goal. Checked independently of the daily Tasks list (a
   *  goal-scoped checklist, not a proxy for today's tasks). */
  checklist?: GoalChecklistItem[]

  /** Optional explicit deadline (ISO date, YYYY-MM-DD). Set automatically on
   *  goals created from an accepted friend challenge (see
   *  store/social/social.store.ts#acceptChallenge and
   *  store/slices/goals.slice.ts#addChallengeGoal); also settable manually.
   *  When present it's purely informational (a "due by" display) — it does
   *  not gate progress computation. */
  endDate?: string

  /** Set when this goal was created from an accepted friend challenge —
   *  mirrors Task.challengedBy, purely cosmetic. */
  challengedBy?: string
  /** The SharedTask doc id this goal was created from (mirrors
   *  Task.challengeId) — lets social.store.ts push completion/cancellation
   *  back to the challenger. Undefined for goals not created via a
   *  challenge, or ones created before this field existed. */
  challengeId?: string

  /** Set when the goal is cancelled (with a reason) instead of completed —
   *  see cancelGoal in store/slices/goals.slice.ts. A cancelled goal drops
   *  out of the active goals list, same as a completed one. */
  cancelledAt?:  string | null
  cancelReason?: string

  // ── Goals-as-tasks (Session 8 revamp) ──────────────────────────────────
  /** How this goal scores. Undefined behaves like 'whole' for back-compat. */
  pointsMode?: GoalPointsMode
  /** Whole-goal points (pointsMode 'whole'): awarded once the goal completes. */
  points?: number
  /** Points earned if the goal is completed AFTER its deadline. For friend
   *  challenge goals the giver sets this; for own goals it defaults to half
   *  of the full points. */
  delayPoints?: number
  /** Free-text note attached to the goal (editable from the goal tile). */
  note?: string
  /** ISO timestamp when the goal was completed (all subtasks done + confirmed),
   *  or null/undefined while still open. A goal cannot complete until every
   *  checklist item is done. */
  completedAt?: string | null
  /** Rank XP actually awarded at completion (post deadline-reduction) —
   *  snapshotted so later date-scoped lookups (e.g. today's submit-gate
   *  total) don't have to re-derive it, which would drift once the deadline
   *  has since passed. */
  awardedPts?: number
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

export type ThemeMode = 'light' | 'dark' | 'cream'
export type FontScale = 'normal' | 'large' | 'xlarge'

export interface AppConfig {
  minPts:       number
  weekendPts:   number
  /** Day-of-week indices (0=Sun..6=Sat) that use the reduced `weekendPts`
   *  target instead of `minPts` — user-configurable, defaults to Sat/Sun. */
  lightDays:    number[]
  /** ISO timestamp of the last time `lightDays` was actually changed —
   *  gates Settings to at most one change per Monday-start calendar week
   *  (see lib/engine/cutoff.ts#isoWeekKey and Settings' light-day picker). */
  lightDaysChangedAt: string | null
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
  fontScale:    FontScale
  /** Daily water intake target, in millilitres — configurable in Settings.
   *  Drives both the Water Intake stat tile's "of Xl" label and the
   *  celebration animation shown once today's intake meets/exceeds it. */
  waterTargetMl: number
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
  retroFixedDays: Record<string, boolean>

  history:   HistoryEntry[]
  bufferLog: Array<{ date: string; note: string; xp: string; type: string }>
  rewardRedemptions: Array<{ date: string; title: string; cost: number; at: string }>
  pendingRewardApprovals: PendingRewardApproval[]
  focusSessions: FocusSessionLog[]

  badges:     Badge[]
  badgeDates: Record<string, string>
  rewards:    Reward[]
  zones:      Zone[]
  goals:      Goal[]

  journal:    Record<string, string>
  journalPin: string | null
  journalPinQuestion:   string | null
  journalPinAnswerHash: string | null
  /** Digit count the current journalPin hash was created with — used to
   *  detect a pre-upgrade 5-digit PIN that needs the migrate-to-6-digit flow
   *  in ui/PinGate.tsx. null (never set) is treated as legacy/5-digit for any
   *  existing user with a pin from before this field existed. */
  journalPinLength: number | null
  pinFailedAttempts: number
  pinLockoutUntil:   number | null
  journalEncryptionToken: string | null

  mood:            Record<string, Mood>
  eodMood:         Record<string, EodMood>
  /** Running lifetime count of mood check-ins — incremented once per day for
   *  the AM mood pick and once per day for the EOD (end-of-day) mood pick
   *  (not on every re-selection within the same day, only the first time
   *  each is set for a given date). Purely a tracked/displayed stat, no
   *  scoring effect. */
  moodCheckins:    number
  /** Append-only log of every mood pick/change (unlike `mood`/`eodMood`,
   *  which only keep the latest value per day) — every re-selection adds a
   *  new entry, so this is the raw history for a future "mood over the day"
   *  view. Purely informational, no scoring effect. */
  moodChangeLog:   Array<{ date: string; kind: 'am' | 'pm'; mood: string; at: string }>

  /** Cumulative water intake per day, in millilitres — see the Water Drank
   *  dashboard tile (features/dashboard/components/WaterTrackerCard.tsx)
   *  and addWater in store/slices/config.slice.ts. */
  waterMl:         Record<string, number>

  pinnedTaskId:          string | null
  engagementDays:        Record<string, boolean>
  weeklyReviewDone:      Record<string, { reflection: string; at: string }>
  morningQuoteShown:     Record<string, boolean>
  appFirstUsed:          string | null
  overnightMsg:          string | null
  /** The most recent "you showed up" wallet bonus claimed via
   *  claimShowedUpBonus, so the MorningQuoteOverlay popup can display it
   *  (progress % = bonus/minPts, per project.md Decision #8) without having
   *  to recompute mood-adjusted minPts itself. */
  lastShowedUpBonus: { date: string; bonus: number; minPts: number } | null

  changeLog: ChangeLogEntry[]

  cfg: AppConfig

  /** ISO timestamp of the most recent state mutation — used to pick the
   * newer of local vs. cloud snapshots on load (last-write-wins across devices). */
  lastModified: string | null
}

export interface ChangeLogEntry {
  ts:     string
  action: string
  detail: string
}

// ─── Actions (all slice methods merged) ──────────────────────────────────────

export interface AppActions {
  // Tasks
  addTask:               (task: Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>) => string
  removeTask:            (id: string) => void
  toggleTask:            (id: string) => { pts: number; walletPts: number } | null
  toggleTaskRetro:       (id: string) => { pts: number; walletPts: number } | null
  submitRetroFix:        (dateKey: string, reward?: { title: string; cost: number }) => { ok: boolean; reason?: string }
  editTask:              (id: string, updates: Partial<Task>) => void
  pinTask:               (id: string | null) => void
  toggleSubtask:         (taskId: string, subId: string) => void
  addSubtask:            (taskId: string, title: string) => void
  removeSubtask:         (taskId: string, subId: string) => void
  addRecurring:          (r: Omit<RecurringTemplate, 'id'>) => string
  removeRecurring:       (id: string) => void
  editRecurring:         (id: string, updates: Partial<RecurringTemplate>) => void
  injectRecurring:       (today: string) => void
  carryTask:             (taskId: string, tomorrowKey: string) => void
  processExpiredCarries: () => void

  // Task validation (Section 1.3/1.4 of docs/PHASE2_SOCIAL_LIFE_OS.md) —
  // local mirror only; the authoritative approve/reject write happens in
  // Firestore via lib/firebase/social.ts, called from the UI layer alongside
  // these, same pattern as the reward-approval actions below.
  requestTaskValidation: (taskId: string, validatorUid: string, validatorName: string) => void
  resolveTaskValidation: (taskId: string, status: 'approved' | 'rejected', note?: string | null) => { pts: number; walletPts: number } | null
  cancelTaskValidation:  (taskId: string) => void

  // Task challenges — a task added to your own list because a friend
  // challenged you to it (see store/social/social.store.ts#acceptChallenge).
  addChallengeTask: (task: Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>, challengeId: string, challengedBy: string) => string
  /** Cancels a task with a reason instead of deleting it outright — used for
   *  challenged tasks (which can't otherwise be edited/deleted) so the
   *  challenger can be notified why. Non-challenged tasks may also use this;
   *  it just doesn't trigger a Firestore write for those. Cancelled tasks
   *  drop out of the active day list. No-op (returns false) if already
   *  done/cancelled. */
  cancelTask: (taskId: string, reason: string) => boolean

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
  setZoneWeight: (id: string, weight: number) => void

  // Focus Time (Dashboard) — completing a full, uninterrupted session credits
  // both the reward wallet and rank XP (see constants/points.ts FOCUS_REWARDS).
  completeFocusSession: (today: string, minutes: 25 | 45 | 60) => { pts: number; xp: number }

  // Goals (Section 3 of docs/PHASE2_SOCIAL_LIFE_OS.md) — definitions only;
  // progress is always derived, never stored (see lib/engine/goals.ts).
  addGoal:    (g: Omit<Goal, 'id' | 'createdAt'>) => void
  removeGoal: (id: string) => void
  editGoal:   (id: string, updates: Partial<Omit<Goal, 'id' | 'createdAt'>>) => void
  /** Flips a checklist item's done state. If this reopens an already-completed
   *  goal (unchecking one of its subtasks), also claws back the awarded
   *  pts/walletPts and returns them — otherwise null. */
  toggleGoalChecklistItem: (goalId: string, itemId: string) => { pts: number; walletPts: number } | null
  setGoalNote: (goalId: string, note: string) => void
  /** Complete a goal — only succeeds when every checklist item is done.
   *  Awards points (whole or summed per-subtask), halved to delayPoints if
   *  past the deadline. Returns the awarded pts/walletPts, or null if it
   *  couldn't complete (subtasks pending / already complete). */
  completeGoal: (goalId: string) => { pts: number; walletPts: number } | null
  /** Reverses a completed goal back to incomplete, clawing back the
   *  previously-awarded pts/walletPts (clamped at 0). Null if not completed. */
  uncompleteGoal: (goalId: string) => { pts: number; walletPts: number } | null

  // A goal added to your own list because a friend challenged you to it —
  // same idea as addChallengeTask, but for the multi-task/time-bound case
  // (see store/social/social.store.ts#acceptChallenge). The giver declares
  // the completion points and the (reduced) delay points.
  addChallengeGoal: (title: string, taskTitles: string[], endDate: string | undefined, challengedBy: string, points: number, delayPoints: number, challengeId?: string) => string

  /** Cancels an active (incomplete) goal with a reason. Mirrors cancelTask —
   *  drops the goal from the active list; if it came from a challenge
   *  (challengeId set), social.store.ts's watcher notifies the challenger.
   *  No-op (returns false) if already completed/cancelled. */
  cancelGoal: (goalId: string, reason: string) => boolean

  // Reward approvals (Section 1.5 / 6.4 of docs/PHASE2_SOCIAL_LIFE_OS.md) —
  // local mirror only; the real approve/reject write happens in Firestore
  // via lib/firebase/social.ts, called from the UI layer alongside these.
  requestRewardApproval: (approval: Omit<PendingRewardApproval, 'status'>) => void
  resolvePendingApproval: (id: string, status: PendingApprovalStatus) => void
  cancelPendingApproval:  (id: string) => void
  reassignPendingApproval: (id: string, notaryUid: string, notaryName: string, cooldownEndsAt: string) => void

  // Journal
  saveJournalEntry:   (today: string, text: string, editKey?: string) => { isFirst: boolean }
  deleteJournalEntry: (key: string) => void
  setJournalPin:      (hash: string | null) => void
  setJournalSecurity: (hash: string, question: string, answerHash: string) => void
  recordPinFailure:   () => void
  resetPinFailures:   () => void
  setJournalEncryptionToken: (token: string | null) => void

  // Config
  setConfig:    (updates: Partial<AppConfig>) => { blockedLightDays?: boolean }
  setMood:      (today: string, mood: Mood) => void
  setEodMood:   (today: string, mood: string) => void
  setPinnedTask: (id: string | null) => void
  claimShowedUpBonus: (today: string) => number | null
  /** Adds (or subtracts, via a negative delta) millilitres to today's water
   *  log — clamped at 0. Also used by the +/- 250ml buttons on the Water
   *  Drank dashboard tile. */
  addWater: (today: string, deltaMl: number) => void

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
