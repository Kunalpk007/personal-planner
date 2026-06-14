'use client'
import { useEffect, useState } from 'react'
import { Modal }            from './Modal'
import { usePlannerStore }  from '@/store'

let _show: ((msg: string) => void) | null = null

/** Pop a centered manager message modal (task completion, sick-streak concern, etc.) */
export function showManagerMessage(msg: string) {
  _show?.(msg)
}

export function ManagerModal() {
  const [msg, setMsg]  = useState<string | null>(null)
  const cfg   = usePlannerStore(s => s.cfg)

  useEffect(() => {
    _show = (m) => setMsg(m)
    return () => { _show = null }
  }, [])

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
