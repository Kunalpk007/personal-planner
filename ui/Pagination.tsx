'use client'

export function Pagination({
  page, totalPages, hasPrev, hasNext, onPrev, onNext,
}: {
  page: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 mt-2 mb-3 text-[12px]" style={{ color: 'var(--vx-fg-3)' }}>
      <button onClick={onPrev} disabled={!hasPrev} className="vx-btn vx-btn-ghost text-xs">‹ Prev</button>
      <span>Page {page} of {totalPages}</span>
      <button onClick={onNext} disabled={!hasNext} className="vx-btn vx-btn-ghost text-xs">Next ›</button>
    </div>
  )
}
