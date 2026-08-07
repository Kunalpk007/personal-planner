'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface TaskActionFabProps {
  onAddTask: () => void
  onAddGoal?: () => void
  onChallengeFriend?: () => void
}

/** Floating "+" action button (bottom-right, green, fixed — doesn't move on
 *  scroll) that expands into the Add Task / Add Goal / Challenge Friend
 *  options with a staggered transition, replacing the old always-visible
 *  three-button row. Portalled to <body> for the same containing-block
 *  reason as SubmitArea's pinned bar (see that file) — this button sits
 *  fixed above it, so it needs the same escape from the page-container's
 *  animated `filter`. */
export function TaskActionFab({ onAddTask, onAddGoal, onChallengeFriend }: TaskActionFabProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const options: Array<{ key: string; label: string; onClick: () => void }> = [
    { key: 'task', label: '+ Add Task', onClick: onAddTask },
    ...(onAddGoal ? [{ key: 'goal', label: '🎯 Add Goal', onClick: onAddGoal }] : []),
    ...(onChallengeFriend ? [{ key: 'challenge', label: '⚔️ Challenge Friend', onClick: onChallengeFriend }] : []),
  ]

  function choose(fn: () => void) {
    setOpen(false)
    fn()
  }

  return createPortal(
    <div className="vx-task-fab-wrap">
      <AnimatePresence>
        {open && (
          <motion.div className="vx-task-fab-options">
            {options.map((o, i) => (
              <motion.button
                key={o.key}
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.9 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                onClick={() => choose(o.onClick)}
                className="vx-task-fab-option"
              >
                {o.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(o => !o)}
        className="vx-task-fab"
        aria-label={open ? 'Close menu' : 'Add task, goal, or challenge'}
        aria-expanded={open}
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'inline-block' }}>
          +
        </motion.span>
      </button>
    </div>,
    document.body
  )
}
