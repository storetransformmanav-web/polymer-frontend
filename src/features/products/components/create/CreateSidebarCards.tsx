import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useAppSelector } from '../../../../app/store/hooks.ts'
import { PlusIcon, SearchIcon, XIcon } from '../../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../../components/ui/SelectField.tsx'
import {
  PRODUCT_EDIT_STATUSES,
  type ProductEditStatus,
} from '../../../../lib/api/endpoints.ts'
import { useKnownCollections } from '../../hooks/useKnownCollections.ts'
import { matchCollections } from '../../utils/collectionSuggestions.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { statusLabel } from '../../utils/format.ts'
import { TAG_CHIP, TagsInput } from '../edit/TagsSection.tsx'
import { EditField, FIELD_INPUT } from '../edit/fields.tsx'
import { CARD, type CreateSectionProps } from './CreateCard.tsx'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUS_OPTIONS: SelectOption[] = PRODUCT_EDIT_STATUSES.map((status) => ({
  value: status,
  label: statusLabel(status),
}))

/** A block of the sidebar card: separated from the one above by a thin line. */
const BLOCK = 'border-border flex flex-col gap-3.5 border-t p-4 first:border-t-0'

/**
 * Collections: a search box that, once it has the focus, lists **every collection the app
 * already knows** (those of the products it has loaded — the backend has no "list
 * collections" endpoint, so opening the box also reads the details of the products on the
 * list page) to pick from, leaving out smart collections (the API takes manual ones only);
 * typing narrows the list. Picked ones are chips with a ✕ under the
 * box. A collection that isn't listed can still be added by pasting its CRM ID (a UUID) and
 * pressing Enter. The product is sent with the collections' ids.
 */
function CollectionsPicker({
  ids,
  errors,
  onChange,
}: {
  ids: string[]
  errors: CreateSectionProps['errors']
  onChange: (ids: string[]) => void
}) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // Close on a click anywhere outside the field.
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // The create API takes manual collections only, so smart ones (filled by rules) aren't offered.
  const { collections: everyone, loading } = useKnownCollections(open)
  const known = useMemo(
    () =>
      everyone.filter(
        (collection) => collection.collection_type?.toLowerCase() !== 'smart',
      ),
    [everyone],
  )
  const chosen = useMemo(() => new Set(ids), [ids])
  const { shown, total } = useMemo(
    () => matchCollections(known, input, chosen),
    [known, input, chosen],
  )
  const titleOf = (id: string) => known.find((collection) => collection.id === id)?.title
  const typedId = UUID.test(input.trim()) ? input.trim().toLowerCase() : null

  function add(id: string) {
    if (!chosen.has(id)) onChange([...ids, id])
    setInput('')
    setProblem(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    const text = input.trim()
    if (!text) return
    if (typedId) return add(typedId)
    // A name: the collection called exactly that, else the only one the text narrows to.
    const named = shown.find(
      (collection) => collection.title.trim().toLowerCase() === text.toLowerCase(),
    )
    if (named) return add(named.id)
    if (total === 1) return add(shown[0].id)
    setProblem(
      total > 1
        ? 'Choose a collection from the list'
        : 'That is not a valid collection ID',
    )
  }

  return (
    <div ref={root} className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon
          width={15}
          height={15}
          className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <input
          id="create-collections"
          aria-label="Search collections"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? 'create-collections-list' : undefined}
          autoComplete="off"
          spellCheck={false}
          value={input}
          placeholder="Search or paste an ID"
          aria-invalid={problem ? true : undefined}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            setInput(event.target.value)
            setProblem(null)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className={`${FIELD_INPUT} pl-9`}
        />
      </div>

      {open && (
        <ul
          id="create-collections-list"
          aria-label="Collections to add"
          className="border-border bg-bg max-h-56 overflow-y-auto rounded-xl border p-1"
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
                  Add the collection with ID <span className="font-mono">{typedId}</span>
                </span>
              </button>
            </li>
          )}
          {shown.map((collection) => (
            <li key={collection.id}>
              <button
                type="button"
                onClick={() => add(collection.id)}
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
                : known.length === 0
                  ? 'No collections known yet. Paste a collection ID to add one.'
                  : input.trim()
                    ? 'No collection matches.'
                    : 'Every known collection is already added.'}
            </li>
          )}
          {shown.length > 0 && loading && (
            <li className="text-text-muted px-2.5 py-1.5 text-[0.76rem]" role="status">
              More collections are loading…
            </li>
          )}
        </ul>
      )}

      {problem && (
        <p role="alert" className="text-danger text-[0.78rem]">
          {problem}
        </p>
      )}

      {ids.length > 0 && (
        <ul aria-label="Collections" className="flex flex-wrap gap-1.5">
          {ids.map((id, index) => (
            <li key={id} className={`${TAG_CHIP} flex items-center gap-1 pr-1.5`}>
              <span className="max-w-44 truncate" title={id}>
                {titleOf(id) ?? id}
              </span>
              <button
                type="button"
                aria-label={`Remove collection ${titleOf(id) ?? id}`}
                onClick={() => onChange(ids.filter((value) => value !== id))}
                className="hover:text-danger inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current"
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
 * to), **Product organization** (type, vendor, collections, tags) and **Theme template**,
 * as blocks of one card separated by thin lines.
 */
export function CreateSidebarCard({
  draft,
  errors,
  update,
  shopOptions,
  shop,
}: SidebarProps) {
  // Every tag seen so far on the products loaded (the API has no list of all tags).
  const knownTags = useAppSelector((state) => state.products.facets.tags)

  return (
    <section aria-label="Product organization" className={`${CARD} flex flex-col`}>
      <div className={BLOCK}>
        <SelectField
          compact
          id="create-status"
          label="Status"
          value={draft.status}
          options={STATUS_OPTIONS}
          onChange={(status) => update({ status: status as ProductEditStatus })}
        />
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
        <EditField id="create-type" label="Type" error={errors.productType}>
          <input
            id="create-type"
            autoComplete="off"
            value={draft.productType}
            aria-invalid={errors.productType ? true : undefined}
            onChange={(event) => update({ productType: event.target.value })}
            className={FIELD_INPUT}
          />
        </EditField>
        <EditField
          id="create-vendor"
          label="Vendor"
          error={errors.vendor}
          counter={
            draft.vendor.length > LIMITS.vendor * 0.8
              ? { value: draft.vendor.trim().length, max: LIMITS.vendor }
              : undefined
          }
        >
          <input
            id="create-vendor"
            autoComplete="off"
            value={draft.vendor}
            aria-invalid={errors.vendor ? true : undefined}
            onChange={(event) => update({ vendor: event.target.value })}
            className={FIELD_INPUT}
          />
        </EditField>
        <EditField id="create-collections" label="Collections">
          <CollectionsPicker
            ids={draft.collections}
            errors={errors}
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
