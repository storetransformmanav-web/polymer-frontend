import { useState } from 'react'
import {
  LockIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TagIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { Pagination } from '../../../components/ui/Pagination.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { usePickStoreTags } from '../hooks/useProductLockAccess.ts'
import {
  CARD,
  CHECKBOX,
  CHIP,
  CHIP_X,
  COUNT_BADGE,
  DROPDOWN,
  lowerSet,
  MAX_KEYS,
  OUTLINE,
  PRIMARY,
  SEARCH_BOX,
  SEARCH_INPUT,
  TILE,
} from './lockAccessStyles.ts'

/**
 * The product's keys (tags), kept small: the keys as chips, one search box and — in a dropdown that
 * opens when the box is focused — every tag of the store (`GET /access/tags`, lock tags first),
 * narrowed as you type. Tick the tags to add (or type a new one and press Enter) and press **Add
 * keys**: one question, one request.
 */
export function LockKeysCard({
  lock,
  shop,
  busy,
  onAdd,
  onRemove,
}: {
  lock: AccessLock
  shop: string
  busy: boolean
  onAdd: (tags: string[]) => void
  /** Asks to take one key off the product (the person is asked before anything is sent). */
  onRemove: (tag: string) => void
}) {
  const [query, setQuery] = useState('')
  const [text, setText] = useDebouncedField(query, setQuery)
  const [paging, setPaging] = useState({ query: '', page: 1 })
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const page = paging.query === query ? paging.page : 1
  const tags = usePickStoreTags(shop, query, page, open)

  const keys = lowerSet(lock.tags)
  const room = Math.max(0, MAX_KEYS - lock.tags.length)
  const full = room === 0
  // A tag that became a key (after "Add keys") leaves the picked ones by itself.
  const pending = picked.filter((tag) => !keys.has(tag.toLowerCase()))
  const pendingSet = lowerSet(pending)
  const typed = [
    ...new Map(
      text
        .split(',')
        .map((tag) => tag.trim())
        .filter(
          (tag) =>
            tag && !keys.has(tag.toLowerCase()) && !pendingSet.has(tag.toLowerCase()),
        )
        .map((tag) => [tag.toLowerCase(), tag] as const),
    ).values(),
  ]
  const known = lowerSet(tags.items.map((item) => item.tag))
  // A typed tag the store has no row for (yet) can be made on the spot.
  const addable = typed.filter((tag) => !known.has(tag.toLowerCase()))

  function pick(...next: string[]) {
    const seen = lowerSet(pending)
    setPicked(
      [...pending, ...next.filter((tag) => !seen.has(tag.toLowerCase()))].slice(0, room),
    )
  }

  function drop(tag: string) {
    setPicked(pending.filter((item) => item.toLowerCase() !== tag.toLowerCase()))
  }

  function addTyped() {
    if (typed.length === 0) return
    pick(...typed)
    setText('')
  }

  return (
    <section className={`${CARD} flex flex-col gap-3 p-3 sm:p-4`} aria-label="Keys">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={TILE}>
          <TagIcon width={18} height={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[0.92rem] font-bold">Keys (tags)</h2>
          <p className="text-text-muted m-0 truncate text-[0.76rem]">
            A customer with any of these tags can open the product.
          </p>
        </div>
        <span className={COUNT_BADGE} title={`At most ${MAX_KEYS} keys`}>
          {lock.tags.length} / {MAX_KEYS}
        </span>
      </div>

      <div
        className="relative flex gap-2"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            setOpen(false)
          }
        }}
      >
        <label className={SEARCH_BOX}>
          <SearchIcon width={15} height={15} className="text-text-muted shrink-0" />
          <span className="sr-only">Add keys from the store’s tags</span>
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="lock-keys-list"
            aria-autocomplete="list"
            value={text}
            maxLength={255}
            disabled={busy || full}
            placeholder={
              full
                ? `At most ${MAX_KEYS} keys`
                : 'Search the store’s tags, or type a new one'
            }
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setText(event.target.value)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addTyped()
              }
            }}
            className={SEARCH_INPUT}
          />
          {tags.isFetching && open && (
            <SpinnerIcon
              width={13}
              height={13}
              className="text-text-muted animate-spin"
            />
          )}
          {text && (
            <button
              type="button"
              aria-label="Clear tag search"
              onClick={() => setText('')}
              className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0.5"
            >
              <XIcon width={13} height={13} />
            </button>
          )}
        </label>
        <button
          type="button"
          disabled={busy || pending.length === 0}
          onClick={() => onAdd(pending)}
          className={PRIMARY}
        >
          <PlusIcon width={14} height={14} />
          {pending.length > 1 ? `Add ${pending.length} keys` : 'Add key'}
        </button>

        {open && !full && (
          <div id="lock-keys-list" tabIndex={-1} className={DROPDOWN}>
            <ul
              aria-label="Tags in the store"
              className="m-0 max-h-56 list-none overflow-auto p-0"
            >
              {addable.map((tag) => (
                <li key={`new-${tag}`} className="border-border border-b">
                  <button
                    type="button"
                    onClick={() => {
                      pick(tag)
                      setText('')
                    }}
                    className="hover:bg-accent-tint/60 text-accent flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-[0.8rem] font-semibold transition-colors"
                  >
                    <PlusIcon width={13} height={13} />
                    Add new tag “{tag}”
                  </button>
                </li>
              ))}

              {tags.error ? (
                <li className="text-danger flex flex-col items-center gap-2 px-4 py-5 text-center text-[0.8rem]">
                  {tags.error}
                  <button
                    type="button"
                    onClick={tags.retry}
                    className={`${OUTLINE} h-7 px-3 text-[0.78rem]`}
                  >
                    Try again
                  </button>
                </li>
              ) : tags.isPending ? (
                <li
                  role="status"
                  className="text-text-muted flex items-center justify-center gap-2 px-4 py-5 text-[0.8rem]"
                >
                  <SpinnerIcon width={13} height={13} className="animate-spin" />
                  Loading tags…
                </li>
              ) : tags.items.length === 0 ? (
                addable.length === 0 && (
                  <li className="text-text-muted px-4 py-5 text-center text-[0.8rem]">
                    {query.trim()
                      ? `No tag matches “${query.trim()}”.`
                      : 'The store has no tags yet.'}
                  </li>
                )
              ) : (
                tags.items.map((item) => {
                  const isKey = keys.has(item.tag.toLowerCase())
                  const on = isKey || pendingSet.has(item.tag.toLowerCase())
                  return (
                    <li key={item.tag} className="border-border border-b last:border-b-0">
                      <label
                        className={`flex items-center gap-2.5 px-3 py-1.5 transition-colors ${
                          isKey ? 'opacity-70' : 'hover:bg-accent-tint/50 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          aria-label={item.tag}
                          checked={on}
                          disabled={isKey || (!on && pending.length >= room)}
                          onChange={() => (on ? drop(item.tag) : pick(item.tag))}
                          className={CHECKBOX}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.82rem] font-semibold">
                            {item.label || item.tag}
                          </span>
                          <span className="text-text-muted block truncate text-[0.7rem]">
                            {item.label && item.label !== item.tag
                              ? `${item.tag} · `
                              : ''}
                            {item.products.toLocaleString('en-GB')} products ·{' '}
                            {item.customers.toLocaleString('en-GB')} customers
                          </span>
                        </span>
                        {isKey ? (
                          <span className="bg-accent text-accent-contrast shrink-0 rounded-full px-2 py-0.5 text-[0.66rem] font-bold">
                            Key of this product
                          </span>
                        ) : (
                          item.is_lock_tag && (
                            <span className="bg-accent-tint text-accent shrink-0 rounded-full px-2 py-0.5 text-[0.66rem] font-bold">
                              Lock tag
                            </span>
                          )
                        )}
                      </label>
                    </li>
                  )
                })
              )}
            </ul>

            {tags.totalPages > 1 && !tags.error && (
              <div className="border-border-strong bg-accent-tint/40 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t px-3 py-1.5">
                <span className="text-text-muted text-[0.72rem]" aria-live="polite">
                  {tags.total.toLocaleString('en-GB')} tags
                </span>
                <Pagination
                  compact
                  page={page}
                  totalPages={tags.totalPages}
                  onPageChange={(next) => setPaging({ query, page: next })}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <ul aria-label="Keys to add" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {pending.map((tag) => (
            <li key={tag} className={`${CHIP} border-accent/40 border border-dashed`}>
              {tag}
              <button
                type="button"
                aria-label={`Don’t add ${tag}`}
                onClick={() => drop(tag)}
                className={CHIP_X}
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {lock.tags.length === 0 ? (
        <p className="text-text-muted m-0 text-[0.82rem]">
          No keys: any customer who is signed in can open it.
        </p>
      ) : (
        <ul
          aria-label="Keys of this product"
          className="m-0 flex list-none flex-wrap gap-1.5 p-0"
        >
          {lock.tags.map((tag) => (
            <li key={tag} className={`${CHIP} py-1 text-[0.78rem]`}>
              <LockIcon width={11} height={11} />
              {tag}
              <button
                type="button"
                aria-label={`Remove the key ${tag}`}
                title="Remove this key"
                disabled={busy}
                onClick={() => onRemove(tag)}
                className={`${CHIP_X} disabled:pointer-events-none disabled:opacity-50`}
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
