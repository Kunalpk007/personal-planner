'use client'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface AccordionProps {
  title:      React.ReactNode
  children:   React.ReactNode
  defaultOpen?: boolean
  /** 'vx' opts into the vibrant-redesign glass treatment (Dashboard only so
   *  far). Omit to keep Journal/History/Settings accordions unchanged. */
  variant?: 'default' | 'vx'
}

export function Accordion({ title, children, defaultOpen = false, variant = 'default' }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (variant === 'vx') {
    return (
      <div className="vx-accordion">
        <button onClick={() => setOpen(o => !o)} className="vx-accordion-head">
          <span className="text-sm text-left flex-1">{title}</span>
          <motion.span
            className="text-xs text-[var(--text3)]"
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            ▶
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-4 pb-4 pt-1 border-t border-[var(--vx-border)]">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

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
