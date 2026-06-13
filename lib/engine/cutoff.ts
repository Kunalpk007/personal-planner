import type { AppConfig } from '@/store/types'

export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/**
 * Returns the logical day key (YYYY-MM-DD) accounting for the cutoff hour.
 * Hours before cutoff belong to the previous calendar day.
 */
export function getDayKey(cfg: Pick<AppConfig, 'cutoffHour'>, d = new Date()): string {
  const cutoff = cfg.cutoffHour ?? 1
  if (d.getHours() < cutoff) {
    const prev = new Date(d)
    prev.setDate(prev.getDate() - 1)
    d = prev
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The calendar day immediately before dateStr (YYYY-MM-DD) */
export function getPrevDayKey(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Monday of the week containing dateStr */
export function getWeekMonday(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`
}

export function isWeekend(dateStr: string): boolean {
  const d = new Date(`${dateStr}T12:00:00`)
  return d.getDay() === 0 || d.getDay() === 6
}

export function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(`${fromStr}T12:00:00`)
  const to   = new Date(`${toStr}T12:00:00`)
  return Math.floor((to.getTime() - from.getTime()) / 86400000)
}
