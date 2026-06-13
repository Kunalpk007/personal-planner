'use client'
import { useMemo } from 'react'
import { usePlannerStore } from '@/store'
import { getDayKey, getWeekMonday, isWeekend } from '@/lib/engine/cutoff'

export function useDayKey() {
  const cfg = usePlannerStore(s => s.cfg)
  const today = useMemo(() => getDayKey(cfg), [cfg])
  const weekMonday = useMemo(() => getWeekMonday(today), [today])
  const isWknd = useMemo(() => isWeekend(today), [today])
  return { today, weekMonday, isWknd }
}
