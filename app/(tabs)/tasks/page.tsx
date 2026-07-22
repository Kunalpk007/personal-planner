'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDayKey }       from '@/hooks/useDayKey'
import { usePlannerStore } from '@/store'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { showManagerMessage } from '@/ui/ManagerModal'
import { calcPts, basePts } from '@/lib/engine/scoring'
import { getTaskCompleteMessage } from '@/lib/engine/manager'
import type { Task, Priority, Slot, Level, RecurringTemplate } from '@/store/types'
import { useSocialStore } from '@/store/social/social.store'
import { FLAGS } from '@/constants/feature-flags'
import { CHALLENGE_ZONES } from '@/constants/social'
import { pad } from '@/lib/engine/cutoff'
import { FriendsPageContent } from '@/features/friends/components/FriendsPageContent'
import { GoalsCard } from '@/features/dashboard/components/GoalsCard'
import { SubmitArea } from '@/features/dashboard/components/SubmitArea'

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
      className="px-1.5 py-0.5 rounded-full border whitespace-nowrap"
      style={{
        background: overdue ? 'var(--red-bg)' : 'var(--amber-bg)',
        color:      overdue ? 'var(--red)'    : 'var(--amber)',
        borderColor: overdue ? '#E24B4A' : '#EF9F27',
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
  const border = over ? '#E24B4A' : 'var(--border2)'
  const common = `text-[13px] px-2.5 py-2 rounded-md bg-[var(--bg2)] text-[var(--text)] outline-none w-full ${className ?? ''}`
  return (
    <div className="w-full">
      {textarea ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ borderWidth: 1, borderStyle: 'solid', borderColor: border }}
          className={`${common} min-h-[60px] resize-y`}
        />
      ) : (
        <input
          value={value}
          autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && onEnter && !over) onEnter() }}
          placeholder={placeholder}
          style={{ borderWidth: 1, borderStyle: 'solid', borderColor: border }}
          className={common}
        />
      )}
      {over && <div className="text-[11px] text-[var(--red)] mt-0.5">Max length {max}</div>}
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
  const [mode, setMode] = useState<'normal' | 'recur' | 'goals' | 'friends'>('normal')
  const [zone, setZone] = useState('all')

  // Friends & Goals used to live elsewhere (own nav tab / dashboard) — now
  // they're modes here, deep-linkable via ?mode=friends / ?mode=goals (see
  // the redirect in app/(tabs)/friends/page.tsx and the notification bell).
  useEffect(() => {
    const m = searchParams.get('mode')
    if (m === 'recur' || m === 'friends' || m === 'goals') setMode(m)
  }, [searchParams])

  const allTasks  = usePlannerStore(s => s.tasks)
  const tasks     = useMemo(() => allTasks.filter(t => t.date === today), [allTasks, today])
  const recurring = usePlannerStore(s => s.recurring)
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
  const addRecurring    = usePlannerStore(s => s.addRecurring)
  const removeRecurring = usePlannerStore(s => s.removeRecurring)
  const editRecurring   = usePlannerStore(s => s.editRecurring)
  const injectRecurring = usePlannerStore(s => s.injectRecurring)

  const friends           = useSocialStore(s => s.friends)
  const requestValidation = useSocialStore(s => s.requestValidation)
  const sendChallenge     = useSocialStore(s => s.sendChallenge)
  const sendGoalChallenge = useSocialStore(s => s.sendGoalChallenge)
  const [challengeOpen, setChallengeOpen] = useState(false)

  // Add form state
  const [title,    setTitle]    = useState('')
  const [note,     setNote]     = useState('')
  const [zoneId,   setZoneId]   = useState(zones[0]?.id ?? '')
  const [priority, setPriority] = useState<Priority>('high')
  const [slot,     setSlot]     = useState<Slot>('')
  const [level,    setLevel]    = useState<Level>('')
  const [deadline, setDeadline] = useState('')
  const [specialPts, setSpecialPts] = useState(30)

  const titleOver = title.length > MAX_TASK_NAME
  const noteOver  = note.length > MAX_TASK_NOTE
  const canAdd    = !!title.trim() && !titleOver && !noteOver

  function handleAdd() {
    if (!title.trim()) return
    if (titleOver || noteOver) { showToast('Fix the highlighted fields first.'); return }
    addTask({
      title: title.trim(), note: note.trim(), zone: zoneId || zones[0]?.id,
      priority, slot, deadline: deadline || null, date: today, level,
      isSpecial: priority === 'special', specialPts,
    })
    setTitle(''); setNote(''); setDeadline('')
    showToast('Task added.')
  }

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
    .filter(t => zone === 'all' || t.zone === zone)
    .sort((a, b) => {
      if ((a.carriedDays ?? 0) !== (b.carriedDays ?? 0)) return (b.carriedDays ?? 0) - (a.carriedDays ?? 0)
      if (a.done !== b.done) return a.done ? 1 : -1
      const po = { special: -1, high: 0, med: 1, low: 2 }
      return (po[a.priority as keyof typeof po] ?? 0) - (po[b.priority as keyof typeof po] ?? 0)
    })

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex bg-[var(--bg3)] rounded-[10px] p-1 mb-3.5">
        {[
          { k: 'normal', l: "Today's Tasks" },
          { k: 'recur',  l: 'Recurring' },
          ...(FLAGS.GOALS   ? [{ k: 'goals',   l: 'Goals' }]   : []),
          ...(FLAGS.FRIENDS ? [{ k: 'friends', l: 'Friends' }] : []),
        ].map(m => (
          <button key={m.k} onClick={() => setMode(m.k as any)}
            className={`flex-1 text-center px-4 py-1.5 text-[13px] font-medium rounded-[7px] transition-all ${mode === m.k ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm' : 'text-[var(--text2)]'}`}>
            {m.l}
          </button>
        ))}
      </div>

      {mode === 'normal' && (
        <>
          {/* Zone filter */}
          <select
            value={zone}
            onChange={e => setZone(e.target.value)}
            className="w-auto min-w-[130px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none mb-3"
          >
            <option value="all">All zones</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>

          {/* Add form */}
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">Add Task</div>
          <div className="card mb-4">
            <div className="mb-2">
              <LimitedField value={title} onChange={setTitle} max={MAX_TASK_NAME} placeholder="Task name..." onEnter={handleAdd} />
            </div>
            <div className="flex gap-2 flex-wrap mb-2">
              <select value={zoneId} onChange={e => setZoneId(e.target.value)}
                className="flex-1 min-w-0 text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                className="flex-1 min-w-0 text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
                {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
              </select>
              <select value={level} onChange={e => setLevel(e.target.value as Level)}
                className="flex-1 min-w-0 text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
                {LEVELS.map(l => <option key={l.val} value={l.val}>{l.label}</option>)}
              </select>
            </div>
            {priority === 'special' && (
              <div className="flex gap-2 flex-wrap mb-2 items-center">
                <span className="text-xs text-[var(--text2)]">⭐ Pts:</span>
                <input type="number" value={specialPts} onChange={e => setSpecialPts(+e.target.value)} min={1} max={200}
                  className="w-20 text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
              </div>
            )}
            <div className="mb-2">
              <LimitedField value={note} onChange={setNote} max={MAX_TASK_NOTE} placeholder="Note (optional)" />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} title="Time-bound: earns half points if not completed by this time"
                className="flex-1 min-w-[140px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
              <select value={slot} onChange={e => setSlot(e.target.value as Slot)}
                className="flex-1 min-w-[110px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
                {SLOTS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
              </select>
              <button onClick={handleAdd} disabled={!canAdd}
                className="px-3.5 py-2 rounded-md text-xs font-semibold bg-[var(--green-bg)] text-[var(--green)] border-[1.5px] border-[var(--green-mid)] disabled:opacity-40">
                + Add Task
              </button>
              {FLAGS.FRIENDS && friends.length > 0 && (
                <button onClick={() => setChallengeOpen(true)} className="px-3.5 py-2 rounded-md text-xs font-semibold bg-[var(--purple-bg)] text-[var(--purple)] border-[1.5px] border-[#CECBF6]">
                  🎯 Challenge a friend
                </button>
              )}
            </div>
            {deadline && <div className="text-[11px] text-[var(--text3)] mt-1.5">⏳ Time-bound — earns half points if not done by the selected time.</div>}
          </div>

          {/* Task list */}
          <div className="mb-4">
            {filtered.length === 0 && <div className="text-[13px] text-[var(--text3)] py-3.5 text-center">No tasks yet. Add one above.</div>}
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
              onSendGoal={(friendUid, friendName, title, taskTitles, endDate) => {
                sendGoalChallenge(friendUid, friendName, title, taskTitles, endDate)
                setChallengeOpen(false)
                showToast(`Goal challenge sent to ${friendName}.`)
              }}
            />
          )}

          {/* Submit My Day — lives at the very bottom of the tasks list */}
          <SubmitArea today={today} />
        </>
      )}

      {mode === 'goals' && FLAGS.GOALS && (
        <>
          <div className="text-[11px] bg-[var(--bg3)] text-[var(--text2)] px-2.5 py-1 rounded-full border border-[var(--border)] inline-block mb-3">
            Manage goals in Settings → Goals. Progress shows here.
          </div>
          <GoalsCard today={today} />
        </>
      )}

      {mode === 'recur' && (
        <>
          <div className="text-[11px] bg-[var(--bg3)] text-[var(--text2)] px-2.5 py-1 rounded-full border border-[var(--border)] inline-block mb-3">
            Recurring tasks auto-populate each day.
          </div>
          <div className="mb-4">
            {recurring.length === 0 && <div className="text-[13px] text-[var(--text3)] py-3.5 text-center">No templates yet.</div>}
            {recurring.map(r => (
              <RecurRow key={r.id} r={r} zones={zones}
                onEdit={(updates) => editRecurring(r.id, updates)}
                onRemove={() => { removeRecurring(r.id); showToast('Template deleted.') }} />
            ))}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">Add Recurring Template</div>
          <AddRecurForm zones={zones} onAdd={(r) => { addRecurring(r); injectRecurring(today); showToast('Template added — added to today.') }} />
        </>
      )}

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
  const [editOpen, setEditOpen] = useState(false)
  const [delOpen, setDelOpen]   = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
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

  return (
    <>
      <div className={`flex items-start gap-2.5 p-3 rounded-[10px] border mb-2 ${task.done ? 'opacity-45' : ''} ${pinned && !task.done ? 'border-l-[3px] !border-l-[var(--purple)] bg-[var(--purple-bg)]' : 'bg-[var(--bg)] border-[var(--border)]'} ${task.carriedDays && !task.blocked ? 'border-l-[3px] !border-l-[var(--amber)] bg-[var(--amber-bg)]' : ''} ${task.blocked ? 'border-l-[3px] !border-l-[var(--red)] bg-[var(--red-bg)]' : ''}`}>
        <button
          onClick={handleCheckboxClick}
          disabled={(locked && !task.done) || isPendingValidation}
          title={isPendingValidation ? `Awaiting ${task.validatorName}` : awaitingValidation ? `Tap to send to ${task.validatorName} for validation` : undefined}
          className={`w-[21px] h-[21px] rounded-full border-[1.5px] flex-shrink-0 mt-0.5 flex items-center justify-center text-[11px] transition-all ${task.done ? 'bg-[var(--green-mid)] border-[var(--green-mid)] text-white' : isPendingValidation ? 'border-[var(--purple)] text-transparent' : 'border-[var(--border2)] text-transparent'}`}
        >
          {task.done ? '✓' : isPendingValidation ? '⏳' : ''}
        </button>

        {/* Main content — min-w-0 lets long text wrap instead of overflowing the tile */}
        <div className="flex-1 min-w-0">
          {/* Title row: title (wraps) on the left, edit/delete pinned top-right */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1 min-w-0">
              <span className={`text-[13px] break-words [overflow-wrap:anywhere] ${task.done ? 'line-through' : ''}`}>{task.title}</span>
              <span className={priBadgeClass(task)}>{priLabel(task)}</span>
              {task.level && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--purple-bg)] text-[var(--purple)] border border-[#CECBF6]">{task.level}</span>}
            </div>
            {!locked && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => setEditOpen(true)} className="btn-icon" title="Edit task" aria-label="Edit task"><EditIcon /></button>
                <button onClick={() => setDelOpen(true)} className="btn-icon danger" title="Delete task" aria-label="Delete task">×</button>
              </div>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-1.5 mt-0.5 text-[11px] text-[var(--text3)] min-w-0">
            {task.note && <span className="break-words [overflow-wrap:anywhere] min-w-0">{task.note}</span>}
            {task.deadline && !task.done && <Countdown deadline={task.deadline} done={task.done} />}
            {task.deadline && task.done && <span className="px-1.5 py-0.5 rounded-full bg-[var(--amber-bg)] text-[var(--amber)] border border-[#EF9F27]">⏰ {new Date(task.deadline).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
            {task.slot && <span>📍{task.slot}</span>}
            {task.challengedBy && <span className="px-1.5 py-0.5 rounded-full bg-[var(--purple-bg)] text-[var(--purple)] border border-[#CECBF6]">🎯 Challenged by {task.challengedBy}</span>}
            {isPendingValidation && <span className="px-1.5 py-0.5 rounded-full bg-[var(--purple-bg)] text-[var(--purple)] border border-[#CECBF6]">⏳ Awaiting {task.validatorName}</span>}
            {task.validationStatus === 'rejected' && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--red-bg)] text-[var(--red)] border border-[#E24B4A]">
                ❌ Rejected{task.validationNote ? `: ${task.validationNote}` : ''} — tap to resend
              </span>
            )}
            {task.blocked ? (
              <span className="text-[var(--red)] font-semibold break-words [overflow-wrap:anywhere]">🚫 Blocked by: {task.blockedByTitle ?? 'linked task'}</span>
            ) : task.carriedDays ? (
              <span className="text-[var(--amber)] font-semibold">↩ carried {task.carriedDays}d (-{task.carriedDays * 2}pts)</span>
            ) : null}
            {task.completedAt && <span className="text-[var(--green)]">✓ {new Date(task.completedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
          </div>

          {/* Footer row: zone, points, focus star */}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className="zpill" style={{ background: `${zone.color}22`, color: zone.color, borderColor: `${zone.color}88` }}>{zone.name}</span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <span className={`text-xs font-semibold whitespace-nowrap mr-0.5 ${task.done ? 'text-[var(--green)]' : overdue ? 'text-[var(--red)]' : 'text-[var(--text3)]'}`}>+{pts}{overdue ? ' ½' : ''}</span>
              {!locked && <button onClick={onPin} className={`btn-icon ${pinned ? 'active' : ''}`} title={pinned ? 'Remove focus' : 'Select to focus this task'}>{pinned ? '★' : '☆'}</button>}
            </div>
          </div>
        </div>
      </div>
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
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete task?">
        <p className="text-sm text-[var(--text2)] mb-3">Why are you deleting &ldquo;{task.title}&rdquo;?</p>
        <div className="flex flex-col gap-1.5 mb-3">
          {DELETE_REASONS.map(r => (
            <button
              key={r}
              onClick={() => { onRemove(r); setDelOpen(false) }}
              className="text-left px-3 py-2 rounded-md text-[13px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] hover:bg-[var(--bg3)]"
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={() => setDelOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
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

  // Re-seed the draft whenever the modal is (re)opened for a task
  useEffect(() => {
    if (!open) return
    setTitle(task.title); setNote(task.note); setZoneId(task.zone)
    setPriority(task.priority); setSlot(task.slot); setLevel(task.level)
    setDeadline(task.deadline ? task.deadline.slice(0, 16) : '')
    setSpecialPts(task.specialPts)
    setNeedsValidation(!!task.needsValidation)
    setValidatorUid(task.validatorUid ?? '')
  }, [open, task])

  const titleOver = title.length > MAX_TASK_NAME
  const noteOver  = note.length > MAX_TASK_NOTE

  function handleSave() {
    if (!title.trim()) return
    if (titleOver || noteOver) { showToast('Fix the highlighted fields first.'); return }
    const validator = friends.find(f => f.uid === validatorUid)
    onSave({
      title: title.trim(), note: note.trim(), zone: zoneId || zones[0]?.id,
      priority, slot, level, deadline: deadline || null,
      isSpecial: priority === 'special', specialPts,
      ...(needsValidation && validator
        ? { needsValidation: true, validatorUid: validator.uid, validatorName: validator.displayName }
        : { needsValidation: false, validatorUid: undefined, validatorName: undefined, validationStatus: undefined, validationNote: undefined }),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Task">
      <div className="flex flex-col gap-2.5">
        <LimitedField value={title} onChange={setTitle} max={MAX_TASK_NAME} placeholder="Task name..." />

        <div className="flex gap-2 flex-wrap">
          <select value={zoneId} onChange={e => setZoneId(e.target.value)}
            className="flex-1 min-w-[100px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
            className="flex-1 min-w-[100px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
            {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
          </select>
          <select value={level} onChange={e => setLevel(e.target.value as Level)}
            className="flex-1 min-w-[90px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
            {LEVELS.map(l => <option key={l.val} value={l.val}>{l.label}</option>)}
          </select>
        </div>

        {priority === 'special' && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-[var(--text2)]">⭐ Pts:</span>
            <input type="number" value={specialPts} onChange={e => setSpecialPts(+e.target.value)} min={1} max={200}
              className="w-20 text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
          </div>
        )}

        <LimitedField value={note} onChange={setNote} max={MAX_TASK_NOTE} placeholder="Note (optional)" textarea />

        <div className="flex gap-2 flex-wrap">
          <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} title="Time-bound: earns half points if not completed by this time"
            className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
          <select value={slot} onChange={e => setSlot(e.target.value as Slot)}
            className="flex-1 min-w-[120px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
            {SLOTS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
          </select>
        </div>
        {deadline && <div className="text-[11px] text-[var(--text3)] -mt-1">⏳ Time-bound — half points if not done by the selected time.</div>}

        {/* Block task — moved here from the tile; opens the dependency picker */}
        <div className="border-t border-[var(--border)] pt-2.5">
          {task.blocked ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[var(--red)] break-words [overflow-wrap:anywhere] min-w-0">🚫 Blocked by: {task.blockedByTitle ?? 'linked task'}</span>
              <button onClick={() => { onUnblock(); onClose() }}
                className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]">
                Unblock
              </button>
            </div>
          ) : (
            <button onClick={onOpenBlock}
              className="px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
              style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: '#E24B4A' }}>
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
                className="w-full text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
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
                <div key={st.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)]">
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
              className="flex-1 text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
            <button
              onClick={() => { if (subInput.trim()) { addSubtask(task.id, subInput.trim()); setSubInput('') } }}
              className="px-3 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]"
            >
              + Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
        <button onClick={handleSave} disabled={titleOver || noteOver}
          className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)] disabled:opacity-40">
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
    <Modal open={open} onClose={onClose} title="🚫 Mark as blocked">
      <p className="text-sm text-[var(--text2)] mb-3">
        Blocked tasks need a dependency to point to. Pick the task it&apos;s waiting on, or create a new one.
      </p>
      {otherTasks.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3 max-h-[200px] overflow-y-auto">
          {otherTasks.map(t => (
            <button
              key={t.id}
              onClick={() => linkExisting(t)}
              className="text-left px-3 py-2 rounded-md text-[13px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] hover:bg-[var(--bg3)]"
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
            className="flex-1 text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none"
          />
          <button
            onClick={createAndLink}
            className="px-3.5 py-2 rounded-md text-xs font-semibold bg-[var(--green-bg)] text-[var(--green)] border-[1.5px] border-[var(--green-mid)]"
          >
            + Create &amp; Link
          </button>
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <button onClick={onClose} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
      </div>
    </Modal>
  )
}

function ChallengeModal({ open, onClose, friends, onSend, onSendGoal }: {
  open: boolean; onClose: () => void;
  friends: { uid: string; displayName: string }[];
  onSend: (friendUid: string, friendName: string, title: string, note: string, zoneId: string, priority: Priority) => void
  onSendGoal: (friendUid: string, friendName: string, title: string, taskTitles: string[], endDate: string) => void
}) {
  const [mode, setMode] = useState<'task' | 'goal'>('task')
  const [friendUid, setFriendUid] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [zoneId, setZoneId] = useState(CHALLENGE_ZONES[0].id)
  const [priority, setPriority] = useState<Priority>('high')

  // Goal mode: a repeatable list of task titles + a bounded end date.
  const [goalTasks, setGoalTasks] = useState<string[]>([])
  const [goalTaskDraft, setGoalTaskDraft] = useState('')
  const minEndDate = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`
  const maxEndDate = (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 2)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  })()
  const [endDate, setEndDate] = useState(maxEndDate)

  useEffect(() => {
    if (!open) return
    setMode('task'); setFriendUid(''); setTitle(''); setNote('')
    setZoneId(CHALLENGE_ZONES[0].id); setPriority('high')
    setGoalTasks([]); setGoalTaskDraft(''); setEndDate(maxEndDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleSend() {
    const friend = friends.find(f => f.uid === friendUid)
    if (!friend || !title.trim()) return
    if (mode === 'goal') {
      if (goalTasks.length === 0) return
      onSendGoal(friend.uid, friend.displayName, title.trim(), goalTasks, endDate)
    } else {
      onSend(friend.uid, friend.displayName, title.trim(), note.trim(), zoneId || CHALLENGE_ZONES[0].id, priority)
    }
  }

  const canSend = !!friendUid && !!title.trim() && (mode === 'task' || goalTasks.length > 0)

  return (
    <Modal open={open} onClose={onClose} title="🎯 Challenge a friend">
      <div className="flex gap-1.5 mb-3">
        <button onClick={() => setMode('task')}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium border ${mode === 'task' ? 'bg-[var(--purple-bg)] text-[var(--purple)] border-[#CECBF6]' : 'border-[var(--border2)] bg-[var(--bg2)] text-[var(--text2)]'}`}>
          Single task
        </button>
        <button onClick={() => setMode('goal')}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium border ${mode === 'goal' ? 'bg-[var(--purple-bg)] text-[var(--purple)] border-[#CECBF6]' : 'border-[var(--border2)] bg-[var(--bg2)] text-[var(--text2)]'}`}>
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
          className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
          <option value="">Choose a friend…</option>
          {friends.map(f => <option key={f.uid} value={f.uid}>{f.displayName}</option>)}
        </select>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={mode === 'task' ? 'Task name...' : 'Goal title...'}
          className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />

        {mode === 'task' ? (
          <>
            <div className="flex gap-2 flex-wrap">
              <select value={zoneId} onChange={e => setZoneId(e.target.value)}
                className="flex-1 min-w-[100px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
                {/* Fixed set, not the challenger's own custom zones — see
                    resolveZone()/CHALLENGE_ZONES above for why. */}
                {CHALLENGE_ZONES.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                className="flex-1 min-w-[100px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
                {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
              </select>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
              className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none min-h-[60px] resize-y" />
          </>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap items-center">
              <input
                value={goalTaskDraft}
                onChange={e => setGoalTaskDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter' || !goalTaskDraft.trim()) return
                  setGoalTasks(l => [...l, goalTaskDraft.trim()]); setGoalTaskDraft('')
                }}
                placeholder="Task in this goal... (Enter to add)"
                className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
              <button
                onClick={() => { if (!goalTaskDraft.trim()) return; setGoalTasks(l => [...l, goalTaskDraft.trim()]); setGoalTaskDraft('') }}
                className="px-3 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]">
                + Add task
              </button>
            </div>
            {goalTasks.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {goalTasks.map((t, i) => (
                  <span key={i} className="text-[12px] px-2 py-1 rounded-full border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] flex items-center gap-1.5">
                    {t}
                    <button onClick={() => setGoalTasks(l => l.filter((_, idx) => idx !== i))} className="text-[var(--text3)]">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-center">
              <label className="text-[12px] text-[var(--text3)]">End date (max 2 months out):</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                min={minEndDate} max={maxEndDate}
                className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
        <button onClick={handleSend} disabled={!canSend}
          className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--purple-bg)] text-[var(--purple)] border border-[#CECBF6] disabled:opacity-40">
          Send Challenge
        </button>
      </div>
    </Modal>
  )
}

function RecurRow({ r, zones, onEdit, onRemove }: {
  r: RecurringTemplate; zones: any[];
  onEdit: (updates: Partial<RecurringTemplate>) => void; onRemove: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [delOpen, setDelOpen]   = useState(false)

  return (
    <>
      <div className="flex items-center gap-2.5 p-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] mb-2">
        <div className="flex-1">
          <span className="text-[13px] font-medium">{r.title}</span>
          <span className={`ml-2 ${priBadgeClass({ isSpecial: r.isSpecial, priority: r.priority } as Task)}`}>
            {r.isSpecial ? '⭐' : ({ high: 'H', med: 'M', low: 'L', special: '⭐' } as Record<string,string>)[r.priority]}
          </span>
          {r.level && <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--purple-bg)] text-[var(--purple)] border border-[#CECBF6]">{r.level}</span>}
          {r.note && <div className="text-[11px] text-[var(--text3)] mt-0.5">{r.note}</div>}
        </div>
        <button onClick={() => setEditOpen(true)} className="btn-icon">✏</button>
        <button onClick={() => setDelOpen(true)} className="btn-icon danger">×</button>
      </div>
      <EditRecurringModal open={editOpen} onClose={() => setEditOpen(false)} template={r} zones={zones} onSave={onEdit} />
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete recurring template?">
        <p className="text-sm text-[var(--text2)] mb-3">Why are you deleting &ldquo;{r.title}&rdquo;?</p>
        <div className="flex flex-col gap-1.5 mb-3">
          {DELETE_REASONS.map(reason => (
            <button
              key={reason}
              onClick={() => { onRemove(); setDelOpen(false) }}
              className="text-left px-3 py-2 rounded-md text-[13px] border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] hover:bg-[var(--bg3)]"
            >
              {reason}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={() => setDelOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
        </div>
      </Modal>
    </>
  )
}

function EditRecurringModal({ open, onClose, template, zones, onSave }: {
  open: boolean; onClose: () => void; template: RecurringTemplate; zones: any[];
  onSave: (updates: Partial<RecurringTemplate>) => void
}) {
  const [title,    setTitle]    = useState(template.title)
  const [note,     setNote]     = useState(template.note)
  const [zoneId,   setZoneId]   = useState(template.zone)
  const [priority, setPriority] = useState<Priority>(template.priority)
  const [slot,     setSlot]     = useState<Slot>(template.slot)
  const [level,    setLevel]    = useState<Level>(template.level)
  const [specialPts, setSpecialPts] = useState(template.specialPts)

  // Re-seed the draft whenever the modal is (re)opened for a template
  useEffect(() => {
    if (!open) return
    setTitle(template.title); setNote(template.note); setZoneId(template.zone)
    setPriority(template.priority); setSlot(template.slot); setLevel(template.level)
    setSpecialPts(template.specialPts)
  }, [open, template])

  function handleSave() {
    if (!title.trim()) return
    onSave({
      title: title.trim(), note: note.trim(), zone: zoneId || zones[0]?.id,
      priority, slot, level, isSpecial: priority === 'special', specialPts,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Recurring Template">
      <div className="flex flex-col gap-2.5">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Recurring task name..."
          className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />

        <div className="flex gap-2 flex-wrap">
          <select value={zoneId} onChange={e => setZoneId(e.target.value)}
            className="flex-1 min-w-[100px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
            className="flex-1 min-w-[100px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
            {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
          </select>
          <select value={level} onChange={e => setLevel(e.target.value as Level)}
            className="flex-1 min-w-[90px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
            {LEVELS.map(l => <option key={l.val} value={l.val}>{l.label}</option>)}
          </select>
        </div>

        {priority === 'special' && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-[var(--text2)]">⭐ Pts:</span>
            <input type="number" value={specialPts} onChange={e => setSpecialPts(+e.target.value)} min={1} max={200}
              className="w-20 text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
          </div>
        )}

        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
          className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none min-h-[60px] resize-y" />

        <select value={slot} onChange={e => setSlot(e.target.value as Slot)}
          className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
          {SLOTS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
        </select>
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
        <button onClick={handleSave} className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
          Save Changes
        </button>
      </div>
    </Modal>
  )
}

function AddRecurForm({ zones, onAdd }: { zones: any[]; onAdd: (r: any) => void }) {
  const [title, setTitle] = useState('')
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '')
  const [priority, setPriority] = useState<Priority>('high')
  const [slot, setSlot] = useState<Slot>('')
  const [level, setLevel] = useState<Level>('')
  const [note, setNote] = useState('')

  return (
    <div className="card">
      <div className="flex gap-2 flex-wrap mb-2">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Recurring task name..."
          className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
        <select value={zoneId} onChange={e => setZoneId(e.target.value)} className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
          {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
        </select>
        <select value={level} onChange={e => setLevel(e.target.value as Level)} className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
          {LEVELS.map(l => <option key={l.val} value={l.val}>{l.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note" className="flex-1 text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
        <select value={slot} onChange={e => setSlot(e.target.value as Slot)} className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
          {SLOTS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
        </select>
        <button onClick={() => { if (!title.trim()) return; onAdd({ title: title.trim(), note: note.trim(), zone: zoneId, priority, slot, level, isSpecial: priority === 'special', specialPts: 30 }); setTitle(''); setNote('') }}
          className="px-3.5 py-2 rounded-md text-xs font-semibold bg-[var(--green-bg)] text-[var(--green)] border-[1.5px] border-[var(--green-mid)]">
          + Add Task
        </button>
      </div>
    </div>
  )
}
