'use client'
import { useState } from 'react'

interface AccordionProps {
  title:      React.ReactNode
  children:   React.ReactNode
  defaultOpen?: boolean
}

export function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] mb-2 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-3.5 py-3 cursor-pointer hover:bg-[var(--bg2)] select-none"
      >
        <span className="text-sm text-left">{title}</span>
        <span className={`text-xs text-[var(--text3)] transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>
      {open && (
        <div className="px-3.5 pb-3 border-t border-[var(--border)]">
          {children}
        </div>
      )}
    </div>
  )
}
