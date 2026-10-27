import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { PlusIcon, XIcon } from '../../../../components/ui/icons.tsx'
import { ApiError } from '../../../../lib/api/ApiError.ts'
import { useCollectionSearch } from '../../hooks/useCollectionSearch.ts'
import {
  COLLECTION_LIST_LIMIT,
  collectionKey,
  offerFoundCollections,
} from '../../utils/collectionSuggestions.ts'
import { FIELD_INPUT, TEXT_BUTTON, type SectionProps } from './fields.tsx'

/** Room the dropdown wants below the box before it opens above it instead (px). */
const LIST_ROOM = 340

/**
 * Remove the product from a collection, or put it in one. Adding is by name: type part of a
 * collection's name and the store's collections are searched on the backend
 * (`GET /collections?search=`, for the product's own store); the dropdown stays closed until
 * something is typed, then shows the matches, ten at most. "Add" / Enter takes a name that is
 * exactly one collection's. The product is put in a collection **by its name**
 * (`collections_add: ["Food Packaging"]`); the backend refuses a name that isn't an existing
 * collection (422 "not found"), so a new one can't be made here. Searching is the only
 * `GET /collections` call, and nothing is sent to the product until the section's Save is
 * confirmed.
 *
 * The "add a collection" box and the collections about to be added sit on top of the
 * list. The Collections tab keeps the box hidden until "Add collection" is
 * clicked (`showAdd`, and `focusAdd` to put the cursor in it); by default it is
 * always shown, as in the quick-edit panel in the list.
 */
export function CollectionsSection({
  product,
  draft,
  errors,
  onChange,
  showAdd = true,
  focusAdd = false,
}: SectionProps & {
  /** Whether the "add a collection" box is shown. */
  showAdd?: boolean
  /** Put the cursor in the box whenever it opens. */
  focusAdd?: boolean
}) {
  const addInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (showAdd && focusAdd) addInput.current?.focus()
  }, [showAdd, focusAdd])
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const removed = new Set(draft.removedCollectionIds)

  // The dropdown under the box: the backend's matches for what is typed, ten at most — and
  // nothing at all (no request either) until something is typed.
  const {
    found,
    total: foundTotal,
    loading,
    failed,
    lookup,
  } = useCollectionSearch(input, product.shop?.key)
  const listId = useId()
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const skip = useMemo(
    () =>
      new Set(
        [...product.collections.map((c) => c.title), ...draft.addedCollections].map(
          collectionKey,
        ),
      ),
    [product.collections, draft.addedCollections],
  )
  const { shown, total } = useMemo(
    () => offerFoundCollections(found, foundTotal, skip, COLLECTION_LIST_LIMIT),
    [found, foundTotal, skip],
  )
  const typed = input.trim() !== ''
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

  function toggleRemoved(id: string) {
    onChange({
      removedCollectionIds: removed.has(id)
        ? draft.removedCollectionIds.filter((value) => value !== id)
        : [...draft.removedCollectionIds, id],
    })
  }

  /** Puts the product in a collection chosen from the list (it goes by its name). */
  function pick(collection: { title: string }) {
    onChange({ addedCollections: [...draft.addedCollections, collection.title.trim()] })
    setInput('')
    setInputError(null)
    setActive(-1)
  }

  async function add() {
    const text = input.trim()
    if (!text || checking) return
    if (product.collections.some((c) => collectionKey(c.title) === collectionKey(text))) {
      return setInputError('The product is already in that collection')
    }
    if (
      draft.addedCollections.some((name) => collectionKey(name) === collectionKey(text))
    ) {
      return setInputError('Already added')
    }
    setChecking(true)
    try {
      // The store's collection called exactly that, asked of the backend now so Enter doesn't
      // have to wait for the typing pause. The product update only takes collections that
      // exist (it answers 422 "not found" for any other name), so there is no "new" one.
      const answer = await lookup(text)
      const named = answer.items.find(
        (collection) => collectionKey(collection.title) === collectionKey(text),
      )
      if (named) return pick(named)
      return setInputError(`No collection is called “${text}”. Pick one from the list.`)
    } catch (error) {
      setInputError(
        error instanceof ApiError ? error.message : 'Could not search the collections',
      )
    } finally {
      setChecking(false)
    }
  }

  const nothingListed =
    product.collections.length === 0 && draft.addedCollections.length === 0

  return (
    <div className="flex flex-col gap-4">
      {showAdd && (
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
                  // Only the list closes; the section's own Escape (discard) is for the next press.
                  event.preventDefault()
                  event.stopPropagation()
                  setFocused(false)
                  setActive(-1)
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  if (listOpen && active >= 0) pick(shown[active])
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
            Only collections that already exist can be added. Smart collections
            aren&apos;t listed — their products come from rules.
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
                      onClick={() => pick(collection)}
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
                        : `No collection matches “${input.trim()}”. Only collections that already exist can be added.`}
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
      )}

      {nothingListed ? (
        <p className="text-text-muted text-[0.85rem]">
          This product is not in any collection.
        </p>
      ) : (
        <ul aria-label="Collections" className="flex flex-col gap-2">
          {draft.addedCollections.map((name, index) => (
            <li
              key={name}
              className="border-accent/40 bg-accent-tint/40 flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.88rem] font-semibold">{name}</p>
                {errors[`addedCollections.${index}`] && (
                  <p role="alert" className="text-danger text-[0.78rem]">
                    {errors[`addedCollections.${index}`]}
                  </p>
                )}
              </div>
              <Badge tone="success">New</Badge>
              <button
                type="button"
                aria-label={`Don't add collection ${name}`}
                onClick={() =>
                  onChange({
                    addedCollections: draft.addedCollections.filter(
                      (value) => value !== name,
                    ),
                  })
                }
                className="text-text-muted hover:text-danger cursor-pointer border-none bg-transparent p-1 transition-colors"
              >
                <XIcon width={16} height={16} />
              </button>
            </li>
          ))}
          {product.collections.map((collection) => {
            const isRemoved = removed.has(collection.id)
            return (
              <li
                key={collection.id}
                className="border-border flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
              >
                <div className={`min-w-0 flex-1 ${isRemoved ? 'opacity-50' : ''}`}>
                  <p
                    className={`truncate text-[0.88rem] font-semibold ${isRemoved ? 'line-through' : ''}`}
                  >
                    {collection.title}
                  </p>
                  <p className="text-text-muted truncate font-mono text-[0.74rem]">
                    {collection.handle}
                  </p>
                </div>
                {isRemoved && <Badge tone="danger">Will be removed</Badge>}
                <button
                  type="button"
                  onClick={() => toggleRemoved(collection.id)}
                  aria-label={
                    isRemoved
                      ? `Keep ${collection.title}`
                      : `Remove from ${collection.title}`
                  }
                  className={
                    isRemoved
                      ? TEXT_BUTTON
                      : 'text-text-muted hover:text-danger cursor-pointer border-none bg-transparent p-1 transition-colors'
                  }
                >
                  {isRemoved ? 'Undo' : <XIcon width={16} height={16} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
