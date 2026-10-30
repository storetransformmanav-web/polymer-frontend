import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { XIcon } from '../../../components/ui/icons.tsx'
import type { ProductDetail } from '../../../lib/api/endpoints.ts'
import { useCollectionSearch } from '../hooks/useCollectionSearch.ts'
import {
  COLLECTION_LIST_LIMIT,
  collectionKey,
  offerFoundCollections,
} from '../utils/collectionSuggestions.ts'
import { statusLabel } from '../utils/format.ts'
import { TAG_CHIP } from './edit/TagsSection.tsx'

/** Room the dropdown wants below the box before it opens above it instead (px). */
const LIST_ROOM = 340

function collectionTypeLabel(type: string): string {
  return type.toLowerCase() === 'custom' ? 'Manual' : statusLabel(type)
}

/**
 * The unified collections editor, matching the tags input design: existing collections appear
 * as removable chips inside the card, followed by an inline search input. Typing searches
 * existing manual collections on the backend (`GET /collections?search=`); picking a match
 * asks confirmation and adds the product to it. New collections cannot be created here.
 */
export function CollectionAdder({
  product,
  onChoose,
  onRemove,
  autoFocus = false,
}: {
  product: ProductDetail
  /** A collection was chosen from search: ask confirmation then add. */
  onChoose: (collectionName: string, isNew: boolean) => void
  /** The ✕ on an existing collection chip was clicked: ask confirmation then remove. */
  onRemove: (collection: ProductDetail['collections'][number]) => void
  autoFocus?: boolean
}) {
  const addInput = useRef<HTMLInputElement>(null)
  const card = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (autoFocus) addInput.current?.focus()
  }, [autoFocus])

  const [input, setInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)

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
    () => new Set(product.collections.map((c) => collectionKey(c.title))),
    [product.collections],
  )
  const { shown, total } = useMemo(
    () => offerFoundCollections(found, foundTotal, skip, COLLECTION_LIST_LIMIT),
    [found, foundTotal, skip],
  )
  const typed = input.trim() !== ''
  const panelOpen = focused && typed
  const listOpen = panelOpen && shown.length > 0

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
      const rect = card.current?.getBoundingClientRect()
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

  function select(collection: { title: string }) {
    const name = collection.title.trim()
    setInput('')
    setInputError(null)
    setActive(-1)
    setFocused(false)
    onChoose(name, false)
  }

  async function add() {
    const text = input.trim()
    if (!text || checking) return
    if (product.collections.some((c) => collectionKey(c.title) === collectionKey(text))) {
      return setInputError('The product is already in that collection')
    }
    setChecking(true)
    try {
      const answer = await lookup(text)
      const named = answer.items.find(
        (collection) => collectionKey(collection.title) === collectionKey(text),
      )
      if (named) {
        select(named)
      } else {
        setInputError(`No collection matches “${text}”.`)
      }
    } catch {
      setInputError('Could not search the collections. Try again in a moment.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={card}
        onClick={() => addInput.current?.focus()}
        className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint flex cursor-text flex-wrap items-center gap-1.5 rounded-xl border p-2.5 transition-colors focus-within:outline-2"
      >
        {product.collections.length > 0 && (
          <ul aria-label="Collections" className="contents">
            {product.collections.map((collection) => (
              <li
                key={collection.id}
                title={
                  collection.collection_type
                    ? `${collectionTypeLabel(collection.collection_type)} collection · ${collection.handle}`
                    : collection.handle
                }
                className={`${TAG_CHIP} flex items-center gap-1 pr-1.5`}
              >
                {collection.title}
                <button
                  type="button"
                  aria-label={`Remove from ${collection.title}`}
                  title="Remove from this collection"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(collection)
                  }}
                  className="hover:text-danger inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current transition-colors"
                >
                  <XIcon width={12} height={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id="edit-collection-id"
          ref={addInput}
          aria-label="Add to a collection"
          autoComplete="off"
          spellCheck={false}
          value={input}
          placeholder={
            product.collections.length > 0 ? 'Add another' : 'Search collections…'
          }
          role="combobox"
          aria-expanded={panelOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            listOpen && active >= 0 ? `${listId}-${active}` : undefined
          }
          aria-invalid={inputError ? true : undefined}
          onFocus={() => {
            setFocused(true)
            setActive(-1)
          }}
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
              event.preventDefault()
              event.stopPropagation()
              setFocused(false)
              setActive(-1)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              if (listOpen && active >= 0) select(shown[active])
              else void add()
            } else if (
              event.key === 'Backspace' &&
              input === '' &&
              product.collections.length > 0
            ) {
              onRemove(product.collections[product.collections.length - 1])
            }
          }}
          className="text-text placeholder:text-text-muted/70 min-w-32 flex-1 border-none bg-transparent px-1 py-1 text-[0.85rem] outline-none"
        />
      </div>

      {inputError && (
        <p role="alert" className="text-danger text-[0.78rem]">
          {inputError}
        </p>
      )}

      <p className="text-text-muted text-[0.76rem]">
        Collections are added and removed straight away, after you confirm — they
        aren&apos;t part of Save.
      </p>

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
                    : `No collection matches “${input.trim()}”.`}
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
