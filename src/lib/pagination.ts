export type PageItem = number | 'gap'

/**
 * Page numbers to show: first, last, and a window around the current page,
 * with "…" for skipped runs (a single skipped page is shown, not elided).
 * e.g. page 1 of 279 → 1 2 3 4 5 … 279.
 */
export function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const wanted = new Set([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) for (const n of [2, 3, 4, 5]) wanted.add(n)
  if (page >= totalPages - 2) {
    for (const n of [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1]) {
      wanted.add(n)
    }
  }

  const pages = [...wanted].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
  const items: PageItem[] = []
  pages.forEach((n, index) => {
    const previous = pages[index - 1]
    if (previous !== undefined) {
      if (n - previous === 2) items.push(previous + 1)
      else if (n - previous > 2) items.push('gap')
    }
    items.push(n)
  })
  return items
}
