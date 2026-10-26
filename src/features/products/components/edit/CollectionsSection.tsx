import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { PlusIcon, XIcon } from '../../../../components/ui/icons.tsx'
import { useKnownCollections } from '../../hooks/useKnownCollections.ts'
import {
  COLLECTION_LIST_LIMIT,
  matchCollections,
} from '../../utils/collectionSuggestions.ts'
import { FIELD_INPUT, TEXT_BUTTON, type SectionProps } from './fields.tsx'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Room the dropdown wants below the box before it opens above it instead (px). */
const LIST_ROOM = 340

/**
 * Remove the product from a collection, or put it in one. Adding is from a dropdown of the
 * collections the app already knows (those of the products it has loaded — the backend has
 * no "list collections" endpoint yet): it stays closed until something is typed, then shows
 * the related ones, ten at most; a collection that isn't listed can still be added by
 * pasting its CRM ID (a UUID).
 *
 * The "add by ID" box and the collections about to be added sit on top of the
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
  /** Whether the "add by ID" box is shown. */
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
  const removed = new Set(draft.removedCollectionIds)

  // The dropdown under the box: the known collections related to what is typed, ten at most —
  // and nothing at all until something is typed. Opening the box already reads the details of
  // the products on the list (to learn their collections), so they are ready when typing starts.
  const { collections: known, loading } = useKnownCollections(showAdd)
  const listId = useId()
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const skip = useMemo(
    () => new Set([...product.collections.map((c) => c.id), ...draft.addedCollectionIds]),
    [product.collections, draft.addedCollectionIds],
  )
  const { shown, total } = useMemo(
    () => matchCollections(known, input, skip, COLLECTION_LIST_LIMIT),
    [known, input, skip],
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
  const titleOf = (id: string) => known.find((collection) => collection.id === id)?.title

  function toggleRemoved(id: string) {
    onChange({
      removedCollectionIds: removed.has(id)
        ? draft.removedCollectionIds.filter((value) => value !== id)
        : [...draft.removedCollectionIds, id],
    })
  }

  /** Puts the product in a collection chosen from the list. */
  function pick(id: string) {
    onChange({ addedCollectionIds: [...draft.addedCollectionIds, id] })
    setInput('')
    setInputError(null)
    setActive(-1)
  }

  function add() {
    const id = input.trim().toLowerCase()
    if (!id) return
    if (!UUID.test(id)) return setInputError('That is not a valid collection ID')
    if (product.collections.some((collection) => collection.id === id)) {
      return setInputError('The product is already in that collection')
    }
    if (draft.addedCollectionIds.includes(id)) return setInputError('Already added')
    onChange({ addedCollectionIds: [...draft.addedCollectionIds, id] })
    setInput('')
    setInputError(null)
  }

  const nothingListed =
    product.collections.length === 0 && draft.addedCollectionIds.length === 0

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
              placeholder="Search collections, or paste an ID"
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
                  if (listOpen && active >= 0) pick(shown[active].id)
                  else add()
                }
              }}
              className={`${FIELD_INPUT} font-mono text-[0.8rem]`}
            />
            <button
              type="button"
              onClick={add}
              disabled={!input.trim()}
              className="border-border bg-bg text-text hover:border-accent inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              <PlusIcon width={14} height={14} />
              Add
            </button>
          </div>
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
                      onClick={() => pick(collection.id)}
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
                      ? 'Loading collections…'
                      : `No collection matches “${input.trim()}”. Paste its ID and press Add.`}
                  </p>
                )}
                {shown.length > 0 && (total > COLLECTION_LIST_LIMIT || loading) && (
                  <p className="border-border text-text-muted border-t px-3.5 py-2 text-[0.76rem]">
                    {total > COLLECTION_LIST_LIMIT
                      ? `Showing ${COLLECTION_LIST_LIMIT} of ${total}`
                      : `${total} ${total === 1 ? 'collection' : 'collections'}`}
                    {loading
                      ? ' so far — more are loading…'
                      : ' — keep typing to narrow the list.'}
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
          {draft.addedCollectionIds.map((id, index) => (
            <li
              key={id}
              className="border-accent/40 bg-accent-tint/40 flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[0.88rem] font-semibold">
                  {titleOf(id) ?? 'Collection to add'}
                </p>
                <p className="text-text-muted truncate font-mono text-[0.74rem]">{id}</p>
                {errors[`addedCollections.${index}`] && (
                  <p role="alert" className="text-danger text-[0.78rem]">
                    {errors[`addedCollections.${index}`]}
                  </p>
                )}
              </div>
              <Badge tone="success">New</Badge>
              <button
                type="button"
                aria-label={`Don't add collection ${id}`}
                onClick={() =>
                  onChange({
                    addedCollectionIds: draft.addedCollectionIds.filter(
                      (value) => value !== id,
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
