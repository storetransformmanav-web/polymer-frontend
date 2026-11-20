import { useState } from 'react'

/**
 * The paging of a table whose rows are all already loaded (10 / 25 / 50 / 100 a page), for the shared
 * `PaginationFooter`. `resetKey` is anything that changes the rows (a search): when it changes the table
 * goes back to page 1.
 */
export function usePaging(total: number, resetKey = '') {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  // React's "adjust state while rendering" pattern.
  const [lastKey, setLastKey] = useState(resetKey)
  if (resetKey !== lastKey) {
    setLastKey(resetKey)
    setPage(1)
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages)
  return {
    page: current,
    pageSize,
    totalPages,
    /** The slice of the rows to show: `rows.slice(from, to)`. */
    from: (current - 1) * pageSize,
    to: current * pageSize,
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }
}
