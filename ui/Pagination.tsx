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
    <div className="flex items-center justify-center gap-3 mt-2 mb-3 text-[12px] text-[var(--text2)]">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className="px-4 py-2 rounded-[10px] text-xs font-semibold border-[1.5px] transition-all disabled:opacity-40"
        style={{
          background:  hasPrev ? 'var(--green-bg)' : 'var(--bg3)',
          color:       hasPrev ? 'var(--green)'    : 'var(--text3)',
          borderColor: hasPrev ? 'var(--green-mid)': 'var(--border2)',
          cursor:      hasPrev ? 'pointer' : 'not-allowed',
        }}
      >
        ‹ Prev
      </button>
      <span>Page {page} of {totalPages}</span>
      <button
        onClick={onNext}
        disabled={!hasNext}
        className="px-4 py-2 rounded-[10px] text-xs font-semibold border-[1.5px] transition-all disabled:opacity-40"
        style={{
          background:  hasNext ? 'var(--green-bg)' : 'var(--bg3)',
          color:       hasNext ? 'var(--green)'    : 'var(--text3)',
          borderColor: hasNext ? 'var(--green-mid)': 'var(--border2)',
          cursor:      hasNext ? 'pointer' : 'not-allowed',
        }}
      >
        Next ›
      </button>
    </div>
  )
}
