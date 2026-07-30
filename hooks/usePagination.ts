'use client'
import { useMemo, useState } from 'react'

/** Shared client-side pagination for a list already sorted by the caller.
 *  Page resets to 1 whenever the item count shrinks below the current page. */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const page_ = Math.min(page, totalPages)

  const pageItems = useMemo(
    () => items.slice((page_ - 1) * pageSize, page_ * pageSize),
    [items, page_, pageSize]
  )

  return {
    page: page_,
    totalPages,
    pageItems,
    hasPrev: page_ > 1,
    hasNext: page_ < totalPages,
    prevPage: () => setPage(p => Math.max(1, p - 1)),
    nextPage: () => setPage(p => Math.min(totalPages, p + 1)),
    setPage,
  }
}
