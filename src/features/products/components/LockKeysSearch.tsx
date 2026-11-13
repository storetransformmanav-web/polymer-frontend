import { useEffect, useRef, useState } from 'react'
import {
  CheckIcon,
  SearchIcon,
  SpinnerIcon,
  TagIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { findOwnTag, withoutOwnTag } from '../../../lib/lockOwnTag.ts'
import { usePickStoreTags } from '../hooks/useProductLockAccess.ts'

const BUTTON =
  'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

const lower = (value: string) => value.trim().toLowerCase()

/** At most this many keys on one lock (the API's own limit). */
const MAX_KEYS = 20

/**
 * The product's tags (the lock's keys), changed from one search bar at the top of the Lock Access
 * tab: clicking it opens every tag of the store (`GET /access/tags`, narrowed by typing) with a
 * tick box — the product's tags start ticked. Tick to add, untick to take off (a typed tag the
 * store lacks can be ticked as a new one), then **Save tags** hands over what changed (the page
 * asks first). The lock's own `lock-…` tag is never listed.
 */
export function LockKeysSearch({
  lock,
  shop,
  busy,
  onSave,
}: {
  lock: AccessLock
  shop: string
  busy: boolean
  onSave: (change: { add: string[]; remove: string[] }) => void
}) {
  const ownTag = findOwnTag(lock.tags, lock.handle)
  const current = withoutOwnTag(lock.tags, ownTag)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(current)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [text, setText] = useDebouncedField(query, (value) => {
    setQuery(value)
    setPage(1)
  })
  // Asked for only once the bar has been clicked.
  const store = usePickStoreTags(shop, query, page, open)
  const root = useRef<HTMLDivElement>(null)

  const currentSet = new Set(current.map(lower))
  const draftSet = new Set(draft.map(lower))
  const add = draft.filter((tag) => !currentSet.has(lower(tag)))
  const remove = current.filter((tag) => !draftSet.has(lower(tag)))
  const changed = add.length + remove.length > 0
  const rows = store.items.filter((item) => !ownTag || lower(item.tag) !== lower(ownTag))
  const typed = text.trim()
  const typedIsNew =
    typed !== '' &&
    !rows.some((item) => lower(item.tag) === lower(typed)) &&
    !draftSet.has(lower(typed)) &&
    (!ownTag || lower(typed) !== lower(ownTag))

  // A click outside closes the list (what was ticked stays until Save or Cancel).
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function toggle(tag: string) {
    setDraft((list) =>
      list.some((item) => lower(item) === lower(tag))
        ? list.filter((item) => lower(item) !== lower(tag))
        : [...list, tag].slice(0, MAX_KEYS),
    )
  }

  function reset() {
    setDraft(current)
    setText('')
    setOpen(false)
  }

  return (
    <div
      ref={root}
      className="border-border bg-bg relative rounded-xl border p-3 sm:px-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <TagIcon width={16} height={16} className="text-accent shrink-0" />
        <span className="text-[0.85rem] font-bold">Product tags</span>
        <span className="text-text-muted text-[0.75rem]">
          Customers with one of these tags can open the product.
        </span>
      </div>

      <label className="border-border bg-surface focus-within:border-accent mt-2 flex h-10 items-center gap-2 rounded-lg border px-3">
        <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
        <span className="sr-only">Search tags</span>
        <input
          type="search"
          value={text}
          maxLength={255}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
          }}
          placeholder="Click to see every tag, or type to search…"
          className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {open && store.isFetching && (
          <SpinnerIcon width={14} height={14} className="text-text-muted animate-spin" />
        )}
      </label>

      {/* The tags as they will be after Save: ticked ones as chips (✕ unticks). */}
      {draft.length > 0 && (
        <ul
          className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0"
          aria-label="Ticked tags"
        >
          {draft.map((tag) => (
            <li
              key={tag}
              className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-[0.75rem] font-semibold ${
                currentSet.has(lower(tag))
                  ? 'bg-accent-tint text-accent'
                  : 'bg-warning-bg text-warning'
              }`}
              title={
                currentSet.has(lower(tag))
                  ? 'A tag of this product'
                  : 'Added when you save'
              }
            >
              {tag}
              <button
                type="button"
                aria-label={`Untick ${tag}`}
                onClick={() => toggle(tag)}
                className="hover:bg-accent hover:text-accent-contrast flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current"
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Unsaved ticks stay after the list closes: save or drop them here too. */}
      {changed && !open && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <span className="text-text-muted mr-auto text-[0.75rem]">
            Not saved: {add.length} to add · {remove.length} to take off
          </span>
          <button
            type="button"
            onClick={reset}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave({ add, remove })}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
          >
            <CheckIcon width={14} height={14} />
            Save tags
          </button>
        </div>
      )}

      {open && (
        <div className="border-border bg-bg absolute inset-x-3 top-full z-30 -mt-1 flex flex-col rounded-xl border shadow-lg sm:inset-x-4">
          <div className="max-h-64 overflow-y-auto">
            {store.error ? (
              <div className="text-danger flex items-center justify-center gap-2 px-3 py-4 text-[0.82rem]">
                {store.error}
                <button
                  type="button"
                  onClick={store.retry}
                  className={`${BUTTON} border-border bg-bg text-text h-7 px-2.5`}
                >
                  Try again
                </button>
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {typedIsNew && (
                  <li className="border-border border-b">
                    <label className="hover:bg-accent-tint/40 flex cursor-pointer items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggle(typed)}
                        className="accent-accent h-4 w-4"
                      />
                      <span className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold">
                        {typed}
                      </span>
                      <span className="bg-warning-bg text-warning rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
                        New tag
                      </span>
                    </label>
                  </li>
                )}
                {store.isPending ? (
                  <li className="text-text-muted flex items-center justify-center gap-2 px-3 py-4 text-[0.82rem]">
                    <SpinnerIcon width={14} height={14} className="animate-spin" />
                    Loading tags…
                  </li>
                ) : rows.length === 0 && !typedIsNew ? (
                  <li className="text-text-muted px-3 py-4 text-center text-[0.82rem]">
                    {typed ? 'No tag matches.' : 'This store has no tags yet.'}
                  </li>
                ) : (
                  rows.map((item) => {
                    const on = draftSet.has(lower(item.tag))
                    return (
                      <li
                        key={item.tag}
                        className="border-border border-b last:border-b-0"
                      >
                        <label className="hover:bg-accent-tint/40 flex cursor-pointer items-center gap-3 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(item.tag)}
                            className="accent-accent h-4 w-4"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.85rem] font-semibold">
                              {item.label || item.tag}
                            </span>
                            <span className="text-text-muted block truncate text-[0.72rem]">
                              {item.label && item.label !== item.tag
                                ? `${item.tag} · `
                                : ''}
                              {item.products.toLocaleString('en-GB')} products ·{' '}
                              {item.customers.toLocaleString('en-GB')} customers
                            </span>
                          </span>
                          {currentSet.has(lower(item.tag)) && (
                            <span className="bg-accent-tint text-accent rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
                              On this product
                            </span>
                          )}
                        </label>
                      </li>
                    )
                  })
                )}
              </ul>
            )}
          </div>
          {store.totalPages > 1 && (
            <div className="border-border flex items-center justify-between border-t px-3 py-2 text-[0.75rem]">
              <span className="text-text-muted">
                {store.total.toLocaleString('en-GB')} tags
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className={`${BUTTON} border-border bg-bg text-text h-7 px-2`}
                >
                  Previous
                </button>
                <span>
                  {page} / {store.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= store.totalPages}
                  onClick={() => setPage(page + 1)}
                  className={`${BUTTON} border-border bg-bg text-text h-7 px-2`}
                >
                  Next
                </button>
              </span>
            </div>
          )}
          <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t p-2">
            <span className="text-text-muted mr-auto text-[0.75rem]">
              {changed
                ? `${add.length} to add · ${remove.length} to take off`
                : 'Tick to add a tag, untick to take it off.'}
            </span>
            <button
              type="button"
              onClick={reset}
              className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !changed}
              onClick={() => {
                setOpen(false)
                onSave({ add, remove })
              }}
              className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
            >
              <CheckIcon width={14} height={14} />
              Save tags
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
