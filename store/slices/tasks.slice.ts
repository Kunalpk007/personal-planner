import type { StateCreator } from 'zustand'
import type { AppState, Task, RecurringTemplate, Subtask } from '../types'
import { uid }       from '@/lib/engine/cutoff'
import { calcPts, walletPtsFor, todayEarned } from '@/lib/engine/scoring'

export interface TasksSlice {
  // Actions
  addTask:        (task: Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>) => string
  removeTask:     (id: string) => void
  toggleTask:     (id: string) => { pts: number; walletPts: number } | null
  toggleTaskRetro:(id: string) => { pts: number; walletPts: number } | null
  submitRetroFix: (dateKey: string, reward?: { title: string; cost: number }) => { ok: boolean; reason?: string }
  editTask:       (id: string, updates: Partial<Task>) => void
  pinTask:        (id: string | null) => void
  toggleSubtask:  (taskId: string, subId: string) => void
  addSubtask:     (taskId: string, title: string) => void
  removeSubtask:  (taskId: string, subId: string) => void
  // Recurring
  addRecurring:   (r: Omit<RecurringTemplate, 'id'>) => void
  removeRecurring:(id: string) => void
  editRecurring:  (id: string, updates: Partial<RecurringTemplate>) => void
  injectRecurring:(today: string) => void
  // Carries
  carryTask:      (taskId: string, tomorrowKey: string) => void
  processExpiredCarries: () => void
  // Task validation
  requestTaskValidation: (taskId: string, validatorUid: string, validatorName: string) => void
  resolveTaskValidation: (taskId: string, status: 'approved' | 'rejected', note?: string | null) => { pts: number; walletPts: number } | null
  cancelTaskValidation:  (taskId: string) => void
  // Task challenges
  addChallengeTask: (task: Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>, challengeId: string, challengedBy: string) => string
}

export const createTasksSlice: StateCreator<AppState, [], [], TasksSlice> = (set, get) => ({
  addTask(partial) {
    const task: Task = {
      ...partial,
      id:          uid(),
      createdAt:   new Date().toISOString(),
      done:        false,
      completedAt: null,
      subtasks:    [],
    }
    set(s => ({ tasks: [...s.tasks, task] }))
    return task.id
  },

  removeTask(id) {
    const task = get().tasks.find(t => t.id === id)
    if (task?.done) {
      const pts = calcPts(task)
      set(s => ({
        tasks:        s.tasks.filter(t => t.id !== id),
        rankXP:       Math.max(0, s.rankXP - pts),
        rewardWallet: Math.max(0, s.rewardWallet - walletPtsFor(pts)),
        pinnedTaskId: s.pinnedTaskId === id ? null : s.pinnedTaskId,
      }))
    } else {
      set(s => ({
        tasks:        s.tasks.filter(t => t.id !== id),
        pinnedTaskId: s.pinnedTaskId === id ? null : s.pinnedTaskId,
      }))
    }
  },

  toggleTask(id) {
    const task = get().tasks.find(t => t.id === id)
    if (!task) return null

    if (!task.done) {
      // Completing
      const completedAt = new Date().toISOString()
      const updated     = { ...task, done: true, completedAt }
      const pts         = calcPts(updated)
      const walletPts   = walletPtsFor(pts)

      set(s => ({
        tasks: s.tasks.map(t => t.id === id ? updated : t),
        rankXP:       s.rankXP + pts,
        rewardWallet: s.rewardWallet + walletPts,
        lastActiveDayForDecay: task.date,
      }))
      return { pts, walletPts }
    } else {
      // Un-completing
      const pts = calcPts(task)
      set(s => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, done: false, completedAt: null } : t),
        rankXP:       Math.max(0, s.rankXP - pts),
        rewardWallet: Math.max(0, s.rewardWallet - walletPtsFor(pts)),
      }))
      return null
    }
  },

  // Retroactively toggle a previous day's task (grace-window reconciliation).
  // Adjusts XP/wallet like toggleTask, and also recalculates that day's history entry.
  toggleTaskRetro(id) {
    const state = get()
    const task  = state.tasks.find(t => t.id === id)
    if (!task) return null

    const wasDone = task.done
    let updated: Task
    let pts: number
    let walletPts = 0

    if (!wasDone) {
      const completedAt = new Date().toISOString()
      updated   = { ...task, done: true, completedAt }
      pts       = calcPts(updated)
      walletPts = walletPtsFor(pts)
    } else {
      updated = { ...task, done: false, completedAt: null }
      pts     = calcPts(task)
    }

    const newTasks = state.tasks.map(t => t.id === id ? updated : t)
    const dateKey  = task.date

    set({
      tasks:        newTasks,
      rankXP:       !wasDone ? state.rankXP + pts : Math.max(0, state.rankXP - pts),
      rewardWallet: !wasDone ? state.rewardWallet + walletPts : Math.max(0, state.rewardWallet - walletPtsFor(pts)),
    })

    get().logChange(
      'retro-toggle',
      `${!wasDone ? 'Completed' : 'Unchecked'} "${task.title}" retroactively for ${dateKey}`
    )

    return !wasDone ? { pts, walletPts } : null
  },

  // Persist the result of "Fix missed check-offs" reconciliation: recompute
  // that day's history entry from the current task state and (optionally)
  // log a reward redeemed for that day. Marks the day as fixed so the
  // dashboard prompt no longer appears.
  submitRetroFix(dateKey, reward) {
    const state    = get()
    const dayTasks = state.tasks.filter(t => t.date === dateKey)
    const doneTasks= dayTasks.filter(t => t.done)
    const rxp      = todayEarned(doneTasks, state.mood[dateKey], state.cfg)
    const pct      = dayTasks.length ? Math.round(doneTasks.length / dayTasks.length * 100) : 0
    const taskSnap = dayTasks.map(t => ({
      title:       t.title,
      priority:    t.isSpecial ? 'special' : t.priority,
      done:        t.done,
      zone:        t.zone,
      completedAt: t.completedAt,
      level:       t.level,
    }))

    const histIdx = state.history.findIndex(h => h.date === dateKey)
    let rewardsList = histIdx >= 0 ? [...(state.history[histIdx].rewards ?? [])] : []

    let rewardWallet      = state.rewardWallet
    let rewardRedemptions = state.rewardRedemptions

    if (reward && reward.title.trim() && reward.cost > 0) {
      if (rewardWallet < reward.cost) return { ok: false, reason: 'insufficient-wallet' }
      rewardWallet -= reward.cost
      rewardRedemptions = [...rewardRedemptions, { date: dateKey, title: reward.title.trim(), cost: reward.cost, at: new Date().toISOString() }]
      rewardsList = [...rewardsList, reward.title.trim()]
    }

    const newHistory = [...state.history]
    if (histIdx >= 0) {
      newHistory[histIdx] = { ...newHistory[histIdx], done: doneTasks.length, total: dayTasks.length, pct, rxp, tasks: taskSnap, rewards: rewardsList }
    } else {
      // No prior history entry (new user or day not processed by overnight logic yet).
      // Create one so the fix is persisted and shows up in streak history.
      newHistory.push({
        date: dateKey, done: doneTasks.length, total: dayTasks.length, pct, rxp,
        mood: state.mood[dateKey] ?? '', eodMood: '',
        frozen: false, rest: false, auto: false, late: false,
        tasks: taskSnap, rewards: rewardsList,
      })
    }

    // Mark as submitted so the retro panel doesn't re-appear and the day
    // registers in submittedDays for streak/history purposes.
    const updatedSubmittedDays = { ...state.submittedDays, [dateKey]: true }

    set({
      history:        newHistory,
      rewardWallet,
      rewardRedemptions,
      retroFixedDays:  { ...state.retroFixedDays, [dateKey]: true },
      submittedDays:   updatedSubmittedDays,
    })

    get().logChange('retro-submit', `Saved fix-missed-checkoff changes for ${dateKey}` + (reward?.title ? ` + redeemed "${reward.title.trim()}" (${reward.cost}pts)` : ''))

    return { ok: true }
  },

  editTask(id, updates) {
    set(s => {
      const old  = s.tasks.find(t => t.id === id)
      if (!old) return s
      const oldPts = old.done ? calcPts(old) : 0
      const updated = { ...old, ...updates }
      const newPts  = updated.done ? calcPts(updated) : 0
      return {
        tasks:  s.tasks.map(t => t.id === id ? updated : t),
        rankXP: Math.max(0, s.rankXP - oldPts + newPts),
      }
    })
  },

  pinTask(id) {
    set(s => ({ pinnedTaskId: s.pinnedTaskId === id ? null : id }))
  },

  toggleSubtask(taskId, subId) {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.map(st => st.id === subId ? { ...st, done: !st.done } : st) }
          : t
      ),
    }))
  },

  addSubtask(taskId, title) {
    const sub: Subtask = { id: uid(), title, done: false }
    set(s => ({
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, subtasks: [...t.subtasks, sub] } : t),
    }))
  },

  removeSubtask(taskId, subId) {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId ? { ...t, subtasks: t.subtasks.filter(st => st.id !== subId) } : t
      ),
    }))
  },

  addRecurring(r) {
    set(s => ({ recurring: [...s.recurring, { ...r, id: uid() }] }))
  },

  removeRecurring(id) {
    set(s => ({ recurring: s.recurring.filter(r => r.id !== id) }))
  },

  editRecurring(id, updates) {
    set(s => ({ recurring: s.recurring.map(r => r.id === id ? { ...r, ...updates } : r) }))
  },

  injectRecurring(today) {
    const { tasks, recurring } = get()
    const existingRecurIds = tasks.filter(t => t.date === today && t.recurId).map(t => t.recurId!)
    const newTasks: Task[] = recurring
      .filter(r => !existingRecurIds.includes(r.id))
      .map(r => ({
        id:          uid(),
        title:       r.title,
        note:        r.note,
        zone:        r.zone,
        priority:    r.priority,
        slot:        r.slot,
        deadline:    null,
        done:        false,
        date:        today,
        createdAt:   new Date().toISOString(),
        completedAt: null,
        recurId:     r.id,
        subtasks:    [],
        level:       r.level,
        isSpecial:   r.isSpecial,
        specialPts:  r.specialPts,
      }))
    if (newTasks.length) set(s => ({ tasks: [...s.tasks, ...newTasks] }))
  },

  carryTask(taskId, tomorrowKey) {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task) return
    const carried: Task = {
      ...task,
      id:          uid(),
      date:        tomorrowKey,
      done:        false,
      completedAt: null,
      createdAt:   new Date().toISOString(),
      carriedDays: (task.carriedDays ?? 0) + 1,
    }
    if (carried.carriedDays! <= 3) {
      set(s => ({ tasks: [...s.tasks, carried] }))
    }
  },

  processExpiredCarries() {
    set(s => ({ tasks: s.tasks.filter(t => !t.carriedDays || t.carriedDays <= 3) }))
  },

  // ─── Task validation — see docs/PHASE2_SOCIAL_LIFE_OS.md Section 1.3/1.4 ──
  // Deliberately does NOT touch `done`/rankXP/rewardWallet here — that only
  // happens in resolveTaskValidation('approved'), once the friend signs off.
  // Until then the task is simply not `done`, so the scoring engine (which
  // only ever sums done tasks) naturally withholds its points — no separate
  // "locked pts" bookkeeping needed like the reward-approval flow required.

  requestTaskValidation(taskId, validatorUid, validatorName) {
    set(s => ({
      tasks: s.tasks.map(t => t.id === taskId
        ? { ...t, needsValidation: true, validatorUid, validatorName, validationStatus: 'pending', validationNote: null }
        : t),
    }))
  },

  resolveTaskValidation(taskId, status, note) {
    const task = get().tasks.find(t => t.id === taskId)
    if (!task || task.validationStatus !== 'pending') return null

    if (status === 'approved') {
      const completedAt = new Date().toISOString()
      const updated = { ...task, done: true, completedAt, validationStatus: 'approved' as const, validationNote: note ?? null }
      const pts       = calcPts(updated)
      const walletPts = walletPtsFor(pts)
      set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? updated : t),
        rankXP:       s.rankXP + pts,
        rewardWallet: s.rewardWallet + walletPts,
        lastActiveDayForDecay: task.date,
      }))
      return { pts, walletPts }
    }

    set(s => ({
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, validationStatus: 'rejected' as const, validationNote: note ?? null } : t),
    }))
    return null
  },

  cancelTaskValidation(taskId) {
    set(s => ({
      tasks: s.tasks.map(t => t.id === taskId
        ? { ...t, needsValidation: false, validatorUid: undefined, validatorName: undefined, validationStatus: undefined, validationNote: undefined }
        : t),
    }))
  },

  // ─── Task challenges ────────────────────────────────────────────────────────
  addChallengeTask(partial, challengeId, challengedBy) {
    const task: Task = {
      ...partial,
      id:          uid(),
      createdAt:   new Date().toISOString(),
      done:        false,
      completedAt: null,
      subtasks:    [],
      challengeId,
      challengedBy,
    }
    set(s => ({ tasks: [...s.tasks, task] }))
    return task.id
  },
})
