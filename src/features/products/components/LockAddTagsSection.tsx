import { useState } from 'react'
import {
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TagIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type { AccessLock, LockCustomer } from '../../../lib/api/endpoints.ts'
import { findOwnTag, withoutOwnTag } from '../../../lib/lockOwnTag.ts'
import { usePickStoreTags } from '../hooks/useProductLockAccess.ts'

const BUTTON =
  'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const CHIP =
  'bg-accent-tint text-accent inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-[0.75rem] font-semibold'

/** At most this many tags at once (the API's own limit). */
const MAX_TAGS = 20

const lower = (value: string) => value.trim().toLowerCase()

/**
 * **Add tags**, opened under a customer's row by its Add tag button: a search over the store's tags
 * (`GET /access/tags`: every tag on products and customers, lock tags first — all of them with
 * nothing typed, narrowed by typing), each with a tick box, so several can be chosen; a typed tag
 * the store doesn't have yet can be ticked too ("New tag"). Tags the customer already holds are
 * shown as such; the lock's own `lock-…` tag is never listed. **Add** hands the ticked tags over
 * (the page asks before anything is sent).
 */
export function LockAddTagsSection({
  lock,
  shop,
  customers,
  busy,
  onCancel,
  onAdd,
}: {
  lock: AccessLock
  shop: string
  /** The customers ticked in the table: the tags go to all of them. */
  customers: LockCustomer[]
  busy: boolean
  onCancel: () => void
  onAdd: (tags: string[]) => void
}) {
  const ownTag = findOwnTag(lock.tags, lock.handle)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [text, setText] = useDebouncedField(query, (value) => {
    setQuery(value)
    setPage(1)
  })
  const store = usePickStoreTags(shop, query, page)
  const [chosen, setChosen] = useState<string[]>([])
  // A tag every ticked customer already has needs no adding.
  const held = new Set(
    customers.length === 0
      ? []
      : customers[0].tags
          .map(lower)
          .filter((tag) =>
            customers.every((one) => one.tags.some((t) => lower(t) === tag)),
          ),
  )
  const chosenSet = new Set(chosen.map(lower))
  const rows = store.items.filter((item) => !ownTag || lower(item.tag) !== lower(ownTag))
  const typed = text.trim()
  const typedIsNew =
    typed !== '' &&
    !rows.some((item) => lower(item.tag) === lower(typed)) &&
    !held.has(lower(typed)) &&
    (!ownTag || lower(typed) !== lower(ownTag))
  const who =
    customers.length === 0
      ? null
      : customers.length === 1
        ? (customers[0].name ?? customers[0].email ?? '1 customer')
        : `${customers.length} customers`
  const shownHeld = withoutOwnTag([...held], ownTag)

  function toggle(tag: string) {
    setChosen((current) =>
      current.some((item) => lower(item) === lower(tag))
        ? current.filter((item) => lower(item) !== lower(tag))
        : [...current, tag].slice(0, MAX_TAGS),
    )
  }

  return (
    <div className="border-accent/40 bg-accent-tint/20 flex flex-col gap-3 border-l-4 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <TagIcon width={16} height={16} className="text-accent shrink-0" />
        <h3 className="m-0 text-[0.88rem] font-bold">
          {who ? `Add tags to ${who}` : 'Add tags'}
        </h3>
        {shownHeld.length > 0 && (
          <span className="text-text-muted truncate text-[0.75rem]">
            · holds {shownHeld.join(', ')}
          </span>
        )}
      </div>

      {!who && (
        <p className="text-text-muted m-0 text-[0.7rem]">
          {/* Tick customers in the table below, then choose the tags to give them. */}
        </p>
      )}
      <label className="border-border bg-bg focus-within:border-accent flex h-10 items-center gap-2 rounded-lg border px-3">
        <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
        <span className="sr-only">Search the store’s tags</span>
        <input
          type="search"
          value={text}
          maxLength={255}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search tags, or type a new one…"
          className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {store.isFetching && (
          <SpinnerIcon width={14} height={14} className="text-text-muted animate-spin" />
        )}
        {text && (
          <button
            type="button"
            aria-label="Clear tag search"
            onClick={() => setText('')}
            className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0.5"
          >
            <XIcon width={14} height={14} />
          </button>
        )}
      </label>

      <div className="border-border bg-bg max-h-56 overflow-y-auto rounded-lg border">
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
                    checked={chosenSet.has(lower(typed))}
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
                const has = held.has(lower(item.tag))
                return (
                  <li key={item.tag} className="border-border border-b last:border-b-0">
                    <label
                      className={`flex items-center gap-3 px-3 py-2 ${
                        has ? 'opacity-60' : 'hover:bg-accent-tint/40 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={has || chosenSet.has(lower(item.tag))}
                        disabled={has}
                        onChange={() => toggle(item.tag)}
                        className="accent-accent h-4 w-4"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.85rem] font-semibold">
                          {item.label || item.tag}
                        </span>
                        <span className="text-text-muted block truncate text-[0.72rem]">
                          {item.label && item.label !== item.tag ? `${item.tag} · ` : ''}
                          {item.products.toLocaleString('en-GB')} products ·{' '}
                          {item.customers.toLocaleString('en-GB')} customers
                        </span>
                      </span>
                      {has ? (
                        <span className="bg-surface text-text-muted rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
                          Has it
                        </span>
                      ) : item.is_lock_tag ? (
                        <span className="bg-accent-tint text-accent rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
                          Lock tag
                        </span>
                      ) : null}
                    </label>
                  </li>
                )
              })
            )}
          </ul>
        )}
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

      {chosen.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Tags to add">
          {chosen.map((tag) => (
            <li key={tag} className={CHIP}>
              {tag}
              <button
                type="button"
                aria-label={`Do not add ${tag}`}
                onClick={() => toggle(tag)}
                className="hover:bg-accent hover:text-accent-contrast flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current"
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || chosen.length === 0 || customers.length === 0}
          onClick={() => onAdd(chosen)}
          className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
        >
          <PlusIcon width={14} height={14} />
          {chosen.length > 0
            ? `Add ${chosen.length} ${chosen.length === 1 ? 'tag' : 'tags'}`
            : 'Add'}
        </button>
      </div>
    </div>
  )
}
