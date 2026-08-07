'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useDayKey }       from '@/hooks/useDayKey'
import { usePlannerStore } from '@/store'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { showManagerMessage } from '@/ui/ManagerModal'
import { calcPts, basePts } from '@/lib/engine/scoring'
import { getTaskCompleteMessage } from '@/lib/engine/manager'
import type { Task, Priority, Slot, Level } from '@/store/types'
import { useSocialStore } from '@/store/social/social.store'
import { FLAGS } from '@/constants/feature-flags'
import { CHALLENGE_ZONES } from '@/constants/social'
import { pad } from '@/lib/engine/cutoff'
import { FriendsPageContent } from '@/features/friends/components/FriendsPageContent'
import { SubmitArea } from '@/features/dashboard/components/SubmitArea'
import { GoalTile, GoalFormModal } from '@/features/goals/GoalsInTasks'
import { ChallengesPanel } from '@/features/challenges/ChallengesPanel'
import { TaskActionFab } from '@/features/tasks/TaskActionFab'

// Input length caps — enforced with an inline red error, not a hard maxLength,
// so the user sees *why* they can't add/save (see LimitedField below).
const MAX_TASK_NAME = 30
const MAX_TASK_NOTE = 100

/** Diagonal pencil (edit) icon — matches the app's stroke icon style. */
function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

/** Minimal countdown for a time-bound task. Shows time left until the
 *  deadline, or "Overdue" once it passes — kept to a single compact pill so
 *  the tile doesn't get cluttered. Ticks once a minute (plus on mount). */
function Countdown({ deadline, done }: { deadline: string; done: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (done) return
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [done])

  if (done) return null
  const ms = new Date(deadline).getTime() - now
  const overdue = ms <= 0
  let label: string
  if (overdue) {
    label = 'Overdue · ½ pts'
  } else {
    const mins = Math.floor(ms / 60000)
    const d = Math.floor(mins / 1440)
    const h = Math.floor((mins % 1440) / 60)
    const m = mins % 60
    label = d > 0 ? `${d}d ${h}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`
  }
  return (
    <span
      className="vx-chip"
      style={{
        background: overdue ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
        color:      overdue ? 'var(--red)' : 'var(--vx-amber)',
        borderColor: overdue ? 'rgba(248,113,113,0.4)' : 'rgba(251,191,36,0.4)',
      }}
    >
      ⏳ {label}
    </span>
  )
}

/** A labelled input/textarea that enforces a max length with a red highlight
 *  + "Max length N" message below when exceeded. Returns whether it's over
 *  via the onOver callback so the parent can disable submit. */
function LimitedField({
  value, onChange, max, placeholder, textarea, className, autoFocus, onEnter,
}: {
  value: string
  onChange: (v: string) => void
  max: number
  placeholder?: string
  textarea?: boolean
  className?: string
  autoFocus?: boolean
  onEnter?: () => void
}) {
  const over = value.length > max
  const common = `vx-field ${over ? 'vx-error' : ''} ${className ?? ''}`
  return (
    <div className="w-full">
      {textarea ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={common}
        />
      ) : (
        <input
          value={value}
          autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && onEnter && !over) onEnter() }}
          placeholder={placeholder}
          className={common}
        />
      )}
      {over && <div className="text-[11px] mt-0.5" style={{ color: 'var(--red)' }}>Max length {max}</div>}
    </div>
  )
}

/** Zone lookup for a task row — checks the user's own custom zones first
 *  (the normal case), then falls back to the fixed CHALLENGE_ZONES set (for
 *  tasks that came from an accepted friend challenge, where the zone id was
 *  chosen from that fixed list on the challenger's side — see ChallengeModal
 *  — and may not exist in this user's own zone list at all), then finally a
 *  generic gray pill so nothing ever renders blank. */
function resolveZone(zoneId: string, customZones: { id: string; name: string; color: string }[]) {
  return customZones.find(z => z.id === zoneId)
    ?? CHALLENGE_ZONES.find(z => z.id === zoneId)
    ?? { id: zoneId, name: zoneId, color: '#888' }
}

const PRIORITIES: { val: Priority; label: string }[] = [
  { val: 'high',    label: 'High — 20pts' },
  { val: 'med',     label: 'Medium — 12pts' },
  { val: 'low',     label: 'Low — 6pts' },
  { val: 'special', label: '⭐ Special' },
]
const SLOTS: { val: Slot; label: string }[] = [
  { val: '', label: 'Any time' }, { val: 'morning', label: 'Morning' },
  { val: 'afternoon', label: 'Afternoon' }, { val: 'evening', label: 'Evening' }, { val: 'night', label: 'Night' },
]
const LEVELS: { val: Level; label: string }[] = [
  { val: '', label: 'No level' }, { val: 'L1', label: 'L1' }, { val: 'L2', label: 'L2' },
  { val: 'L3', label: 'L3' }, { val: 'L4', label: 'L4' }, { val: 'L5', label: 'L5' },
]
const DELETE_REASONS = [
  'Duplicate / added by mistake',
  'No longer relevant',
  'Misjudged — too hard or wrong priority',
  "Won't get to it — moving on",
]

const CANCEL_REASONS = [
  'Changed my mind',
  'No longer relevant',
  'Too ambitious for now',
  'Ran out of time',
  'Other',
]

function priBadgeClass(t: Task) {
  if (t.isSpecial) return 'badge-special'
  return ({ high: 'badge-high', med: 'badge-medium', low: 'badge-low', special: 'badge-special' } as Record<string,string>)[t.priority] ?? 'badge-low'
}
function priLabel(t: Task) {
  return t.isSpecial ? '⭐' : ({ high: 'H', med: 'M', low: 'L', special: '⭐' } as Record<string,string>)[t.priority] ?? t.priority
}

export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksPageInner />
    </Suspense>
  )
}

function TasksPageInner() {
  const { today }    = useDayKey()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'normal' | 'challenges' | 'friends'>('normal')

  // Friends & Challenges are modes here, deep-linkable via ?mode=friends /
  // ?mode=challenges (see the redirect in app/(tabs)/friends/page.tsx and the
  // notification bell). Goals now live inline in the normal Today's Tasks list.
  useEffect(() => {
    const m = searchParams.get('mode')
    if (m === 'friends' || m === 'challenges') setMode(m)
    if (m === 'goals') setMode('challenges') // old deep-link → Challenges
    // The standalone "Recurring" tab was removed — recurring is now just a
    // checkbox on a task itself (Add/Edit Task modal). Old ?mode=recur
    // deep-links (if any survive in a stale bookmark) fall back to normal.
    if (m === 'recur') setMode('normal')
  }, [searchParams])

  const allTasks  = usePlannerStore(s => s.tasks)
  const tasks     = useMemo(() => allTasks.filter(t => t.date === today && !t.cancelledAt), [allTasks, today])
  const zones     = usePlannerStore(s => s.zones)
  const submitted = usePlannerStore(s => !!s.submittedDays[today])
  const pinned    = usePlannerStore(s => s.pinnedTaskId)
  const mood      = usePlannerStore(s => s.mood[today])
  const cfg       = usePlannerStore(s => s.cfg)

  const addTask       = usePlannerStore(s => s.addTask)
  const removeTask    = usePlannerStore(s => s.removeTask)
  const logChange     = usePlannerStore(s => s.logChange)
  const toggleTask    = usePlannerStore(s => s.toggleTask)
  const editTask      = usePlannerStore(s => s.editTask)
  const pinTask       = usePlannerStore(s => s.pinTask)
  const addRecurring  = usePlannerStore(s => s.addRecurring)

  const friends           = useSocialStore(s => s.friends)
  const requestValidation = useSocialStore(s => s.requestValidation)
  const sendChallenge     = useSocialStore(s => s.sendChallenge)
  const sendGoalChallenge = useSocialStore(s => s.sendGoalChallenge)
  const [challengeOpen, setChallengeOpen] = useState(false)

  // Goals now live inline in the Today's Tasks list (Session 8 revamp).
  // Once a goal is completed it's removed from this current-goals list
  // entirely (per explicit user request) — it isn't shown struck-through
  // here anymore, it's just gone from the active list once done.
  const allGoals   = usePlannerStore(s => s.goals)
  const sortedGoals = useMemo(
    () => allGoals.filter(g => !g.completedAt && !g.cancelledAt),
    [allGoals]
  )
  const [goalFormOpen, setGoalFormOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)

  function handleToggle(id: string) {
    if (submitted) { showToast('Day submitted — tasks locked.'); return }
    const task   = tasks.find(t => t.id === id)
    const result = toggleTask(id)
    if (result && task) {
      showToast(`+${result.pts} RXP · +${result.walletPts} 🪙`)
      showManagerMessage(getTaskCompleteMessage(task.priority, task.isSpecial, mood, cfg.tone))
    }
  }

  const filtered = tasks
    .slice()
    .sort((a, b) => {
      if ((a.carriedDays ?? 0) !== (b.carriedDays ?? 0)) return (b.carriedDays ?? 0) - (a.carriedDays ?? 0)
      if (a.done !== b.done) return a.done ? 1 : -1
      const po = { special: -1, high: 0, med: 1, low: 2 }
      return (po[a.priority as keyof typeof po] ?? 0) - (po[b.priority as keyof typeof po] ?? 0)
    })

  return (
    <div>
      {/* Mode toggle */}
      <div className="vx-modeswitch mb-3.5">
        {[
          { k: 'normal', l: "Today's Tasks" },
          ...(FLAGS.FRIENDS ? [{ k: 'challenges', l: 'Challenges' }] : []),
          ...(FLAGS.FRIENDS ? [{ k: 'friends',    l: 'Friends' }]    : []),
        ].map(m => (
          <button key={m.k} onClick={() => setMode(m.k as any)}
            className={`vx-modeswitch-item ${mode === m.k ? 'vx-active' : ''}`}>
            {mode === m.k && (
              <motion.div layoutId="vx-tasks-mode-indicator" className="vx-modeswitch-indicator"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
            )}
            <span className="relative z-10">{m.l}</span>
          </button>
        ))}
      </div>

      {mode === 'normal' && (
        <>
          {/* Add Task / Add Goal / Challenge Friend now live behind a single
              floating "+" button (bottom-right, fixed) instead of an
              always-visible button row — see TaskActionFab. */}
          <TaskActionFab
            onAddTask={() => setAddTaskOpen(true)}
            onAddGoal={FLAGS.GOALS ? () => setGoalFormOpen(true) : undefined}
            onChallengeFriend={FLAGS.FRIENDS && friends.length > 0 ? () => setChallengeOpen(true) : undefined}
          />

          <AddTaskModal
            open={addTaskOpen}
            onClose={() => setAddTaskOpen(false)}
            zones={zones}
            onAdd={(t, recurring) => {
              // If "recurring" is checked, create the template first so the
              // task created right now can be linked to it via recurId —
              // that's how the Edit Task modal's own recurring checkbox
              // later knows this task is already recurring.
              const recurId = recurring
                ? addRecurring({ title: t.title, note: t.note, zone: t.zone, priority: t.priority, slot: t.slot, level: t.level, isSpecial: t.isSpecial, specialPts: t.specialPts })
                : undefined
              const id = addTask({ ...t, date: today, ...(recurId ? { recurId } : {}) })
              showToast(recurring ? 'Task added + set to recur daily.' : 'Task added.')
              return id
            }}
          />

          {/* Task + Goal list */}
          <div className="mb-4">
            {filtered.length === 0 && sortedGoals.length === 0 && <div className="text-[13px] py-3.5 text-center" style={{ color: 'var(--vx-fg-4)' }}>No tasks yet. Add one above.</div>}
            {FLAGS.GOALS && sortedGoals.map(g => <GoalTile key={g.id} goal={g} />)}
            {filtered.map(t => (
              <TaskRow key={t.id} task={t} zones={zones} pinned={pinned === t.id}
                locked={submitted} onToggle={() => handleToggle(t.id)}
                onRequestValidation={(validatorUid, validatorName) => requestValidation(t.id, validatorUid, validatorName)}
                onPin={() => pinTask(t.id)}
                onRemove={(reason) => { removeTask(t.id); logChange('task-deleted', `"${t.title}" — ${reason}`); showToast('Task deleted.') }}
                onEdit={(updates) => editTask(t.id, updates)}
                mood={mood} cfg={cfg}
                otherTasks={tasks.filter(o => o.id !== t.id && !o.done)}
                addTask={addTask}
                friends={friends} />
            ))}
          </div>

          {FLAGS.GOALS && <GoalFormModal open={goalFormOpen} onClose={() => setGoalFormOpen(false)} />}

          {FLAGS.FRIENDS && (
            <ChallengeModal
              open={challengeOpen}
              onClose={() => setChallengeOpen(false)}
              friends={friends}
              onSend={(friendUid, friendName, title, note, zoneId, priority) => {
                sendChallenge(friendUid, friendName, title, note, zoneId, priority)
                setChallengeOpen(false)
                showToast(`Challenge sent to ${friendName}.`)
              }}
              onSendGoal={(friendUid, friendName, title, taskTitles, endDate, completionPoints, delayPoints) => {
                sendGoalChallenge(friendUid, friendName, title, taskTitles, endDate, completionPoints, delayPoints)
                setChallengeOpen(false)
                showToast(`Goal challenge sent to ${friendName}.`)
              }}
            />
          )}

          {/* Submit My Day — pinned above the bottom nav; spacer keeps the last
              task from being hidden behind the fixed bar while the list above
              stays scrollable. */}
          <div className="pb-32" />
          <SubmitArea today={today} pinned />
        </>
      )}

      {mode === 'challenges' && FLAGS.FRIENDS && <ChallengesPanel />}

      {mode === 'friends' && FLAGS.FRIENDS && <FriendsPageContent />}
    </div>
  )
}

function TaskRow({ task, zones, pinned, locked, onToggle, onRequestValidation, onPin, onRemove, onEdit, mood, cfg, otherTasks, addTask, friends }: {
  task: Task; zones: any[]; pinned: boolean; locked: boolean;
  onToggle: () => void; onRequestValidation: (validatorUid: string, validatorName: string) => void;
  onPin: () => void; onRemove: (reason: string) => void;
  onEdit: (u: Partial<Task>) => void; mood?: string; cfg: any;
  otherTasks: Task[]; addTask: (t: Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>) => string;
  friends: { uid: string; displayName: string }[];
}) {
  const cancelTask = usePlannerStore(s => s.cancelTask)
  const [editOpen, setEditOpen] = useState(false)
  const [delOpen, setDelOpen]   = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const zone = resolveZone(task.zone, zones)

  // Time-bound: a task with a deadline that has passed but isn't done earns
  // (and now shows) half points — matches calcPts's late = half penalty.
  const overdue = !!(task.deadline && !task.done && new Date(task.deadline).getTime() <= Date.now())
  const pts  = task.done ? calcPts(task) : (overdue ? Math.max(1, Math.round(basePts(task) * 0.5)) : basePts(task))

  // A task with a validator assigned doesn't complete on tap — it requests
  // sign-off instead, and stays un-done (so it earns no pts/streak credit)
  // until that resolves. See requestTaskValidation/resolveTaskValidation in
  // store/slices/tasks.slice.ts.
  const awaitingValidation = !!(task.needsValidation && task.validatorUid && task.validationStatus !== 'approved')
  const isPendingValidation = !!(awaitingValidation && task.validationStatus === 'pending')

  function handleCheckboxClick() {
    if (locked) return
    if (isPendingValidation) return
    if (awaitingValidation && task.validatorUid && task.validatorName) {
      onRequestValidation(task.validatorUid, task.validatorName)
      return
    }
    onToggle()
  }

  const tone = task.blocked ? 'red' : (pinned && !task.done) ? 'purple' : (task.carriedDays ? 'amber' : undefined)

  return (
    <>
      <motion.div
        layout
        className={`vx-tile vx-accent-l flex items-start gap-2.5 mb-2 ${task.done ? 'opacity-45' : ''}`}
        data-tone={tone}
      >
        <button
          onClick={handleCheckboxClick}
          disabled={(locked && !task.done) || isPendingValidation}
          title={isPendingValidation ? `Awaiting ${task.validatorName}` : awaitingValidation ? `Tap to send to ${task.validatorName} for validation` : undefined}
          className={`vx-check mt-0.5 ${task.done ? 'vx-done' : isPendingValidation ? 'vx-pending' : ''}`}
        >
          {task.done ? '✓' : isPendingValidation ? '⏳' : ''}
        </button>

        {/* Main content — min-w-0 lets long text wrap instead of overflowing the tile */}
        <div className="flex-1 min-w-0">
          {/* Title row: title (wraps) on the left, edit/delete pinned top-right */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1 min-w-0">
              <span className={`text-[13px] break-words [overflow-wrap:anywhere] ${task.done ? 'line-through' : ''}`} style={{ color: 'var(--vx-fg-1)' }}>{task.title}</span>
              <span className={priBadgeClass(task)}>{priLabel(task)}</span>
              {task.level && <span className="vx-chip" data-tone="violet">{task.level}</span>}
            </div>
            {/* Tasks from an accepted friend challenge aren't editable/
                deletable — only completing or cancelling (with a reason —
                see below) is allowed (see the "Challenged by" chip in the
                meta row below). */}
            {!locked && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {!task.challengedBy ? (
                  <>
                    <button onClick={() => setEditOpen(true)} className="vx-btn vx-btn-icon" title="Edit task" aria-label="Edit task"><EditIcon /></button>
                    <button onClick={() => setDelOpen(true)} className="vx-btn vx-btn-icon vx-danger" title="Delete task" aria-label="Delete task">×</button>
                  </>
                ) : !task.done && (
                  <button onClick={() => setCancelOpen(true)} className="vx-btn vx-btn-icon" title="Cancel task" aria-label="Cancel task">🚫</button>
                )}
              </div>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-1.5 mt-0.5 text-[11px] min-w-0" style={{ color: 'var(--vx-fg-4)' }}>
            {task.note && <span className="break-words [overflow-wrap:anywhere] min-w-0">{task.note}</span>}
            {task.deadline && !task.done && <Countdown deadline={task.deadline} done={task.done} />}
            {task.deadline && task.done && <span className="vx-chip" data-tone="amber">⏰ {new Date(task.deadline).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
            {task.slot && <span>📍{task.slot}</span>}
            {task.recurId && <span className="vx-chip" title="Recurring task — auto-added daily">🔁 Recurring</span>}
            {task.challengedBy && <span className="vx-chip" data-tone="violet">🎯 Challenged by {task.challengedBy}</span>}
            {isPendingValidation && <span className="vx-chip" data-tone="violet">⏳ Awaiting {task.validatorName}</span>}
            {task.validationStatus === 'rejected' && (
              <span className="vx-chip" data-tone="red">
                ❌ Rejected{task.validationNote ? `: ${task.validationNote}` : ''} — tap to resend
              </span>
            )}
            {task.blocked ? (
              <span className="font-semibold break-words [overflow-wrap:anywhere]" style={{ color: 'var(--red)' }}>🚫 Blocked by: {task.blockedByTitle ?? 'linked task'}</span>
            ) : task.carriedDays ? (
              <span className="font-semibold" style={{ color: 'var(--vx-amber)' }}>↩ carried {task.carriedDays}d (-{task.carriedDays * 2}pts)</span>
            ) : null}
            {task.completedAt && <span style={{ color: 'var(--vx-emerald)' }}>✓ {new Date(task.completedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
          </div>

          {/* Footer row: zone, points, focus star */}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className="vx-chip" style={{ background: `${zone.color}22`, color: zone.color, borderColor: `${zone.color}88` }}>{zone.name}</span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <span className="text-xs font-semibold whitespace-nowrap mr-0.5" style={{ color: task.done ? 'var(--vx-emerald)' : overdue ? 'var(--red)' : 'var(--vx-fg-4)' }}>+{pts}{overdue ? ' ½' : ''}</span>
              {!locked && <button onClick={onPin} className="vx-btn vx-btn-icon" style={pinned ? { color: 'var(--vx-amber)' } : undefined} title={pinned ? 'Remove focus' : 'Select to focus this task'}>{pinned ? '★' : '☆'}</button>}
            </div>
          </div>
        </div>
      </motion.div>
      <EditTaskModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        task={task}
        zones={zones}
        onSave={onEdit}
        friends={friends}
        onOpenBlock={() => { setEditOpen(false); setBlockOpen(true) }}
        onUnblock={() => onEdit({ blocked: false, blockedByTaskId: undefined, blockedByTitle: undefined })}
      />
      <BlockTaskModal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        task={task}
        otherTasks={otherTasks}
        addTask={addTask}
        onLink={(blockerId, blockerTitle) => onEdit({ blocked: true, blockedByTaskId: blockerId, blockedByTitle: blockerTitle })}
      />
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete task?" variant="vx">
        <p className="text-sm text-[var(--text2)] mb-3">Why are you deleting &ldquo;{task.title}&rdquo;?</p>
        <div className="flex flex-col gap-1.5 mb-3">
          {DELETE_REASONS.map(r => (
            <button
              key={r}
              onClick={() => { onRemove(r); setDelOpen(false) }}
              className="vx-btn vx-btn-ghost text-left justify-start w-full text-[13px]"
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={() => setDelOpen(false)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => { setCancelOpen(false); setCancelReason('') }} title="Cancel task?" variant="vx">
        <p className="text-sm mb-3" style={{ color: 'var(--vx-fg-2)' }}>
          Why are you cancelling &ldquo;{task.title}&rdquo;? {task.challengedBy} will be notified.
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {CANCEL_REASONS.map(r => (
            <button
              key={r}
              onClick={() => setCancelReason(r)}
              className={`vx-btn ${cancelReason === r ? 'vx-btn-primary' : 'vx-btn-ghost'} text-left justify-start w-full text-[13px]`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setCancelOpen(false); setCancelReason('') }} className="vx-btn vx-btn-ghost text-sm">Go back</button>
          <button
            onClick={() => {
              if (!cancelReason) return
              const ok = cancelTask(task.id, cancelReason)
              setCancelOpen(false); setCancelReason('')
              if (ok) showToast('Task cancelled.')
            }}
            disabled={!cancelReason}
            className="vx-btn vx-btn-danger text-sm"
          >
            Cancel task
          </button>
        </div>
      </Modal>
    </>
  )
}

function EditTaskModal({ open, onClose, task, zones, onSave, friends, onOpenBlock, onUnblock }: {
  open: boolean; onClose: () => void; task: Task; zones: any[];
  onSave: (updates: Partial<Task>) => void
  friends: { uid: string; displayName: string }[]
  onOpenBlock: () => void
  onUnblock: () => void
}) {
  const [title,    setTitle]    = useState(task.title)
  const [note,     setNote]     = useState(task.note)
  const [zoneId,   setZoneId]   = useState(task.zone)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [slot,     setSlot]     = useState<Slot>(task.slot)
  const [level,    setLevel]    = useState<Level>(task.level)
  const [deadline, setDeadline] = useState(task.deadline ? task.deadline.slice(0, 16) : '')
  const [specialPts, setSpecialPts] = useState(task.specialPts)
  const [subInput, setSubInput] = useState('')
  const [needsValidation, setNeedsValidation] = useState(!!task.needsValidation)
  const [validatorUid, setValidatorUid] = useState(task.validatorUid ?? '')

  const toggleSubtask = usePlannerStore(s => s.toggleSubtask)
  const addSubtask    = usePlannerStore(s => s.addSubtask)
  const removeSubtask = usePlannerStore(s => s.removeSubtask)

  // "Recurring task" checkbox — replaces the old standalone Recurring tab
  // entirely (per explicit user feedback: it was only ever meant to be a
  // checkbox on the task itself, not a separate management screen). A task
  // is "recurring" when its `recurId` points at a live RecurringTemplate;
  // `injectRecurring` (tasks.slice.ts) uses that template to auto-add a
  // fresh copy of this task every day. Checking the box here creates the
  // template (or updates it, if one already exists) from the task's current
  // fields; unchecking deletes the template so no more copies get created —
  // this task instance itself is untouched either way.
  const recurringTemplates = usePlannerStore(s => s.recurring)
  const addRecurring       = usePlannerStore(s => s.addRecurring)
  const editRecurring      = usePlannerStore(s => s.editRecurring)
  const removeRecurring    = usePlannerStore(s => s.removeRecurring)
  const linkedTemplate = task.recurId ? recurringTemplates.find(r => r.id === task.recurId) : undefined
  const [recurring, setRecurring] = useState(!!linkedTemplate)

  // Re-seed the draft whenever the modal is (re)opened for a task
  useEffect(() => {
    if (!open) return
    setTitle(task.title); setNote(task.note); setZoneId(task.zone)
    setPriority(task.priority); setSlot(task.slot); setLevel(task.level)
    setDeadline(task.deadline ? task.deadline.slice(0, 16) : '')
    setSpecialPts(task.specialPts)
    setNeedsValidation(!!task.needsValidation)
    setValidatorUid(task.validatorUid ?? '')
    setRecurring(!!linkedTemplate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task])

  const titleOver = title.length > MAX_TASK_NAME
  const noteOver  = note.length > MAX_TASK_NOTE

  function handleSave() {
    if (!title.trim()) return
    if (titleOver || noteOver) { showToast('Fix the highlighted fields first.'); return }
    const validator = friends.find(f => f.uid === validatorUid)
    const templateFields = {
      title: title.trim(), note: note.trim(), zone: zoneId || zones[0]?.id,
      priority, slot, level, isSpecial: priority === 'special', specialPts,
    }
    let nextRecurId: string | undefined = task.recurId
    if (recurring && !linkedTemplate) {
      nextRecurId = addRecurring(templateFields)
      showToast('Task set to recur daily.')
    } else if (recurring && linkedTemplate) {
      editRecurring(linkedTemplate.id, templateFields) // keep template in sync with edits
    } else if (!recurring && linkedTemplate) {
      removeRecurring(linkedTemplate.id)
      nextRecurId = undefined // clear the now-dangling link on this task
      showToast('Task removed from recurring.')
    }
    onSave({
      title: title.trim(), note: note.trim(), zone: zoneId || zones[0]?.id,
      priority, slot, level, deadline: deadline || null,
      isSpecial: priority === 'special', specialPts,
      recurId: nextRecurId,
      ...(needsValidation && validator
        ? { needsValidation: true, validatorUid: validator.uid, validatorName: validator.displayName }
        : { needsValidation: false, validatorUid: undefined, validatorName: undefined, validationStatus: undefined, validationNote: undefined }),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Task" variant="vx">
      <div className="flex flex-col gap-2.5">
        <LimitedField value={title} onChange={setTitle} max={MAX_TASK_NAME} placeholder="Task name..." />

        <div className="flex gap-2 flex-wrap">
          <select value={zoneId} onChange={e => setZoneId(e.target.value)}
            className="flex-1 min-w-[100px] vx-field">
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
            className="flex-1 min-w-[100px] vx-field">
            {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
          </select>
          <select value={level} onChange={e => setLevel(e.target.value as Level)}
            className="flex-1 min-w-[90px] vx-field">
            {LEVELS.map(l => <option key={l.val} value={l.val}>{l.label}</option>)}
          </select>
        </div>

        {priority === 'special' && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-[var(--text2)]">⭐ Pts:</span>
            <input type="number" value={specialPts} onChange={e => setSpecialPts(+e.target.value)} min={1} max={200}
              className="w-20 vx-field" />
          </div>
        )}

        <LimitedField value={note} onChange={setNote} max={MAX_TASK_NOTE} placeholder="Note (optional)" textarea />

        <div className="flex gap-2 flex-wrap">
          <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} title="Time-bound: earns half points if not completed by this time"
            className="flex-1 min-w-[160px] vx-field" />
          <select value={slot} onChange={e => setSlot(e.target.value as Slot)}
            className="flex-1 min-w-[120px] vx-field">
            {SLOTS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
          </select>
        </div>
        {deadline && <div className="text-[11px] text-[var(--text3)] -mt-1">⏳ Time-bound — half points if not done by the selected time.</div>}

        <label className="flex items-center gap-2 text-[12px] text-[var(--text2)] cursor-pointer border-t border-[var(--border)] pt-2.5">
          <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
          🔁 Recurring task (auto-adds a fresh copy of this every day)
        </label>

        {/* Block task — moved here from the tile; opens the dependency picker */}
        <div className="border-t border-[var(--border)] pt-2.5">
          {task.blocked ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[var(--red)] break-words [overflow-wrap:anywhere] min-w-0">🚫 Blocked by: {task.blockedByTitle ?? 'linked task'}</span>
              <button onClick={() => { onUnblock(); onClose() }} className="vx-btn vx-btn-ghost flex-shrink-0 text-xs">
                Unblock
              </button>
            </div>
          ) : (
            <button onClick={onOpenBlock} className="vx-btn vx-btn-danger text-xs">
              🚫 Block this task
            </button>
          )}
        </div>

        {/* Friend validation */}
        {FLAGS.FRIENDS && friends.length > 0 && (
          <div className="border-t border-[var(--border)] pt-2.5">
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--text2)] cursor-pointer mb-2">
              <input type="checkbox" checked={needsValidation} onChange={e => setNeedsValidation(e.target.checked)} />
              Require a friend to validate this before it counts
            </label>
            {needsValidation && (
              <select value={validatorUid} onChange={e => setValidatorUid(e.target.value)}
                className="w-full vx-field">
                <option value="">Choose a friend…</option>
                {friends.map(f => <option key={f.uid} value={f.uid}>{f.displayName}</option>)}
              </select>
            )}
            {task.validationStatus === 'pending' && (
              <p className="text-[11px] text-[var(--purple)] mt-1.5">Already sent to {task.validatorName} — changing the validator here won&apos;t cancel that request.</p>
            )}
          </div>
        )}

        {/* Subtasks */}
        <div className="border-t border-[var(--border)] pt-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5">Subtasks</div>
          {task.subtasks.length > 0 && (
            <div className="flex flex-col gap-1 mb-2">
              {task.subtasks.map(st => (
                <div key={st.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md vx-tile">
                  <button
                    onClick={() => toggleSubtask(task.id, st.id)}
                    className={`w-[16px] h-[16px] rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center text-[9px] transition-all ${st.done ? 'bg-[var(--green-mid)] border-[var(--green-mid)] text-white' : 'border-[var(--border2)] text-transparent'}`}
                  >
                    {st.done ? '✓' : ''}
                  </button>
                  <span className={`text-[12px] flex-1 ${st.done ? 'line-through text-[var(--text3)]' : ''}`}>{st.title}</span>
                  <button onClick={() => removeSubtask(task.id, st.id)} className="btn-icon danger">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={subInput} onChange={e => setSubInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && subInput.trim()) { addSubtask(task.id, subInput.trim()); setSubInput('') } }}
              placeholder="Add subtask..."
              className="flex-1 vx-field" />
            <button
              onClick={() => { if (subInput.trim()) { addSubtask(task.id, subInput.trim()); setSubInput('') } }}
              className="vx-btn vx-btn-ghost text-xs"
            >
              + Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
        <button onClick={handleSave} disabled={titleOver || noteOver}
          className="vx-btn vx-btn-primary text-sm">
          Save Changes
        </button>
      </div>
    </Modal>
  )
}

function BlockTaskModal({ open, onClose, task, otherTasks, addTask, onLink }: {
  open: boolean; onClose: () => void; task: Task; otherTasks: Task[];
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'subtasks'>) => string;
  onLink: (blockerId: string, blockerTitle: string) => void;
}) {
  const [newTitle, setNewTitle] = useState('')

  function linkExisting(t: Task) {
    onLink(t.id, t.title)
    onClose()
  }

  function createAndLink() {
    const title = newTitle.trim()
    if (!title) return
    const id = addTask({
      title, note: '', zone: task.zone, priority: 'med', slot: '',
      deadline: null, date: task.date, level: '', isSpecial: false, specialPts: 0,
    })
    onLink(id, title)
    setNewTitle('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="🚫 Mark as blocked" variant="vx">
      <p className="text-sm text-[var(--text2)] mb-3">
        Blocked tasks need a dependency to point to. Pick the task it&apos;s waiting on, or create a new one.
      </p>
      {otherTasks.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3 max-h-[200px] overflow-y-auto">
          {otherTasks.map(t => (
            <button
              key={t.id}
              onClick={() => linkExisting(t)}
              className="vx-btn vx-btn-ghost text-left justify-start w-full text-[13px]"
            >
              {t.title}
            </button>
          ))}
        </div>
      )}
      {otherTasks.length === 0 && (
        <p className="text-xs text-[var(--text3)] mb-3">No other open tasks today — create one below to link as the blocker.</p>
      )}
      <div className="border-t border-[var(--border)] pt-3">
        <div className="text-xs text-[var(--text2)] mb-2">Or create a new blocking task:</div>
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createAndLink()}
            placeholder="New task name..."
            className="flex-1 vx-field"
          />
          <button
            onClick={createAndLink}
            className="vx-btn vx-btn-primary text-xs"
          >
            + Create &amp; Link
          </button>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button onClick={onClose} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
      </div>
    </Modal>
  )
}

function ChallengeModal({ open, onClose, friends, onSend, onSendGoal }: {
  open: boolean; onClose: () => void;
  friends: { uid: string; displayName: string }[];
  onSend: (friendUid: string, friendName: string, title: string, note: string, zoneId: string, priority: Priority) => void
  onSendGoal: (friendUid: string, friendName: string, title: string, taskTitles: string[], endDate: string, completionPoints: number, delayPoints: number) => void
}) {
  const [mode, setMode] = useState<'task' | 'goal'>('task')
  const [friendUid, setFriendUid] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [zoneId, setZoneId] = useState(CHALLENGE_ZONES[0].id)
  const [priority, setPriority] = useState<Priority>('high')

  // Goal mode: a repeatable list of task titles + a bounded end date + the
  // points the giver declares for completion vs. finishing after the deadline.
  const [goalTasks, setGoalTasks] = useState<string[]>([])
  const [goalTaskDraft, setGoalTaskDraft] = useState('')
  const [completionPts, setCompletionPts] = useState('30')
  const [delayPts, setDelayPts] = useState('15')
  const minEndDate = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`
  const maxEndDate = (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 2)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  })()
  const [endDate, setEndDate] = useState(maxEndDate)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('task'); setFriendUid(''); setTitle(''); setNote('')
    setZoneId(CHALLENGE_ZONES[0].id); setPriority('high')
    setGoalTasks([]); setGoalTaskDraft(''); setEndDate(maxEndDate)
    setCompletionPts('30'); setDelayPts('15'); setConfirmOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const friend = friends.find(f => f.uid === friendUid)

  function confirmSend() {
    if (!friend || !title.trim()) return
    if (mode === 'goal') {
      if (goalTasks.length === 0) return
      onSendGoal(friend.uid, friend.displayName, title.trim(), goalTasks, endDate, Math.max(0, +completionPts || 0), Math.max(0, +delayPts || 0))
    } else {
      onSend(friend.uid, friend.displayName, title.trim(), note.trim(), zoneId || CHALLENGE_ZONES[0].id, priority)
    }
    setConfirmOpen(false)
  }

  const canSend = !!friendUid && !!title.trim() && title.length <= MAX_TASK_NAME && (mode === 'task' || goalTasks.length > 0)

  return (
    <Modal open={open} onClose={onClose} title="🎯 Challenge a friend" variant="vx">
      <div className="flex gap-1.5 mb-3">
        <button onClick={() => setMode('task')}
          className={`vx-pill flex-1 justify-center text-xs ${mode === 'task' ? 'vx-tinted' : ''}`} data-tone={mode === 'task' ? 'violet' : undefined}>
          Single task
        </button>
        <button onClick={() => setMode('goal')}
          className={`vx-pill flex-1 justify-center text-xs ${mode === 'goal' ? 'vx-tinted' : ''}`} data-tone={mode === 'goal' ? 'violet' : undefined}>
          Goal (multiple tasks)
        </button>
      </div>
      <p className="text-sm text-[var(--text2)] mb-3">
        {mode === 'task'
          ? "Send a task straight onto their list. It shows up tagged with your name, and counts toward their own points once they do it — this doesn't touch your own tasks or pts."
          : "Send a checklist goal, time-bound by an end date. It shows up on their Goals with your name attached, tracked independently of your own goal."}
      </p>
      <div className="flex flex-col gap-2.5">
        <select value={friendUid} onChange={e => setFriendUid(e.target.value)}
          className="vx-field">
          <option value="">Choose a friend…</option>
          {friends.map(f => <option key={f.uid} value={f.uid}>{f.displayName}</option>)}
        </select>
        <LimitedField value={title} onChange={setTitle} max={MAX_TASK_NAME} placeholder={mode === 'task' ? 'Task name...' : 'Goal title...'} />

        {mode === 'task' ? (
          <>
            <div className="flex gap-2 flex-wrap">
              <select value={zoneId} onChange={e => setZoneId(e.target.value)}
                className="flex-1 min-w-[100px] vx-field">
                {/* Fixed set, not the challenger's own custom zones — see
                    resolveZone()/CHALLENGE_ZONES above for why. */}
                {CHALLENGE_ZONES.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                className="flex-1 min-w-[100px] vx-field">
                {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
              </select>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
              className="vx-field min-h-[60px] resize-y" />
          </>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap items-start">
              <div className="flex-1 min-w-[160px]">
                <LimitedField
                  value={goalTaskDraft} onChange={setGoalTaskDraft} max={MAX_TASK_NAME}
                  placeholder="Task in this goal... (Enter to add)"
                  onEnter={() => { if (!goalTaskDraft.trim()) return; setGoalTasks(l => [...l, goalTaskDraft.trim()]); setGoalTaskDraft('') }}
                />
              </div>
              <button
                onClick={() => { if (!goalTaskDraft.trim() || goalTaskDraft.length > MAX_TASK_NAME) return; setGoalTasks(l => [...l, goalTaskDraft.trim()]); setGoalTaskDraft('') }}
                disabled={!goalTaskDraft.trim() || goalTaskDraft.length > MAX_TASK_NAME}
                className="vx-btn vx-btn-ghost text-xs">
                + Add task
              </button>
            </div>
            {goalTasks.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {goalTasks.map((t, i) => (
                  <span key={i} className="vx-chip flex items-center gap-1.5" data-tone="violet">
                    {t}
                    <button onClick={() => setGoalTasks(l => l.filter((_, idx) => idx !== i))} className="text-[var(--text3)]">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-center flex-wrap">
              <label className="text-[12px] text-[var(--text3)]">End date (max 2 months out):</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                min={minEndDate} max={maxEndDate}
                className="vx-field" />
            </div>
            <div className="flex gap-2 items-center flex-wrap text-[12px] text-[var(--text3)]">
              <label>Points on completion:</label>
              <input type="number" min={0} max={500} value={completionPts} onChange={e => setCompletionPts(e.target.value)}
                className="w-20 vx-field" />
              <label>if late:</label>
              <input type="number" min={0} max={500} value={delayPts} onChange={e => setDelayPts(e.target.value)}
                className="w-20 vx-field" />
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
        <button onClick={() => setConfirmOpen(true)} disabled={!canSend}
          className="vx-btn vx-btn-accent text-sm">
          Send Challenge
        </button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm challenge" variant="vx">
        <p className="text-sm text-[var(--text2)] mb-3">
          Send {mode === 'goal' ? 'goal' : 'task'} <strong>&ldquo;{title.trim()}&rdquo;</strong> to <strong>{friend?.displayName}</strong>?
        </p>
        {mode === 'goal' ? (
          <p className="text-xs text-[var(--text3)] mb-3">
            {goalTasks.length} subtask{goalTasks.length === 1 ? '' : 's'} · by {endDate} · +{Math.max(0, +completionPts || 0)} pts ({Math.max(0, +delayPts || 0)} if late)
          </p>
        ) : (
          <p className="text-xs text-[var(--text3)] mb-3">
            {CHALLENGE_ZONES.find(z => z.id === zoneId)?.name ?? zoneId} · {PRIORITIES.find(p => p.val === priority)?.label ?? priority}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmOpen(false)} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
          <button onClick={confirmSend} className="vx-btn vx-btn-accent text-sm">
            Confirm &amp; Send
          </button>
        </div>
      </Modal>
    </Modal>
  )
}

interface NewTaskFields {
  title: string; note: string; zone: string; priority: Priority; slot: Slot;
  deadline: string | null; level: Level; isSpecial: boolean; specialPts: number;
}

/** Full Add Task form in a modal. A "Make this recurring" checkbox folds in
 *  the old Recurring-templates feature — the daily task is added now, and (if
 *  checked) a recurring template is created so it auto-populates future days. */
function AddTaskModal({ open, onClose, zones, onAdd, initialRecurring }: {
  open: boolean; onClose: () => void; zones: any[];
  onAdd: (t: NewTaskFields, recurring: boolean) => string
  /** Pre-checks the recurring checkbox — used when this modal is opened from
   *  the Recurring panel's "+ Add recurring task" button, so that entry point
   *  defaults to recurring=true while the normal "+ Add Task" button (no prop
   *  passed) still defaults to false. */
  initialRecurring?: boolean
}) {
  const [title, setTitle]       = useState('')
  const [note, setNote]         = useState('')
  const [zoneId, setZoneId]     = useState(zones[0]?.id ?? '')
  const [priority, setPriority] = useState<Priority>('high')
  const [slot, setSlot]         = useState<Slot>('')
  const [level, setLevel]       = useState<Level>('')
  const [deadline, setDeadline] = useState('')
  const [specialPts, setSpecialPts] = useState(30)
  const [recurring, setRecurring] = useState(!!initialRecurring)

  useEffect(() => {
    if (!open) return
    setTitle(''); setNote(''); setZoneId(zones[0]?.id ?? ''); setPriority('high')
    setSlot(''); setLevel(''); setDeadline(''); setSpecialPts(30); setRecurring(!!initialRecurring)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const titleOver = title.length > MAX_TASK_NAME
  const noteOver  = note.length > MAX_TASK_NOTE
  const canAdd    = !!title.trim() && !titleOver && !noteOver

  function handleAdd() {
    if (!canAdd) return
    onAdd({
      title: title.trim(), note: note.trim(), zone: zoneId || zones[0]?.id,
      priority, slot, deadline: deadline || null, level,
      isSpecial: priority === 'special', specialPts,
    }, recurring)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Task" variant="vx">
      <div className="flex flex-col gap-2.5">
        <LimitedField value={title} onChange={setTitle} max={MAX_TASK_NAME} placeholder="Task name..." autoFocus />
        <div className="flex gap-2 flex-wrap">
          <select value={zoneId} onChange={e => setZoneId(e.target.value)}
            className="flex-1 min-w-[100px] vx-field">
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
            className="flex-1 min-w-[100px] vx-field">
            {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
          </select>
          <select value={level} onChange={e => setLevel(e.target.value as Level)}
            className="flex-1 min-w-[90px] vx-field">
            {LEVELS.map(l => <option key={l.val} value={l.val}>{l.label}</option>)}
          </select>
        </div>
        {priority === 'special' && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-[var(--text2)]">⭐ Pts:</span>
            <input type="number" value={specialPts} onChange={e => setSpecialPts(+e.target.value)} min={1} max={200}
              className="w-20 vx-field" />
          </div>
        )}
        <LimitedField value={note} onChange={setNote} max={MAX_TASK_NOTE} placeholder="Note (optional)" textarea />
        <div className="flex gap-2 flex-wrap">
          <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} title="Time-bound: earns half points if not completed by this time"
            className="flex-1 min-w-[160px] vx-field" />
          <select value={slot} onChange={e => setSlot(e.target.value as Slot)}
            className="flex-1 min-w-[120px] vx-field">
            {SLOTS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
          </select>
        </div>
        {deadline && <div className="text-[11px] text-[var(--text3)] -mt-1">⏳ Time-bound — earns half points if not done by the selected time.</div>}
        <label className="flex items-center gap-2 text-[12px] text-[var(--text2)] cursor-pointer border-t border-[var(--border)] pt-2.5">
          <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
          🔁 Make this recurring (auto-adds it every day)
        </label>
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="vx-btn vx-btn-ghost text-sm">Cancel</button>
        <button onClick={handleAdd} disabled={!canAdd}
          className="vx-btn vx-btn-primary text-sm">
          + Add Task
        </button>
      </div>
    </Modal>
  )
}

