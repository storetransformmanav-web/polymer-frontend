import { Pagination } from '../../../components/ui/Pagination.tsx'
import { SelectField } from '../../../components/ui/SelectField.tsx'

const PAGE_SIZES = [10, 25, 50, 100].map((size) => ({
  value: String(size),
  label: String(size),
}))

interface ProductsFooterProps {
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

/** "Showing 1 to 25 of 6971 entries", page-size picker and page buttons. */
export function ProductsFooter({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: ProductsFooterProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const format = (n: number) => n.toLocaleString('en-GB')

  return (
    <footer className="border-border bg-accent-tint/40 flex flex-col gap-3 border-t px-4 py-3 text-[0.82rem] lg:flex-row lg:items-center lg:justify-between">
      <p className="text-text-muted" aria-live="polite">
        Showing <strong className="text-text">{format(from)}</strong> to{' '}
        <strong className="text-text">{format(to)}</strong> of{' '}
        <strong className="text-text">{format(total)}</strong> entries
      </p>

      <div className="flex items-center gap-2">
        <span className="text-text-muted">Show</span>
        <div className="w-20">
          <SelectField
            id="page-size"
            label="Entries per page"
            value={String(pageSize)}
            options={PAGE_SIZES}
            onChange={(value) => onPageSizeChange(Number(value))}
            hideLabel
          />
        </div>
        <span className="text-text-muted">entries per page</span>
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      )}
    </footer>
  )
}
