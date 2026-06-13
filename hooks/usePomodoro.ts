'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePlannerStore } from '@/store'
import { POMO_BONUS }      from '@/constants/points'

type Phase = 'focus' | 'break'

interface PomodoroState {
  running:   boolean
  phase:     Phase
  cycle:     number
  endTime:   number
  remaining: number  // seconds
  taskId:    string | null
}

export function usePomodoro() {
  const cfg          = usePlannerStore(s => s.cfg)
  const toggleTask   = usePlannerStore(s => s.toggleTask)
  const intervalRef  = useRef<NodeJS.Timeout | null>(null)

  const duration = cfg.pomoDuration ?? 25

  const [state, setState] = useState<PomodoroState>({
    running:   false,
    phase:     'focus',
    cycle:     1,
    endTime:   0,
    remaining: duration * 60,
    taskId:    null,
  })

  // Tick using timestamps — background safe
  useEffect(() => {
    if (!state.running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      const rem = Math.ceil((state.endTime - Date.now()) / 1000)
      if (rem <= 0) {
        clearInterval(intervalRef.current!)
        setState(prev => {
          if (prev.phase === 'focus') {
            return { ...prev, running: false, phase: 'break', endTime: 0, remaining: 5 * 60 }
          } else {
            return {
              ...prev,
              running: false,
              phase:   'focus',
              cycle:   Math.min(prev.cycle + 1, 4),
              endTime: 0,
              remaining: duration * 60,
            }
          }
        })
        return
      }
      setState(prev => ({ ...prev, remaining: rem }))
    }, 500)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state.running, state.endTime, state.phase, duration])

  const start = useCallback((taskId: string) => {
    const totalSec = state.phase === 'focus' ? duration * 60 : 5 * 60
    const endTime  = state.endTime > Date.now() ? state.endTime : Date.now() + totalSec * 1000
    setState(prev => ({ ...prev, running: true, endTime, taskId: taskId || prev.taskId }))
  }, [state.phase, state.endTime, duration])

  const pause = useCallback(() => {
    setState(prev => ({ ...prev, running: false }))
  }, [])

  const reset = useCallback(() => {
    setState({ running: false, phase: 'focus', cycle: 1, endTime: 0, remaining: duration * 60, taskId: null })
  }, [duration])

  // While idle in the focus phase, reflect the latest configured duration even if it
  // changed since this state was last set (e.g. via Settings).
  const displayState = (!state.running && state.phase === 'focus')
    ? { ...state, remaining: duration * 60 }
    : state

  return { state: displayState, start, pause, reset }
}
