'use client'
import { useMemo, useState } from 'react'
import { useDayKey }       from '@/hooks/useDayKey'
import { usePlannerStore } from '@/store'
import { Modal }           from '@/ui/Modal'
import { showToast }       from '@/ui/Toast'
import { showManagerMessage } from '@/ui/ManagerModal'
import { uid }             from '@/lib/engine/cutoff'
import { calcPts, basePts } from '@/lib/engine/scoring'
import { getTaskCompleteMessage } from '@/lib/engine/manager'
import type { Task, Priority, Slot, Level } from '@/store/types'

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
  const { today }    = useDayKey()
  const [mode, setMode] = useState<'normal' | 'recur'>('normal')
  const [zone, setZone] = useState('all')

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
  const addRecurring  = usePlannerStore(s => s.addRecurring)
  const removeRecurring = usePlannerStore(s => s.removeRecurring)

  // Add form state
  const [title,    setTitle]    = useState('')
  const [note,     setNote]     = useState('')
  const [zoneId,   setZoneId]   = useState(zones[0]?.id ?? '')
  const [priority, setPriority] = useState<Priority>('high')
  const [slot,     setSlot]     = useState<Slot>('')
  const [level,    setLevel]    = useState<Level>('')
  const [deadline, setDeadline] = useState('')
  const [specialPts, setSpecialPts] = useState(30)

  function handleAdd() {
    if (!title.trim()) return
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
      <div className="inline-flex bg-[var(--bg3)] rounded-[10px] p-1 mb-3.5">
        {[{k:'normal',l:"Today's tasks"},{k:'recur',l:'Recurring templates'}].map(m => (
          <button key={m.k} onClick={() => setMode(m.k as any)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-[7px] transition-all ${mode === m.k ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm' : 'text-[var(--text2)]'}`}>
            {m.l}
          </button>
        ))}
      </div>

      {mode === 'normal' && (
        <>
          {/* Zone filter */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {[{ id: 'all', name: 'All', color: '' }, ...zones].map(z => (
              <button key={z.id} onClick={() => setZone(z.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${zone === z.id ? 'bg-[var(--bg3)] text-[var(--text)]' : 'bg-[var(--bg)] text-[var(--text2)]'}`}
                style={{ borderColor: z.color ? `${z.color}88` : 'var(--border2)' }}>
                {z.name}
              </button>
            ))}
          </div>

          {/* Add form */}
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">Add task</div>
          <div className="card mb-4">
            <div className="flex gap-2 flex-wrap mb-2">
              <input value={title} onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Task name..."
                className="flex-1 min-w-[160px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
              <select value={zoneId} onChange={e => setZoneId(e.target.value)}
                className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
                {PRIORITIES.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
              </select>
              <select value={level} onChange={e => setLevel(e.target.value as Level)}
                className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
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
            <div className="flex gap-2 flex-wrap items-center">
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
                className="flex-1 min-w-[180px] text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
              <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="Date"
                className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
              <select value={slot} onChange={e => setSlot(e.target.value as Slot)}
                className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none">
                {SLOTS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
              </select>
              <button onClick={handleAdd} className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
                + Add
              </button>
            </div>
          </div>

          {/* Task list */}
          <div className="mb-4">
            {filtered.length === 0 && <div className="text-[13px] text-[var(--text3)] py-3.5 text-center">No tasks yet. Add one above.</div>}
            {filtered.map(t => (
              <TaskRow key={t.id} task={t} zones={zones} pinned={pinned === t.id}
                locked={submitted} onToggle={() => handleToggle(t.id)}
                onPin={() => pinTask(t.id)}
                onRemove={(reason) => { removeTask(t.id); logChange('task-deleted', `"${t.title}" — ${reason}`); showToast('Task deleted.') }}
                onEdit={(updates) => editTask(t.id, updates)}
                mood={mood} cfg={cfg} />
            ))}
          </div>
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
              <div key={r.id} className="flex items-center gap-2.5 p-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] mb-2">
                <div className="flex-1">
                  <span className="text-[13px] font-medium">{r.title}</span>
                  <span className={`ml-2 ${priBadgeClass({ isSpecial: r.isSpecial, priority: r.priority } as Task)}`}>
                    {r.isSpecial ? '⭐' : ({ high: 'H', med: 'M', low: 'L', special: '⭐' } as Record<string,string>)[r.priority]}
                  </span>
                  {r.level && <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--purple-bg)] text-[var(--purple)] border border-[#CECBF6]">{r.level}</span>}
                  {r.note && <div className="text-[11px] text-[var(--text3)] mt-0.5">{r.note}</div>}
                </div>
                <button onClick={() => removeRecurring(r.id)} className="btn-icon danger">×</button>
              </div>
            ))}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">Add recurring template</div>
          <AddRecurForm zones={zones} onAdd={(r) => { addRecurring(r); showToast('Template added.') }} />
        </>
      )}
    </div>
  )
}

function TaskRow({ task, zones, pinned, locked, onToggle, onPin, onRemove, onEdit, mood, cfg }: {
  task: Task; zones: any[]; pinned: boolean; locked: boolean;
  onToggle: () => void; onPin: () => void; onRemove: (reason: string) => void;
  onEdit: (u: Partial<Task>) => void; mood?: string; cfg: any;
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [delOpen, setDelOpen]   = useState(false)
  const zone = zones.find(z => z.id === task.zone) ?? { name: task.zone, color: '#888' }
  const pts  = task.done ? calcPts(task) : basePts(task)

  return (
    <>
      <div className={`flex flex-wrap items-start gap-2.5 p-3 rounded-[10px] border mb-2 ${task.done ? 'opacity-45' : ''} ${pinned && !task.done ? 'border-l-[3px] !border-l-[var(--purple)] bg-[var(--purple-bg)]' : 'bg-[var(--bg)] border-[var(--border)]'} ${task.carriedDays ? 'border-l-[3px] !border-l-[var(--amber)] bg-[var(--amber-bg)]' : ''}`}>
        <button
          onClick={onToggle}
          disabled={locked && !task.done}
          className={`w-[21px] h-[21px] rounded-full border-[1.5px] flex-shrink-0 mt-0.5 flex items-center justify-center text-[11px] transition-all ${task.done ? 'bg-[var(--green-mid)] border-[var(--green-mid)] text-white' : 'border-[var(--border2)] text-transparent'}`}
        >
          {task.done ? '✓' : ''}
        </button>
        <div className="flex-1 min-w-[120px]">
          <div className="flex items-center flex-wrap gap-1">
            <span className={`text-[13px] ${task.done ? 'line-through' : ''}`}>{task.title}</span>
            <span className={priBadgeClass(task)}>{priLabel(task)}</span>
            {task.level && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--purple-bg)] text-[var(--purple)] border border-[#CECBF6]">{task.level}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-0.5 text-[11px] text-[var(--text3)]">
            {task.note && <span>{task.note}</span>}
            {task.deadline && <span className="px-1.5 py-0.5 rounded-full bg-[var(--amber-bg)] text-[var(--amber)] border border-[#EF9F27]">⏰ {new Date(task.deadline).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
            {task.slot && <span>📍{task.slot}</span>}
            {task.carriedDays ? <span className="text-[var(--amber)] font-semibold">↩ carried {task.carriedDays}d (-{task.carriedDays * 2}pts)</span> : null}
            {task.completedAt && <span className="text-[var(--green)]">✓ {new Date(task.completedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 basis-full sm:basis-auto justify-between sm:justify-end pl-[29px] sm:pl-0">
          <span className="zpill" style={{ background: `${zone.color}22`, color: zone.color, borderColor: `${zone.color}88` }}>{zone.name}</span>
          <div className="flex items-center gap-0.5">
            <span className={`text-xs font-semibold whitespace-nowrap mr-0.5 ${task.done ? 'text-[var(--green)]' : 'text-[var(--text3)]'}`}>+{pts}</span>
            {!locked && <button onClick={onPin} className={`btn-icon ${pinned ? 'active' : ''}`} title={pinned ? 'Remove focus' : 'Select to focus this task'}>{pinned ? '★' : '☆'}</button>}
            {!locked && <button onClick={() => setEditOpen(true)} className="btn-icon">✏</button>}
            {!locked && <button onClick={() => setDelOpen(true)} className="btn-icon danger">×</button>}
          </div>
        </div>
      </div>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit task">
        <div className="text-sm text-[var(--text2)]">Full edit form — priority, note, deadline, slot, subtasks.</div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={() => setEditOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Close</button>
        </div>
      </Modal>
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
          className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
          + Add
        </button>
      </div>
    </div>
  )
}
