'use client'
import { useEffect, useState } from 'react'
import { Modal }            from './Modal'
import { usePlannerStore }  from '@/store'
import { useDayKey }        from '@/hooks/useDayKey'
import { getManagerMessage } from '@/lib/engine/manager'

let _show: ((msg: string) => void) | null = null

/** Pop a centered manager message modal (task completion, sick-streak concern, etc.) */
export function showManagerMessage(msg: string) {
  _show?.(msg)
}

const BREAK_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes away counts as "a break"

export function ManagerModal() {
  const [msg, setMsg]  = useState<string | null>(null)
  const { today } = useDayKey()
  const cfg   = usePlannerStore(s => s.cfg)
  const mood  = usePlannerStore(s => s.mood[today])
  const allTasks = usePlannerStore(s => s.tasks)

  useEffect(() => {
    _show = (m) => setMsg(m)
    return () => { _show = null }
  }, [])

  // Returning to the dashboard/app after a break re-engages the manager
  useEffect(() => {
    let hiddenAt = 0
    function onVisibility() {
      if (document.hidden) {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt && Date.now() - hiddenAt > BREAK_THRESHOLD_MS) {
        const dayTasks = allTasks.filter(t => t.date === today)
        const done = dayTasks.filter(t => t.done)
        const pct = dayTasks.length ? Math.round(done.length / dayTasks.length * 100) : 0
        setMsg(getManagerMessage(pct, dayTasks.length, cfg.tone, mood))
      }
      hiddenAt = 0
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [today, allTasks, cfg.tone, mood])

  return (
    <Modal open={!!msg} onClose={() => setMsg(null)} title={cfg.managerName}>
      <p className="text-sm text-[var(--text2)] leading-relaxed">{msg}</p>
      <div className="flex justify-end mt-4">
        <button onClick={() => setMsg(null)} className="px-3.5 py-1.5 rounded-md text-sm font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
          Got it
        </button>
      </div>
    </Modal>
  )
}
