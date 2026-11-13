import { useEffect, useRef, useState } from 'react'
import {
  CheckIcon,
  PlusIcon,
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
const CHIP =
  'inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-[0.75rem] font-semibold'
const CHIP_X =
  'hover:bg-accent hover:text-accent-contrast flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current disabled:pointer-events-none disabled:opacity-50'

const lower = (value: string) => value.trim().toLowerCase()

/** At most this many keys on one lock (the API's own limit). */
const MAX_KEYS = 20

/**
 * The product's tags (the lock's keys), kept simple: one search bar and an **Add tag** button.
 * Clicking the bar (or typing in it) drops down every tag of the store (`GET /access/tags`,
 * narrowed by what is typed); click a tag to pick it — it appears as a chip below — and press
 * **Add tag** to add the picked ones (the page asks first). A typed tag the store lacks can be
 * picked as a new one. The product's own tags are the solid chips under the bar; their ✕ takes one
 * off (also asked first). The lock's own `lock-…` tag is never listed.
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
  const [picked, setPicked] = useState<string[]>([])
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
  const pickedSet = new Set(picked.map(lower))
  const rows = store.items.filter((item) => !ownTag || lower(item.tag) !== lower(ownTag))
  const typed = text.trim()
  const typedIsNew =
    typed !== '' &&
    !rows.some((item) => lower(item.tag) === lower(typed)) &&
    !currentSet.has(lower(typed)) &&
    !pickedSet.has(lower(typed)) &&
    (!ownTag || lower(typed) !== lower(ownTag))
  const room = Math.max(0, MAX_KEYS - current.length)

  // A click outside closes the list (what was picked stays until Add tag).
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function pick(tag: string) {
    const key = lower(tag)
    if (currentSet.has(key) || pickedSet.has(key)) return
    setPicked((list) => [...list, tag].slice(0, room))
    setText('')
  }

  function unpick(tag: string) {
    setPicked((list) => list.filter((item) => lower(item) !== lower(tag)))
  }

  return (
    <div
      ref={root}
      className="border-border bg-bg rounded-xl border p-3 sm:px-4"
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

      <div className="relative mt-2 flex gap-2">
        <label className="border-border bg-surface focus-within:border-accent flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3">
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
            onKeyDown={(event) => {
              // Enter picks a typed tag the store does not have yet.
              if (event.key === 'Enter') {
                event.preventDefault()
                if (typedIsNew) pick(typed)
              }
            }}
            placeholder="Search tags, or type a new one…"
            className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {open && store.isFetching && (
            <SpinnerIcon
              width={14}
              height={14}
              className="text-text-muted animate-spin"
            />
          )}
        </label>
        <button
          type="button"
          disabled={busy || picked.length === 0}
          onClick={() => {
            setOpen(false)
            onSave({ add: picked, remove: [] })
          }}
          className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
        >
          <PlusIcon width={14} height={14} />
          {picked.length > 1 ? `Add ${picked.length} tags` : 'Add tag'}
        </button>

        {open && (
          <div className="border-border bg-bg absolute top-full right-0 left-0 z-30 mt-1 flex flex-col overflow-hidden rounded-xl border shadow-lg">
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
                <ul aria-label="Tags in the store" className="m-0 list-none p-0">
                  {typedIsNew && (
                    <li className="border-border border-b">
                      <button
                        type="button"
                        onClick={() => pick(typed)}
                        className="hover:bg-accent-tint/50 flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-3 py-2 text-left"
                      >
                        <span className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold">
                          {typed}
                        </span>
                        <span className="bg-warning-bg text-warning rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
                          New tag
                        </span>
                      </button>
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
                      const onProduct = currentSet.has(lower(item.tag))
                      const isPicked = pickedSet.has(lower(item.tag))
                      return (
                        <li
                          key={item.tag}
                          className="border-border border-b last:border-b-0"
                        >
                          <button
                            type="button"
                            disabled={onProduct || (!isPicked && picked.length >= room)}
                            onClick={() => (isPicked ? unpick(item.tag) : pick(item.tag))}
                            className="hover:bg-accent-tint/50 flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-3 py-2 text-left disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                          >
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
                            {onProduct ? (
                              <span className="bg-accent-tint text-accent rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
                                On this product
                              </span>
                            ) : isPicked ? (
                              <span className="text-accent inline-flex items-center gap-1 text-[0.72rem] font-semibold">
                                <CheckIcon width={14} height={14} />
                                Picked
                              </span>
                            ) : null}
                          </button>
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
          </div>
        )}
      </div>

      {/* Picked to add (dashed), then the product's own tags (✕ takes one off, asked first). */}
      {(picked.length > 0 || current.length > 0) && (
        <ul
          className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0"
          aria-label="Tags of this product"
        >
          {picked.map((tag) => (
            <li
              key={`picked-${tag}`}
              className={`${CHIP} bg-accent-tint text-accent border-accent/40 border border-dashed`}
              title="Added when you press Add tag"
            >
              {tag}
              <button
                type="button"
                aria-label={`Don’t add ${tag}`}
                onClick={() => unpick(tag)}
                className={CHIP_X}
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
          {current.map((tag) => (
            <li
              key={tag}
              className={`${CHIP} bg-accent-tint text-accent`}
              title="A tag of this product"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove the tag ${tag}`}
                title="Remove this tag"
                disabled={busy}
                onClick={() => onSave({ add: [], remove: [tag] })}
                className={CHIP_X}
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
