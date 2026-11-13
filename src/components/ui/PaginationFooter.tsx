import { Pagination } from './Pagination.tsx'
import { SelectField } from './SelectField.tsx'

const PAGE_SIZES = [10, 25, 50, 100].map((size) => ({
  value: String(size),
  label: String(size),
}))

interface PaginationFooterProps {
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  /** A slimmer footer (smaller buttons and padding), for a table inside a card. */
  compact?: boolean
}

/** "Showing 1 to 25 of 6971 entries", page-size picker and page buttons. */
export function PaginationFooter({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  compact = false,
}: PaginationFooterProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const format = (n: number) => n.toLocaleString('en-GB')

  return (
    <footer
      className={`border-border-strong bg-table-head text-text flex flex-col border-t text-[0.82rem] lg:flex-row lg:items-center lg:justify-between ${
        compact ? 'gap-2 px-3 py-1.5 text-[0.78rem]' : 'gap-3 px-4 py-3'
      }`}
    >
      <p aria-live="polite">
        Showing <strong>{format(from)}</strong> to <strong>{format(to)}</strong> of{' '}
        <strong>{format(total)}</strong> entries
      </p>

      <div className="flex items-center gap-2">
        <span>Show</span>
        <div className="w-20">
          <SelectField
            id="page-size"
            label="Entries per page"
            value={String(pageSize)}
            options={PAGE_SIZES}
            onChange={(value) => onPageSizeChange(Number(value))}
            hideLabel
            compact={compact}
          />
        </div>
        <span>entries per page</span>
      </div>

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          compact={compact}
        />
      )}
    </footer>
  )
}
