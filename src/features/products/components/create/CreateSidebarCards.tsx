import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAppSelector } from '../../../../app/store/hooks.ts'
import { PlusIcon, XIcon } from '../../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../../components/ui/SelectField.tsx'
import { SuggestInput } from '../../../../components/ui/SuggestInput.tsx'
import {
  PRODUCT_EDIT_STATUSES,
  type ProductEditStatus,
} from '../../../../lib/api/endpoints.ts'
import { useCollectionSearch } from '../../hooks/useCollectionSearch.ts'
import { collectionKey } from '../../utils/collectionSuggestions.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { statusLabel } from '../../utils/format.ts'
import { TAG_CHIP, TagsInput } from '../edit/TagsSection.tsx'
import { EditField, FIELD_INPUT } from '../edit/fields.tsx'
import { CARD, type CreateSectionProps } from './CreateCard.tsx'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Room the list wants below the box before it opens above it instead (px). */
const LIST_ROOM = 280

/** Collections asked for when the box opens (the backend's page size). */
const LIST_SIZE = 50

const STATUS_OPTIONS: SelectOption[] = PRODUCT_EDIT_STATUSES.map((status) => ({
  value: status,
  label: statusLabel(status),
}))

/** What each status means for customers, shown under the Status dropdown. */
const STATUS_HINTS: Record<ProductEditStatus, string> = {
  ACTIVE: 'Active: customers can see and buy this product on your store.',
  DRAFT: 'Draft: hidden from customers until you make it Active.',
  ARCHIVED: 'Archived: hidden from customers and kept out of your active products.',
}

/** A block of the sidebar card: separated from the one above by a thin line. */
const BLOCK = 'border-border flex flex-col gap-3.5 border-t p-4 first:border-t-0'

/**
 * Collections: a search box that, once it has the focus, lists **the store's collections from
 * the backend** (`GET /collections?type=custom`, the first 50 by title — the create API takes
 * manual collections only) to pick from; typing searches the backend (`search=`), and the
 * list says how many more there are. Picked ones are chips with a ✕ inside the same card as the box (like the tags). A
 * collection can also be added by pasting its CRM ID (a UUID) and pressing Enter — the create
 * API takes ids. The product is sent with the collections' ids.
 */
function CollectionsPicker({
  ids,
  errors,
  shop,
  onChange,
}: {
  ids: string[]
  errors: CreateSectionProps['errors']
  /** The store the product is created in (its collections are the ones listed). */
  shop: string
  onChange: (ids: string[]) => void
}) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // The names of the picked collections, learnt from the rows they were picked from.
  const [titles, setTitles] = useState<Record<string, string>>({})
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  // Where the list goes: under the card (above it when there is no room below), and whether
  // the card is on screen at all.
  const [place, setPlace] = useState<{
    left: number
    width: number
    top?: number
    bottom?: number
    visible: boolean
  } | null>(null)

  // Close on a click anywhere outside the field.
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (root.current?.contains(target) || list.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Nothing is asked until the box is opened; then the backend's first page, or its search.
  const { found, total, loading, failed, lookup } = useCollectionSearch(input, shop, {
    all: open,
    pageSize: LIST_SIZE,
  })
  const chosen = useMemo(() => new Set(ids), [ids])
  const shown = useMemo(
    () => found.filter((collection) => !chosen.has(collection.id)),
    [found, chosen],
  )
  // Keep the list with its card: placed when it opens and moved again whenever the page scrolls
  // or the window is resized (it is fixed to the screen, so it would otherwise stay behind).
  // It stays open while you scroll; it is only hidden while the card is scrolled out of view.
  useEffect(() => {
    if (!open) return undefined
    function measure() {
      const rect = card.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom
      const upward = below < LIST_ROOM && rect.top > below
      setPlace({
        left: rect.left,
        width: rect.width,
        // A box that isn't laid out (no size) can't be off screen; otherwise it must be in view.
        visible:
          (rect.width === 0 && rect.height === 0) ||
          (rect.bottom > 0 && rect.top < window.innerHeight),
        ...(upward
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }
    function onScroll(event: Event) {
      // Scrolling the list itself (a long one) moves nothing.
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
  }, [open, ids.length, input])
  const typedId = UUID.test(input.trim()) ? input.trim().toLowerCase() : null

  function add(id: string, title?: string) {
    if (!chosen.has(id)) onChange([...ids, id])
    if (title) setTitles((known) => ({ ...known, [id]: title }))
    setInput('')
    setProblem(null)
  }

  async function submitText() {
    const text = input.trim()
    if (!text) return
    if (typedId) return add(typedId)
    // The collection called exactly that, asked of the backend now so Enter doesn't have to
    // wait for the typing pause.
    try {
      const answer = await lookup(text)
      const named = answer.items.find(
        (collection) =>
          !chosen.has(collection.id) &&
          collectionKey(collection.title) === collectionKey(text),
      )
      if (named) return add(named.id, named.title)
      setProblem(`No collection is called “${text}”`)
    } catch {
      setProblem('Could not search the collections')
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      return
    }
    if (event.key === 'Backspace' && input === '' && ids.length > 0) {
      onChange(ids.slice(0, -1))
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    void submitText()
  }

  const more = total - found.length
  const showList = open && place !== null && place.visible

  return (
    <div ref={root} className="flex flex-col gap-1.5">
      {/* Same card as the tags: the picked collections are chips inside it, and the box new
          ones are searched in is in the same card. Clicking anywhere in it focuses the box. */}
      <div
        ref={card}
        onClick={() => box.current?.focus()}
        className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint flex cursor-text flex-wrap items-center gap-1.5 rounded-xl border p-2.5 transition-colors focus-within:outline-2"
      >
        {ids.length > 0 && (
          <ul aria-label="Collections" className="contents">
            {ids.map((id, index) => (
              <li key={id} className={`${TAG_CHIP} flex items-center gap-1 pr-1.5`}>
                <span className="max-w-44 truncate" title={id}>
                  {titles[id] ?? id}
                </span>
                <button
                  type="button"
                  aria-label={`Remove collection ${titles[id] ?? id}`}
                  onClick={() => onChange(ids.filter((value) => value !== id))}
                  className="hover:text-danger inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current transition-colors"
                >
                  <XIcon width={12} height={12} />
                </button>
                {errors[`collections.${index}`] && (
                  <span role="alert" className="text-danger">
                    {errors[`collections.${index}`]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <input
          id="create-collections"
          ref={box}
          aria-label="Search collections"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? 'create-collections-list' : undefined}
          autoComplete="off"
          spellCheck={false}
          value={input}
          placeholder={ids.length > 0 ? 'Add another' : 'Search collections by name'}
          aria-invalid={problem ? true : undefined}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setInput(event.target.value)
            setProblem(null)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className="text-text placeholder:text-text-muted/70 min-w-32 flex-1 border-none bg-transparent px-1 py-1 text-[0.85rem] outline-none"
        />
      </div>

      {problem && (
        <p role="alert" className="text-danger text-[0.78rem]">
          {problem}
        </p>
      )}

      {/* Drawn on top of the page (fixed to the screen, like the tags' list) so the page's own
          scrolling and clipping never cut it; it follows its card while the page scrolls. */}
      {showList &&
        createPortal(
          <ul
            ref={list}
            id="create-collections-list"
            aria-label="Collections to add"
            // Keep the focus in the box while picking.
            onMouseDown={(event) => event.preventDefault()}
            style={{
              left: place.left,
              top: place.top,
              bottom: place.bottom,
              width: place.width,
            }}
            className="border-border bg-bg fixed z-50 max-h-64 overflow-y-auto rounded-xl border p-1.5 shadow-lg"
          >
            {typedId && !chosen.has(typedId) && (
              <li>
                <button
                  type="button"
                  onClick={() => add(typedId)}
                  className="hover:bg-accent-tint/60 flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[0.82rem]"
                >
                  <PlusIcon width={14} height={14} className="shrink-0" />
                  <span className="min-w-0 truncate">
                    Add the collection with ID{' '}
                    <span className="font-mono">{typedId}</span>
                  </span>
                </button>
              </li>
            )}
            {shown.map((collection) => (
              <li key={collection.id}>
                <button
                  type="button"
                  onClick={() => add(collection.id, collection.title)}
                  className="hover:bg-accent-tint/60 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[0.85rem] font-medium"
                >
                  <span className="min-w-0 truncate">{collection.title}</span>
                </button>
              </li>
            ))}
            {shown.length === 0 && !typedId && (
              <li className="text-text-muted px-2.5 py-2 text-[0.8rem]" role="status">
                {loading
                  ? 'Loading collections…'
                  : failed
                    ? 'Could not load the collections. Try again in a moment.'
                    : found.length > 0
                      ? 'Every listed collection is already added.'
                      : input.trim()
                        ? `No collection matches “${input.trim()}”.`
                        : 'No collections found.'}
              </li>
            )}
            {shown.length > 0 && (loading || more > 0) && (
              <li className="text-text-muted px-2.5 py-1.5 text-[0.76rem]" role="status">
                {loading
                  ? 'Loading collections…'
                  : `Showing ${found.length} of ${total} — keep typing to narrow the list.`}
              </li>
            )}
          </ul>,
          document.body,
        )}
    </div>
  )
}

interface SidebarProps extends CreateSectionProps {
  /** The stores a product can be created in. */
  shopOptions: SelectOption[]
  /** The store in use (the chosen one, or the default). */
  shop: string
}

/**
 * The right-hand card, after the store admin's: **Status** (and the store the product goes
 * to), **Product organization** (type, vendor, collections, tags) and **Theme template**, as
 * blocks of one card separated by thin lines. Type, vendor, collections and tags suggest what
 * already exists.
 */
export function CreateSidebarCard({
  draft,
  errors,
  update,
  shopOptions,
  shop,
}: SidebarProps) {
  // Every value seen so far on the products loaded (the API has no list of them).
  const {
    tags: knownTags,
    productTypes,
    vendors,
  } = useAppSelector((state) => state.products.facets)

  return (
    <section aria-label="Product organization" className={`${CARD} flex flex-col`}>
      <div className={BLOCK}>
        <div className="flex flex-col gap-1.5">
          <SelectField
            compact
            id="create-status"
            label="Status"
            value={draft.status}
            options={STATUS_OPTIONS}
            onChange={(status) => update({ status: status as ProductEditStatus })}
          />
          <p className="text-text-muted text-[0.76rem]">{STATUS_HINTS[draft.status]}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <SelectField
            compact
            id="create-shop"
            label="Store"
            value={shop}
            options={
              shopOptions.length > 0
                ? shopOptions
                : [{ value: '', label: 'No stores available' }]
            }
            onChange={(value) => update({ shop: value })}
          />
          {errors.shop && (
            <p role="alert" className="text-danger text-[0.78rem]">
              {errors.shop}
            </p>
          )}
        </div>
      </div>

      <div className={BLOCK}>
        <h3 className="text-text-muted text-[0.82rem] font-semibold">
          Product organization
        </h3>
        <EditField
          id="create-type"
          label="Product type"
          error={errors.productType}
          hint="For grouping and filtering, e.g. Carrier bags."
        >
          <SuggestInput
            id="create-type"
            value={draft.productType}
            suggestions={productTypes}
            invalid={Boolean(errors.productType)}
            onChange={(productType) => update({ productType })}
            className={FIELD_INPUT}
          />
        </EditField>
        <EditField
          id="create-vendor"
          label="Vendor"
          error={errors.vendor}
          hint="The brand or supplier that makes the product."
          counter={
            draft.vendor.length > LIMITS.vendor * 0.8
              ? { value: draft.vendor.trim().length, max: LIMITS.vendor }
              : undefined
          }
        >
          <SuggestInput
            id="create-vendor"
            value={draft.vendor}
            suggestions={vendors}
            invalid={Boolean(errors.vendor)}
            onChange={(vendor) => update({ vendor })}
            className={FIELD_INPUT}
          />
        </EditField>
        <EditField
          id="create-collections"
          label="Collections"
          hint="Add the product to manual collections. Smart collections fill themselves by rules, so they aren't listed."
        >
          <CollectionsPicker
            ids={draft.collections}
            errors={errors}
            shop={shop}
            onChange={(collections) => update({ collections })}
          />
        </EditField>
        <EditField id="create-tags" label="Tags">
          <TagsInput
            id="create-tags"
            ariaLabel="Add tags"
            listLabel="Tags"
            removeLabel={(tag) => `Remove tag ${tag}`}
            tags={draft.tags}
            onChange={(tags) => update({ tags })}
            suggestions={knownTags}
            suggestAll
            placeholder="Search or add tags"
            hint="Pick an existing tag from the list, or type a new one and press Enter."
          />
        </EditField>
      </div>

      <div className={BLOCK}>
        <EditField
          id="create-template"
          label="Theme template"
          error={errors.templateSuffix}
          hint="Optional. Leave blank to use your theme's standard product page."
        >
          <input
            id="create-template"
            autoComplete="off"
            value={draft.templateSuffix}
            placeholder="Default product"
            aria-invalid={errors.templateSuffix ? true : undefined}
            onChange={(event) => update({ templateSuffix: event.target.value })}
            className={FIELD_INPUT}
          />
        </EditField>
      </div>
    </section>
  )
}
