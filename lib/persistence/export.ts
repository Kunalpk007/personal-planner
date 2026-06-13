import type { AppState } from '@/store/types'

export function exportJSON(state: AppState): void {
  const data  = JSON.stringify(state, null, 2)
  const blob  = new Blob([data], { type: 'application/json' })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  const now   = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
  a.href     = url
  a.download = `kunals_planner_backup_${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function importJSON(file: File): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as AppState
        if (!data.tasks || !data.cfg) throw new Error('Invalid backup file')
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
