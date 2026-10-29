import { useId } from 'react'
import { SearchIcon, SpinnerIcon, XIcon } from '../../../components/ui/icons.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import { LockImage } from './LockCard.tsx'

export interface PickRow {
  id: string
  label: string
  /** A second line: a handle, an email. */
  sub?: string | null
  /** A picture; only rows that have the field (products) draw a tile. */
  image?: string | null
  withImage?: boolean
  /** Small chips on the right (a customer's tags, a product's status). */
  chips?: string[]
}

interface PickListProps {
  /** The list's accessible name, e.g. "Products to lock". */
  label: string
  /** What one row is, for the texts ("product" → "No products found"). */
  noun: string
  rows: PickRow[]
  selectedIds: ReadonlySet<string>
  onToggle: (row: PickRow) => void
  /** The header box: select (or unselect) every row shown. */
  onTogglePage: (rows: PickRow[], select: boolean) => void
  /** The search text sent to the API. */
  search: string
  onSearch: (search: string) => void
  searchPlaceholder: string
  /** How many match in all, not just the rows loaded. */
  total: number
  isPending: boolean
  isFetching: boolean
  isLoadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  error: string | null
  onRetry: () => void
}

const CHECKBOX = 'accent-accent h-4 w-4 shrink-0 cursor-pointer'

/**
 * A searchable list of everything the API has, one checkbox per row — for choosing many at
 * once. The header checkbox ticks every row shown, "Load more" brings the next page, and a
 * choice stays ticked through searches and pages (the parent keeps the picked items).
 */
export function PickList({
  label,
  noun,
  rows,
  selectedIds,
  onToggle,
  onTogglePage,
  search,
  onSearch,
  searchPlaceholder,
  total,
  isPending,
  isFetching,
  isLoadingMore,
  hasMore,
  onLoadMore,
  error,
  onRetry,
}: PickListProps) {
  const [text, setText] = useDebouncedField(search, onSearch)
  const headingId = useId()

  const ticked = rows.filter((row) => selectedIds.has(row.id)).length
  const allTicked = rows.length > 0 && ticked === rows.length

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-10 items-center gap-2.5 rounded-lg border px-3 transition-colors focus-within:outline-2">
        <SearchIcon className="text-text-muted shrink-0" />
        <input
          type="search"
          aria-label={`Search ${noun}s`}
          placeholder={searchPlaceholder}
          maxLength={200}
          value={text}
          onChange={(event) => setText(event.target.value)}
          // Inside a form: Enter must not submit it.
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
          className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.88rem] outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setText('')}
            className="text-text-muted hover:text-text cursor-pointer border-none bg-none p-0.5"
          >
            <XIcon width={16} height={16} />
          </button>
        )}
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <div className="bg-table-head border-border-strong flex items-center gap-3 border-b px-3.5 py-2">
          <input
            type="checkbox"
            id={headingId}
            className={CHECKBOX}
            checked={allTicked}
            disabled={rows.length === 0}
            onChange={() => onTogglePage(rows, !allTicked)}
          />
          <label
            htmlFor={headingId}
            className="text-text cursor-pointer text-[0.7rem] font-bold tracking-wide uppercase"
          >
            Select all shown ({rows.length})
          </label>
          <span className="text-text-muted ml-auto text-[0.75rem]" aria-live="polite">
            {isPending ? 'Loading…' : `${total.toLocaleString('en-GB')} found`}
            {isFetching && !isPending && !isLoadingMore ? ' · updating…' : ''}
          </span>
        </div>

        <ul aria-label={label} className="max-h-80 overflow-auto">
          {error ? (
            <li className="text-danger flex flex-col items-center gap-2 px-4 py-8 text-center text-[0.85rem]">
              {error}
              <button
                type="button"
                onClick={onRetry}
                className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-3 py-1.5 text-[0.8rem] font-semibold"
              >
                Try again
              </button>
            </li>
          ) : isPending ? (
            Array.from({ length: 5 }, (_, index) => (
              <li
                key={index}
                aria-hidden="true"
                className="border-border border-b px-3.5 py-2.5"
              >
                <div className="bg-border/70 h-8 w-2/3 animate-pulse rounded" />
              </li>
            ))
          ) : rows.length === 0 ? (
            <li className="text-text-muted px-4 py-8 text-center text-[0.85rem]">
              {search.trim()
                ? `No ${noun}s match “${search.trim()}”.`
                : `No ${noun}s found.`}
            </li>
          ) : (
            rows.map((row) => (
              <li
                key={row.id}
                className="border-border hover:bg-accent-tint/60 border-b transition-colors last:border-b-0"
              >
                <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2">
                  <input
                    type="checkbox"
                    className={CHECKBOX}
                    checked={selectedIds.has(row.id)}
                    onChange={() => onToggle(row)}
                    aria-label={row.label}
                  />
                  {row.withImage && <LockImage src={row.image} />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className="truncate text-[0.85rem] font-semibold"
                      title={row.label}
                    >
                      {row.label}
                    </span>
                    {row.sub && (
                      <span
                        className="text-text-muted truncate text-[0.75rem]"
                        title={row.sub}
                      >
                        {row.sub}
                      </span>
                    )}
                  </span>
                  {row.chips && row.chips.length > 0 && (
                    <span className="hidden shrink-0 items-center gap-1 sm:flex">
                      {row.chips.slice(0, 3).map((chip) => (
                        <span
                          key={chip}
                          className="bg-surface border-border max-w-28 truncate rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold"
                        >
                          {chip}
                        </span>
                      ))}
                      {row.chips.length > 3 && (
                        <span className="text-text-muted text-[0.68rem]">
                          +{row.chips.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </label>
              </li>
            ))
          )}
        </ul>

        {hasMore && !error && (
          <div className="border-border-strong bg-accent-tint/40 flex items-center justify-between gap-3 border-t px-3.5 py-2">
            <span className="text-text-muted text-[0.75rem]">
              Showing {rows.length.toLocaleString('en-GB')} of{' '}
              {total.toLocaleString('en-GB')}
            </span>
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={onLoadMore}
              className="border-border bg-bg text-text hover:border-accent inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[0.8rem] font-semibold transition-colors disabled:opacity-60"
            >
              {isLoadingMore && (
                <SpinnerIcon width={14} height={14} className="animate-spin" />
              )}
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
