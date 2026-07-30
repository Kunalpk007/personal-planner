'use client'
import { useEffect, useState } from 'react'
import { usePlannerStore } from '@/store'
import { Modal } from '@/ui/Modal'
import { showToast } from '@/ui/Toast'
import type { Goal, GoalPointsMode } from '@/store/types'

const MAX_GOAL_TITLE   = 30
const MAX_GOAL_SUBTASK = 30
const MAX_GOAL_NOTE    = 200

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

/** Small countdown pill for a goal's deadline (date-only). */
function GoalDeadline({ endDate }: { endDate: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const overdue = today > endDate
  return (
    <span
      className="px-1.5 py-0.5 rounded-full border whitespace-nowrap text-[11px]"
      style={{
        background: overdue ? 'var(--red-bg)' : 'var(--amber-bg)',
        color:      overdue ? 'var(--red)'    : 'var(--amber)',
        borderColor: overdue ? '#E24B4A' : '#EF9F27',
      }}
    >
      {overdue ? '⏳ Overdue · reduced pts' : `⏳ by ${endDate}`}
    </span>
  )
}

function fullPoints(g: Goal): number {
  if (g.pointsMode === 'perSubtask') return (g.checklist ?? []).reduce((s, i) => s + (i.points ?? 0), 0)
  return g.points ?? 0
}

export function GoalTile({ goal }: { goal: Goal }) {
  const toggleItem     = usePlannerStore(s => s.toggleGoalChecklistItem)
  const completeGoal   = usePlannerStore(s => s.completeGoal)
  const uncompleteGoal = usePlannerStore(s => s.uncompleteGoal)
  const removeGoal     = usePlannerStore(s => s.removeGoal)
  const setGoalNote  = usePlannerStore(s => s.setGoalNote)

  const [editOpen, setEditOpen]     = useState(false)
  const [delOpen, setDelOpen]       = useState(false)
  const [noteOpen, setNoteOpen]     = useState(false)
  const [noteDraft, setNoteDraft]   = useState(goal.note ?? '')

  const items = goal.checklist ?? []
  const doneCount = items.filter(i => i.done).length
  const allDone = items.length === 0 || items.every(i => i.done)
  const completed = !!goal.completedAt
  const pts = fullPoints(goal)

  function handleComplete() {
    if (completed) {
      const r = uncompleteGoal(goal.id)
      if (r) showToast(`Goal unmarked — -${r.pts} RXP · -${r.walletPts} 🪙 reversed.`)
      return
    }
    if (!allDone) { showToast('Finish all subtasks first.'); return }
    const r = completeGoal(goal.id)
    if (r) showToast(`🎯 Goal complete! +${r.pts} RXP · +${r.walletPts} 🪙`)
  }

  function handleToggleItem(itemId: string) {
    const r = toggleItem(goal.id, itemId)
    if (r) showToast(`Goal unmarked — -${r.pts} RXP · -${r.walletPts} 🪙 reversed.`)
  }

  function saveNote() {
    setGoalNote(goal.id, noteDraft.trim())
    setNoteOpen(false)
    showToast('Note saved.')
  }

  return (
    <>
      <div className={`flex items-start gap-2.5 p-3 rounded-[10px] border mb-2 bg-[var(--bg)] border-[var(--border)] ${completed ? 'opacity-45' : ''} border-l-[3px] !border-l-[var(--blue)]`}>
        {/* Complete checkbox — enabled only once every subtask is done */}
        <button
          onClick={handleComplete}
          disabled={!completed && !allDone}
          title={completed ? 'Completed — click to unmark' : allDone ? 'Mark goal complete' : 'Finish all subtasks first'}
          className={`w-[21px] h-[21px] rounded-full border-[1.5px] flex-shrink-0 mt-0.5 flex items-center justify-center text-[11px] transition-all ${completed ? 'bg-[var(--green-mid)] border-[var(--green-mid)] text-white' : allDone ? 'border-[var(--green-mid)] text-[var(--green)]' : 'border-[var(--border2)] text-transparent'}`}
        >
          {completed ? '✓' : allDone ? '✓' : ''}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1 min-w-0">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--blue-bg)] text-[var(--blue)] border border-[var(--blue)]">GOAL</span>
              <span className={`text-[13px] break-words [overflow-wrap:anywhere] ${completed ? 'line-through' : ''}`}>{goal.title}</span>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => setEditOpen(true)} className="btn-icon" title="Edit goal" aria-label="Edit goal"><EditIcon /></button>
              <button onClick={() => setDelOpen(true)} className="btn-icon danger" title="Delete goal" aria-label="Delete goal">×</button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-1.5 mt-0.5 text-[11px] text-[var(--text3)] min-w-0">
            {goal.challengedBy && <span className="px-1.5 py-0.5 rounded-full bg-[var(--purple-bg)] text-[var(--purple)] border border-[#CECBF6]">🎯 From {goal.challengedBy}</span>}
            {goal.endDate && <GoalDeadline endDate={goal.endDate} />}
            {items.length > 0 && <span>{doneCount}/{items.length} done</span>}
          </div>

          {/* Subtasks */}
          {items.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {items.map(item => (
                <label key={item.id} className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                  <input type="checkbox" checked={item.done} onChange={() => handleToggleItem(item.id)} />
                  <span className="break-words [overflow-wrap:anywhere] min-w-0 flex-1" style={{ textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--text3)' : 'var(--text2)' }}>
                    {item.title}
                  </span>
                  {goal.pointsMode === 'perSubtask' && item.points != null && (
                    <span className="text-[11px] text-[var(--text3)] flex-shrink-0">+{item.points}</span>
                  )}
                </label>
              ))}
            </div>
          )}

          {/* Note */}
          {goal.note && !noteOpen && (
            <div className="mt-1.5 text-[11px] text-[var(--text2)] bg-[var(--bg2)] rounded-md px-2 py-1 break-words [overflow-wrap:anywhere]">📝 {goal.note}</div>
          )}
          {noteOpen && (
            <div className="mt-1.5">
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value.slice(0, MAX_GOAL_NOTE))}
                placeholder="Goal note..."
                className="w-full text-[12px] px-2 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none min-h-[48px] resize-y"
              />
              <div className="flex gap-2 justify-end mt-1">
                <button onClick={() => { setNoteOpen(false); setNoteDraft(goal.note ?? '') }} className="text-[11px] px-2 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)]">Cancel</button>
                <button onClick={saveNote} className="text-[11px] px-2 py-1 rounded-md bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">Save note</button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            {!goal.note && !noteOpen
              ? <button onClick={() => setNoteOpen(true)} className="text-[11px] text-[var(--text3)]">＋ Note</button>
              : !noteOpen ? <button onClick={() => { setNoteDraft(goal.note ?? ''); setNoteOpen(true) }} className="text-[11px] text-[var(--text3)]">Edit note</button> : <span />}
            <span className={`text-xs font-semibold whitespace-nowrap ${completed ? 'text-[var(--green)]' : 'text-[var(--text3)]'}`}>+{pts}{goal.endDate && new Date().toISOString().slice(0,10) > goal.endDate ? ' (reduced)' : ''}</span>
          </div>
        </div>
      </div>

      <GoalFormModal open={editOpen} onClose={() => setEditOpen(false)} goal={goal} />

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete goal?">
        <p className="text-sm text-[var(--text2)] mb-4">Delete &ldquo;{goal.title}&rdquo;? This can&apos;t be undone.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDelOpen(false)} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
          <button onClick={() => { removeGoal(goal.id); setDelOpen(false); showToast('Goal deleted.') }}
            className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--red-bg)] text-[var(--red)] border border-[#E24B4A]">Delete</button>
        </div>
      </Modal>
    </>
  )
}

interface SubDraft { id: string; title: string; points: string }

/** Create OR edit a goal. Points model: whole-goal points, or points per
 *  subtask. Deadline optional; note optional. */
export function GoalFormModal({ open, onClose, goal }: { open: boolean; onClose: () => void; goal?: Goal }) {
  const addGoal  = usePlannerStore(s => s.addGoal)
  const editGoal = usePlannerStore(s => s.editGoal)
  const isEdit = !!goal

  const [title, setTitle]         = useState('')
  const [mode, setMode]           = useState<GoalPointsMode>('whole')
  const [wholePts, setWholePts]   = useState('20')
  const [endDate, setEndDate]     = useState('')
  const [note, setNote]           = useState('')
  const [subs, setSubs]           = useState<SubDraft[]>([])
  const [subDraft, setSubDraft]   = useState('')
  const [subPtsDraft, setSubPtsDraft] = useState('5')

  useEffect(() => {
    if (!open) return
    setTitle(goal?.title ?? '')
    setMode(goal?.pointsMode ?? 'whole')
    setWholePts(String(goal?.points ?? 20))
    setEndDate(goal?.endDate ?? '')
    setNote(goal?.note ?? '')
    setSubs((goal?.checklist ?? []).map(i => ({ id: i.id, title: i.title, points: String(i.points ?? 5) })))
    setSubDraft(''); setSubPtsDraft('5')
  }, [open, goal])

  const titleOver = title.length > MAX_GOAL_TITLE
  const canSave = !!title.trim() && !titleOver

  const subDraftOver = subDraft.length > MAX_GOAL_SUBTASK

  function addSub() {
    if (!subDraft.trim() || subDraftOver) return
    setSubs(l => [...l, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: subDraft.trim(), points: subPtsDraft || '0' }])
    setSubDraft(''); setSubPtsDraft('5')
  }

  function handleSave() {
    if (!canSave) return
    const checklist = subs.map(s => ({
      id: s.id, title: s.title, done: (goal?.checklist?.find(c => c.id === s.id)?.done) ?? false,
      ...(mode === 'perSubtask' ? { points: Math.max(0, +s.points || 0) } : {}),
    }))
    const whole = Math.max(0, +wholePts || 0)
    const base = {
      title: title.trim(),
      cadence: goal?.cadence ?? ('weekly' as const),
      targetType: 'checklist' as const,
      target: checklist.length,
      checklist,
      pointsMode: mode,
      points: mode === 'whole' ? whole : undefined,
      delayPoints: mode === 'whole' ? Math.round(whole * 0.5) : undefined,
      endDate: endDate || undefined,
      note: note.trim() || undefined,
    }
    if (isEdit && goal) {
      editGoal(goal.id, base)
      showToast('Goal updated.')
    } else {
      addGoal({ ...base, completedAt: null })
      showToast('Goal added.')
    }
    onClose()
  }

  const minDate = new Date().toISOString().slice(0, 10)

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Goal' : '🎯 Add Goal'}>
      <div className="flex flex-col gap-2.5">
        <div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Goal title..."
            style={{ borderWidth: 1, borderStyle: 'solid', borderColor: titleOver ? '#E24B4A' : 'var(--border2)' }}
            className="w-full text-[13px] px-2.5 py-2 rounded-md bg-[var(--bg2)] text-[var(--text)] outline-none" />
          {titleOver && <div className="text-[11px] text-[var(--red)] mt-0.5">Max length {MAX_GOAL_TITLE}</div>}
        </div>

        {/* Points model */}
        <div className="flex gap-1.5">
          <button onClick={() => setMode('whole')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium border ${mode === 'whole' ? 'bg-[var(--green-bg)] text-[var(--green)] border-[var(--green-mid)]' : 'border-[var(--border2)] bg-[var(--bg2)] text-[var(--text2)]'}`}>
            Points for whole goal
          </button>
          <button onClick={() => setMode('perSubtask')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium border ${mode === 'perSubtask' ? 'bg-[var(--green-bg)] text-[var(--green)] border-[var(--green-mid)]' : 'border-[var(--border2)] bg-[var(--bg2)] text-[var(--text2)]'}`}>
            Points per subtask
          </button>
        </div>

        {mode === 'whole' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text2)]">Goal points:</span>
            <input type="number" min={0} max={500} value={wholePts} onChange={e => setWholePts(e.target.value)}
              className="w-24 text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
            <span className="text-[11px] text-[var(--text3)]">(half if past deadline)</span>
          </div>
        )}

        {/* Subtasks */}
        <div className="border-t border-[var(--border)] pt-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-1.5">Subtasks</div>
          {subs.length > 0 && (
            <div className="flex flex-col gap-1 mb-2">
              {subs.map(s => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)]">
                  <span className="text-[12px] flex-1 break-words [overflow-wrap:anywhere] min-w-0">{s.title}</span>
                  {mode === 'perSubtask' && (
                    <input type="number" min={0} value={s.points} onChange={e => setSubs(l => l.map(x => x.id === s.id ? { ...x, points: e.target.value } : x))}
                      className="w-14 text-[12px] px-1.5 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
                  )}
                  <button onClick={() => setSubs(l => l.filter(x => x.id !== s.id))} className="btn-icon danger">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <input value={subDraft} onChange={e => setSubDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSub()}
                placeholder="Subtask..."
                style={{ borderWidth: 1, borderStyle: 'solid', borderColor: subDraftOver ? '#E24B4A' : 'var(--border2)' }}
                className="w-full text-[13px] px-2.5 py-2 rounded-md bg-[var(--bg2)] text-[var(--text)] outline-none" />
              {subDraftOver && <div className="text-[11px] text-[var(--red)] mt-0.5">Max length {MAX_GOAL_SUBTASK}</div>}
            </div>
            {mode === 'perSubtask' && (
              <input type="number" min={0} value={subPtsDraft} onChange={e => setSubPtsDraft(e.target.value)} title="Points"
                className="w-14 text-[13px] px-1.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
            )}
            <button onClick={addSub} disabled={!subDraft.trim() || subDraftOver} className="px-3 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] disabled:opacity-40">+ Add</button>
          </div>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-[var(--text2)]">Deadline (optional):</span>
          <input type="date" value={endDate} min={minDate} onChange={e => setEndDate(e.target.value)}
            className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none" />
        </div>

        <textarea value={note} onChange={e => setNote(e.target.value.slice(0, MAX_GOAL_NOTE))} placeholder="Note (optional)"
          className="text-[13px] px-2.5 py-2 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)] outline-none min-h-[48px] resize-y" />
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="px-3.5 py-1.5 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-sm">Cancel</button>
        <button onClick={handleSave} disabled={!canSave}
          className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)] disabled:opacity-40">
          {isEdit ? 'Save Changes' : 'Add Goal'}
        </button>
      </div>
    </Modal>
  )
}
