import { getPageItems } from '../../lib/pagination.ts'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

const BUTTON =
  'inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const BUTTON_IDLE = 'border-border bg-bg text-text hover:border-accent'
const BUTTON_CURRENT = 'border-text bg-text text-bg'

/** Previous / numbered pages / Next. Generic: knows nothing about what it pages. */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        className={`${BUTTON} ${BUTTON_IDLE}`}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>

      {getPageItems(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden="true" className="text-text-muted px-1">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-label={`Page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={`${BUTTON} ${item === page ? BUTTON_CURRENT : BUTTON_IDLE}`}
            onClick={() => item !== page && onPageChange(item)}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        className={`${BUTTON} ${BUTTON_IDLE}`}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  )
}
