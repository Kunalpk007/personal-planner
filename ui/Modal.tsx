'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

interface ModalProps {
  open:     boolean
  onClose:  () => void
  title?:   string
  children: React.ReactNode
  maxWidth?: string
  /** 'vx' opts into the vibrant-redesign glass/spring treatment — used only by
   *  the redesigned Dashboard components so far (see project.md's "UI Redesign
   *  Initiative"). Omit (or 'default') to keep every other page's modals
   *  pixel-identical to before. */
  variant?: 'default' | 'vx'
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md', variant = 'default' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Portalled to <body> rather than rendered in place: every page's content
  // lives inside app/(tabs)/layout.tsx's `page-container` motion.div, which
  // animates `filter` (blur in/out on route change). A non-`none` `filter`
  // on an ancestor establishes a new containing block for `position: fixed`
  // descendants (same rule as `transform`/`will-change`/`backdrop-filter`) —
  // so a non-portalled modal's "fixed, centered" backdrop was being sized
  // and centered against the full scrollable page-container box instead of
  // the actual viewport, which is what put it "below the mobile screen" on
  // any page taller than one screen. Portalling to `document.body` escapes
  // that ancestor entirely, matching the fix already used by NotificationBell.
  if (!mounted) return null

  if (variant === 'vx') {
    return createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            className="vx-modal-backdrop"
            // Explicit dvh height (in addition to the CSS `inset: 0`) so this
            // backdrop sizes to the actual *visible* viewport on mobile
            // browsers with a collapsing address bar, instead of the taller
            // layout viewport `inset: 0` alone can resolve to — the latter is
            // what put the sheet's bottom half below the visible fold on
            // some phones. Browsers without `dvh` support ignore this and
            // fall back to the previous (still correct on desktop) behavior.
            style={{ height: '100dvh' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              ref={dialogRef}
              className={`vx-modal-sheet ${maxWidth} w-full`}
              style={{ maxHeight: '82dvh' }}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            >
              {title && (
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-semibold">{title}</h3>
                  <button onClick={onClose} className="vx-modal-close">×</button>
                </div>
              )}
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-5"
      // See the vx-variant branch above for why: dvh keeps this pinned to
      // the actually-visible viewport on mobile browsers instead of the
      // layout viewport, which is what let the sheet spill below the fold.
      style={{ height: '100dvh' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        className={`bg-[var(--bg)] rounded-xl border border-[var(--border2)] p-5 ${maxWidth} w-full max-h-[88vh] overflow-y-auto`}
        style={{ maxHeight: '88dvh', WebkitOverflowScrolling: 'touch' }}
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
    </div>,
    document.body
  )
}
