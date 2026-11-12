import { useEffect, useRef, useState } from 'react'
import { SearchIcon, TagIcon, XIcon } from '../../../components/ui/icons.tsx'
import { Pagination } from '../../../components/ui/Pagination.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import { useAccessTags } from '../hooks/usePickers.ts'
import { parseTags } from '../utils/lockDraft.ts'

interface TagPickerProps {
  shop: string
  /** The tags chosen so far, shown as chips with a ✕. */
  selected: readonly string[]
  /** Called with the tags to add: a suggestion picked, or what was typed (split on commas). */
  onAdd: (tags: string[]) => void
  onRemove: (tag: string) => void
  /** Greys the controls while a request about them is running. */
  disabled?: boolean
}

const CHECKBOX = 'accent-accent h-4 w-4 shrink-0 cursor-pointer'
const count = (value: number) => value.toLocaleString('en-GB')

/**
 * Choosing the tags (the "keys"): everything the store already has is listed from the API —
 * lock tags first, each with how many products and customers carry it — narrowed as you
 * type; click a row to add or take away that tag. A tag that does not exist yet is made by
 * typing it and pressing Enter (or the "Add" row); commas separate several.
 */
export function TagPicker({
  shop,
  selected,
  onAdd,
  onRemove,
  disabled = false,
}: TagPickerProps) {
  const [query, setQuery] = useState('')
  const [text, setText] = useDebouncedField(query, setQuery)
  const tags = useAccessTags(shop, query)
  // A new page starts at the top of the list.
  const listRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [tags.page])

  const chosen = new Set(selected.map((tag) => tag.toLowerCase()))
  const typed = parseTags(text)
  const known = new Set(tags.items.map((item) => item.tag.toLowerCase()))
  const fresh = typed.filter((tag) => !chosen.has(tag.toLowerCase()))
  // A typed tag the store has no row for (yet) can be made on the spot.
  const addable = fresh.filter((tag) => !known.has(tag.toLowerCase()))

  function addTyped() {
    if (fresh.length === 0) return
    onAdd(fresh)
    setText('')
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 && (
        <ul aria-label="Chosen tags" className="flex flex-wrap gap-2">
          {selected.map((tag) => (
            <li
              key={tag}
              className="bg-accent-tint text-accent inline-flex items-center gap-1 rounded-full py-1 pr-1.5 pl-3 text-[0.8rem] font-semibold"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                disabled={disabled}
                onClick={() => onRemove(tag)}
                className="hover:bg-accent/15 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current disabled:pointer-events-none disabled:opacity-50"
              >
                <XIcon width={12} height={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-10 items-center gap-2.5 rounded-lg border px-3 transition-colors focus-within:outline-2">
        <SearchIcon className="text-text-muted shrink-0" />
        <input
          type="text"
          aria-label="Search or add a tag"
          placeholder="Search the store’s tags, or type a new one and press Enter"
          maxLength={255}
          disabled={disabled}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addTyped()
            }
          }}
          className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.88rem] outline-none"
        />
        {text && (
          <button
            type="button"
            aria-label="Clear tag search"
            onClick={() => setText('')}
            className="text-text-muted hover:text-text cursor-pointer border-none bg-none p-0.5"
          >
            <XIcon width={16} height={16} />
          </button>
        )}
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <ul
          ref={listRef}
          aria-label="Tags in the store"
          className="max-h-64 overflow-auto"
        >
          {addable.map((tag) => (
            <li key={`new-${tag}`} className="border-border border-b">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onAdd([tag])
                  setText('')
                }}
                className="hover:bg-accent-tint/60 text-accent flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3.5 py-2 text-left text-[0.85rem] font-semibold transition-colors"
              >
                <TagIcon width={15} height={15} />
                Add new tag “{tag}”
              </button>
            </li>
          ))}

          {tags.error ? (
            <li className="text-danger flex flex-col items-center gap-2 px-4 py-6 text-center text-[0.85rem]">
              {tags.error}
              <button
                type="button"
                onClick={tags.retry}
                className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-3 py-1.5 text-[0.8rem] font-semibold"
              >
                Try again
              </button>
            </li>
          ) : tags.isPending ? (
            <li
              role="status"
              className="text-text-muted px-4 py-6 text-center text-[0.85rem]"
            >
              Loading tags…
            </li>
          ) : tags.items.length === 0 ? (
            addable.length === 0 && (
              <li className="text-text-muted px-4 py-6 text-center text-[0.85rem]">
                {query.trim()
                  ? `No tag matches “${query.trim()}”.`
                  : 'The store has no tags yet.'}
              </li>
            )
          ) : (
            tags.items.map((item) => {
              const on = chosen.has(item.tag.toLowerCase())
              return (
                <li
                  key={item.tag}
                  className="border-border hover:bg-accent-tint/60 border-b transition-colors last:border-b-0"
                >
                  <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2">
                    <input
                      type="checkbox"
                      className={CHECKBOX}
                      checked={on}
                      disabled={disabled}
                      aria-label={item.tag}
                      onChange={() => (on ? onRemove(item.tag) : onAdd([item.tag]))}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[0.85rem] font-semibold">
                        {item.label || item.tag}
                      </span>
                      {item.label && item.label !== item.tag && (
                        <span className="text-text-muted truncate text-[0.75rem]">
                          {item.tag}
                        </span>
                      )}
                    </span>
                    {item.is_lock_tag && (
                      <span className="bg-accent-tint text-accent shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold">
                        Key
                      </span>
                    )}
                    <span className="text-text-muted hidden shrink-0 text-[0.72rem] sm:block">
                      {count(item.products)} products · {count(item.customers)} customers
                    </span>
                  </label>
                </li>
              )
            })
          )}
        </ul>

        {tags.totalPages > 1 && !tags.error && (
          <div className="border-border-strong bg-accent-tint/40 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t px-3.5 py-2">
            <span className="text-text-muted text-[0.75rem]" aria-live="polite">
              Showing {count((tags.page - 1) * tags.pageSize + 1)}–
              {count(Math.min(tags.page * tags.pageSize, tags.total))} of{' '}
              {count(tags.total)} tags
            </span>
            <Pagination
              compact
              page={tags.page}
              totalPages={tags.totalPages}
              onPageChange={tags.setPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
