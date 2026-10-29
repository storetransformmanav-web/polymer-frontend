import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { PlusIcon } from '../../../components/ui/icons.tsx'
import type { ProductDetail } from '../../../lib/api/endpoints.ts'
import { useCollectionSearch } from '../hooks/useCollectionSearch.ts'
import {
  COLLECTION_LIST_LIMIT,
  collectionKey,
  offerFoundCollections,
} from '../utils/collectionSuggestions.ts'
import { FIELD_INPUT } from './edit/fields.tsx'

/** Room the dropdown wants below the box before it opens above it instead (px). */
const LIST_ROOM = 340

/**
 * The "Add to a collection" box of the Collections tab. Type part of a collection's name and
 * the store's collections are searched on the backend (`GET /collections?search=`, for the
 * product's own store); the dropdown stays closed — and asks for nothing — until something is
 * typed, then shows the matches, ten at most — a suggestion list. Choosing one (click, or
 * ↑/↓ + Enter) fills the box with its name. **Add** (or Enter) takes the name in the box and
 * hands it to `onChoose` with `isNew`: false for a collection the store has (chosen, listed,
 * or found by an exact-name look-up — it is then added with `PUT /products/{id}`), true for a
 * name it doesn't have (a new collection is made with `POST /collections`, this product in
 * it). If the look-up itself fails nothing is known, so the name goes the safe way (the
 * `PUT`, which the backend refuses for an unknown name) rather than risk making a second
 * collection. Nothing here sends anything: the caller asks first.
 */
export function CollectionAdder({
  product,
  onChoose,
  autoFocus = true,
}: {
  product: ProductDetail
  /** A name was added: ask, then add the product to it (or make it, when `isNew`). */
  onChoose: (collectionName: string, isNew: boolean) => void
  /** Put the cursor in the box when it appears (off where it sits among other fields). */
  autoFocus?: boolean
}) {
  const addInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) addInput.current?.focus()
  }, [autoFocus])
  const [input, setInput] = useState('')
  /** The name chosen from the dropdown (so Add needs no second search for it). */
  const [checking, setChecking] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)
  const chosen = selected !== null && input === selected

  // The dropdown under the box: the backend's matches for what is typed, ten at most — and
  // nothing at all (no request either) until something is typed, or once a choice is made.
  const {
    found,
    total: foundTotal,
    loading,
    failed,
    lookup,
  } = useCollectionSearch(chosen ? '' : input, product.shop?.key)
  const listId = useId()
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const skip = useMemo(
    () => new Set(product.collections.map((c) => collectionKey(c.title))),
    [product.collections],
  )
  const { shown, total } = useMemo(
    () => offerFoundCollections(found, foundTotal, skip, COLLECTION_LIST_LIMIT),
    [found, foundTotal, skip],
  )
  const typed = input.trim() !== '' && !chosen
  const panelOpen = focused && typed
  const listOpen = panelOpen && shown.length > 0

  // The dropdown is drawn on top of the page (a portal), so no ancestor can clip it, and it
  // follows its box as the page scrolls or the window is resized.
  const row = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    visible: boolean
  } | null>(null)
  useEffect(() => {
    if (!panelOpen) return undefined
    function measure() {
      const rect = row.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom
      const upward = below < LIST_ROOM && rect.top > below
      setPlace({
        left: rect.left,
        width: rect.width,
        visible:
          (rect.width === 0 && rect.height === 0) ||
          (rect.bottom > 0 && rect.top < window.innerHeight),
        ...(upward
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }
    function onScroll(event: Event) {
      if (event.target instanceof Node && list.current?.contains(event.target)) return
      measure()
    }
    measure()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', measure)
    }
  }, [panelOpen, input, shown.length])

  /** A collection chosen from the list: its name goes into the box, ready for Add. */
  function select(collection: { title: string }) {
    const name = collection.title.trim()
    setInput(name)
    setSelected(name)
    setInputError(null)
    setActive(-1)
    addInput.current?.focus()
  }

  /**
   * Hands the name in the box to the confirmation. A name the store has (any case) is sent
   * with its own spelling; one it doesn't have is a new collection to make.
   */
  async function add() {
    const text = input.trim()
    if (!text || checking) return
    if (product.collections.some((c) => collectionKey(c.title) === collectionKey(text))) {
      return setInputError('The product is already in that collection')
    }
    // Chosen from the list: the store has it, with this spelling.
    if (selected !== null && collectionKey(selected) === collectionKey(text)) {
      return onChoose(selected, false)
    }
    setChecking(true)
    try {
      // Asked now (cached, so no wait for the typing pause) whether the store has it.
      const answer = await lookup(text)
      const named = answer.items.find(
        (collection) => collectionKey(collection.title) === collectionKey(text),
      )
      if (named) onChoose(named.title.trim(), false)
      // Not in a page that was cut short: it may be further on, so don't make a second one.
      else if (answer.total > answer.items.length) onChoose(text, false)
      else onChoose(text, true)
    } catch {
      // Can't tell whether it exists: the update (not a create) is the safe thing to try.
      onChoose(text, false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="edit-collection-id"
        className="text-text text-[0.82rem] font-semibold"
      >
        Add to a collection
      </label>
      <div ref={row} className="flex gap-2">
        <input
          id="edit-collection-id"
          ref={addInput}
          autoComplete="off"
          spellCheck={false}
          value={input}
          placeholder="Type a collection name"
          role="combobox"
          aria-expanded={panelOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            listOpen && active >= 0 ? `${listId}-${active}` : undefined
          }
          aria-invalid={inputError ? true : undefined}
          onFocus={() => setFocused(true)}
          // Clicking the box again (or ↓) brings the list back after Escape.
          onClick={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            setInput(event.target.value)
            setInputError(null)
            setActive(-1)
          }}
          onKeyDown={(event) => {
            if (!listOpen && event.key === 'ArrowDown') {
              event.preventDefault()
              setFocused(true)
            } else if (listOpen && event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((index) => (index + 1) % shown.length)
            } else if (listOpen && event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((index) => (index <= 0 ? shown.length - 1 : index - 1))
            } else if (listOpen && event.key === 'Escape') {
              // Only the list closes.
              event.preventDefault()
              event.stopPropagation()
              setFocused(false)
              setActive(-1)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              if (listOpen && active >= 0) select(shown[active])
              else void add()
            }
          }}
          className={FIELD_INPUT}
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={!input.trim() || checking}
          className="border-border bg-bg text-text hover:border-accent inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          <PlusIcon width={14} height={14} />
          Add
        </button>
      </div>
      <p className="text-text-muted text-[0.76rem]">
        Pick a collection from the list, or type a new name and press Add to create it.
        Smart collections aren&apos;t listed — their products come from rules.
      </p>
      {inputError && (
        <p role="alert" className="text-danger text-[0.78rem]">
          {inputError}
        </p>
      )}

      {panelOpen &&
        place?.visible &&
        createPortal(
          <div
            ref={list}
            style={{
              left: place.left,
              top: place.top,
              bottom: place.bottom,
              width: place.width,
            }}
            className="border-border bg-bg fixed z-50 overflow-hidden rounded-xl border shadow-lg"
          >
            <ul id={listId} role="listbox" aria-label="Collections to add">
              {shown.map((collection, index) => (
                <li
                  key={collection.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // Keep the focus in the box: leaving it would close the list before the click.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => select(collection)}
                  className={`flex cursor-pointer items-center gap-3 px-3.5 py-2 ${
                    index === active ? 'bg-accent-tint/60' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.88rem] font-semibold">
                      {collection.title}
                    </p>
                    <p className="text-text-muted truncate font-mono text-[0.74rem]">
                      {collection.handle}
                    </p>
                  </div>
                  {collection.collection_type && (
                    <Badge
                      tone={
                        collection.collection_type.toLowerCase() === 'smart'
                          ? 'default'
                          : 'neutral'
                      }
                    >
                      {collection.collection_type.toLowerCase() === 'custom'
                        ? 'Manual'
                        : collection.collection_type.charAt(0).toUpperCase() +
                          collection.collection_type.slice(1).toLowerCase()}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            {shown.length === 0 && (
              <p className="text-text-muted px-3.5 py-3 text-[0.82rem]">
                {loading
                  ? 'Searching collections…'
                  : failed
                    ? 'Could not search the collections. Try again in a moment.'
                    : `No collection matches “${input.trim()}”. Press Add to create it as a new collection.`}
              </p>
            )}
            {shown.length > 0 && (total > COLLECTION_LIST_LIMIT || loading) && (
              <p className="border-border text-text-muted border-t px-3.5 py-2 text-[0.76rem]">
                {loading
                  ? 'Searching…'
                  : `Showing ${COLLECTION_LIST_LIMIT} of ${total} — keep typing to narrow the list.`}
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
