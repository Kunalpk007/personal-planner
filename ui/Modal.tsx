'use client'
import { useEffect, useRef } from 'react'

interface ModalProps {
  open:     boolean
  onClose:  () => void
  title?:   string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        className={`bg-[var(--bg)] rounded-xl border border-[var(--border2)] p-5 ${maxWidth} w-full max-h-[88vh] overflow-y-auto`}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold">{title}</h3>
            <button onClick={onClose} className="btn-icon text-lg w-7 h-7">×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
