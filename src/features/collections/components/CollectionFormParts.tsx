import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import {
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  XIcon,
  type IconProps,
  UploadIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ROW_ACTION_DANGER, ROW_ACTION_ICON } from '../../../components/ui/rowActions.ts'
import { RichTextEditor } from '../../../components/ui/RichTextEditor.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { ListSelect } from '../../../components/ui/ListSelect.tsx'
import { SuggestInput } from '../../../components/ui/SuggestInput.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type {
  CollectionRuleColumn,
  CollectionRuleOptions,
} from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'
import { usePickProducts, usePickProductsScroll } from '../hooks/useCollections.ts'
import {
  blankCondition,
  columnOf,
  MAX_CONDITIONS,
  MAX_PRODUCTS,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  sortOrderLabel,
  type CollectionDraft,
  type ConditionDraft,
  type DraftErrors,
} from '../utils/collectionDraft.ts'
import { CollectionImage } from './CollectionParts.tsx'

export const INPUT =
  'border-border bg-surface text-text placeholder:text-text-muted focus:border-accent h-10 w-full rounded-lg border px-3 text-[0.8rem] outline-none transition-colors aria-[invalid=true]:border-danger'
const LABEL = 'text-[0.76rem] font-semibold'
const HINT = 'text-text-muted text-[0.7rem]'
const ERROR = 'text-danger text-[0.74rem]'

/** A form card: a bold heading (and a line under it), then its fields. */
export function FormCard({
  title,
  description,
  icon: Icon,
  actions,
  error,
  children,
}: {
  title: string
  description?: string
  /** A small accent tile before the title (the Add collection cards use it). */
  icon?: ComponentType<IconProps>
  actions?: ReactNode
  error?: string
  /** Left out for a card that is only a header (the Collection type card's toggle). */
  children?: ReactNode
}) {
  return (
    <section aria-label={title} className={`${DETAIL_CARD} flex flex-col`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {Icon && (
          <span className="bg-accent-tint text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Icon width={16} height={16} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[0.88rem] leading-tight font-semibold">{title}</h3>
          {description && (
            <p className="text-text-muted m-0 mt-0.5 text-[0.74rem] leading-snug">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {error && (
        <p role="alert" className="text-danger m-0 px-4 pb-3 text-[0.76rem]">
          {error}
        </p>
      )}
      {children && (
        <div className="border-border-strong flex flex-col gap-3.5 border-t p-4">
          {children}
        </div>
      )}
    </section>
  )
}

/** A labelled text box with its hint, character count and problem. */
export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  max,
  placeholder,
  required = false,
  multiline = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  max?: number
  placeholder?: string
  required?: boolean
  multiline?: boolean
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ')
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={LABEL}>
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
        {max !== undefined && (
          <span className={HINT}>
            {value.length}/{max}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${INPUT} h-auto resize-y py-2`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={INPUT}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className={`${HINT} m-0`}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className={`${ERROR} m-0`}>
          {error}
        </p>
      )}
    </div>
  )
}

type Change = (changes: Partial<CollectionDraft>) => void

/** Title and the rich-text description. */
export function BasicsFields({
  draft,
  errors,
  onChange,
  idPrefix,
  compactDescription = false,
}: {
  draft: CollectionDraft
  errors: DraftErrors
  onChange: Change
  idPrefix: string
  /** A shorter description editor (the Add collection page). */
  compactDescription?: boolean
}) {
  return (
    <>
      <TextField
        id={`${idPrefix}-title`}
        label="Title"
        required
        value={draft.title}
        onChange={(title) => onChange({ title })}
        error={errors.title}
        placeholder="e.g. Juice Bottles"
      />
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Description</span>
        <RichTextEditor
          id={`${idPrefix}-description`}
          label="Description"
          value={draft.descriptionHtml}
          onChange={(descriptionHtml) => onChange({ descriptionHtml })}
          compact={compactDescription}
        />
      </div>
    </>
  )
}

/** The picture (a public https address) and its alt text; on an existing one, Remove picture. */
export function ImageFields({
  draft,
  errors,
  onChange,
  idPrefix,
  canRemove = false,
}: {
  draft: CollectionDraft
  errors: DraftErrors
  onChange: Change
  idPrefix: string
  canRemove?: boolean
}) {
  return (
    <div className="flex items-start gap-4">
      <CollectionImage src={draft.removeImage ? null : draft.imageUrl} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <TextField
          id={`${idPrefix}-image`}
          label="Image address"
          value={draft.removeImage ? '' : draft.imageUrl}
          onChange={(imageUrl) => onChange({ imageUrl, removeImage: false })}
          error={errors.imageUrl}
          hint="A public https:// link to the picture."
          placeholder="https://cdn.shopify.com/…"
        />
        <TextField
          id={`${idPrefix}-image-alt`}
          label="Alt text"
          value={draft.imageAlt}
          onChange={(imageAlt) => onChange({ imageAlt })}
          hint="Describes the picture for people who can't see it."
        />
        {canRemove && (
          <label className="flex items-center gap-2 text-[0.82rem]">
            <input
              type="checkbox"
              checked={draft.removeImage}
              onChange={(event) => onChange({ removeImage: event.target.checked })}
              className="accent-accent h-4 w-4"
            />
            Remove the picture
          </label>
        )}
      </div>
    </div>
  )
}

/** The picture types a collection can have, and the biggest file (the store's own limit for images). */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const IMAGE_TYPES = IMAGE_ACCEPT.split(',')
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

/**
 * The collection's picture, **only from the computer** (Add collection): a dashed area to choose or
 * drop a file (JPG, PNG, WebP or GIF, up to 20 MB), then a preview with its name and size, a Remove
 * button and the alt text. The file is kept by the form and uploaded when the collection is created;
 * nothing is sent from here.
 */
export function ImageUploadField({
  file,
  onFile,
  alt,
  onAlt,
  idPrefix,
}: {
  file: File | null
  onFile: (file: File | null) => void
  alt: string
  onAlt: (alt: string) => void
  idPrefix: string
}) {
  const [problem, setProblem] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  // The preview is this browser's own copy of the chosen file; the previous one is let go of when it
  // changes and the last one when the form closes.
  const [preview, setPreview] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )
  function showPreview(next: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = next ? URL.createObjectURL(next) : null
    previewRef.current = url
    setPreview(url)
  }

  function choose(chosen: File | undefined) {
    if (!chosen) return
    if (!IMAGE_TYPES.includes(chosen.type)) {
      setProblem(`“${chosen.name}” is not a JPG, PNG, WebP or GIF picture.`)
      return
    }
    if (chosen.size > IMAGE_MAX_BYTES) {
      setProblem(`“${chosen.name}” is over 20 MB.`)
      return
    }
    setProblem(null)
    showPreview(chosen)
    onFile(chosen)
  }

  return (
    <div className="flex flex-col gap-4">
      {file ? (
        <div className="border-border bg-surface flex items-center gap-3 rounded-xl border p-3">
          {preview && (
            <img
              src={preview}
              alt=""
              className="border-border bg-bg h-20 w-20 shrink-0 rounded-lg border object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[0.85rem] font-semibold" title={file.name}>
              {file.name}
            </p>
            <p className="text-text-muted m-0 text-[0.76rem]">{fileSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setProblem(null)
              showPreview(null)
              onFile(null)
            }}
            className="border-border bg-bg text-text hover:border-danger hover:text-danger flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.78rem] font-semibold transition-colors"
          >
            <XIcon width={12} height={12} />
            Remove
          </button>
        </div>
      ) : (
        <label
          htmlFor={`${idPrefix}-image-file`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            choose(event.dataTransfer.files[0])
          }}
          className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragging
              ? 'border-accent bg-accent-tint/50'
              : 'border-border hover:border-accent hover:bg-accent-tint/30'
          }`}
        >
          <UploadIcon width={22} height={22} className="text-accent" />
          <span className="text-[0.85rem] font-semibold">Upload from your computer</span>
          <span className="text-text-muted text-[0.74rem]">
            or drop a picture here · JPG, PNG, WebP or GIF · up to 20 MB
          </span>
        </label>
      )}
      <input
        id={`${idPrefix}-image-file`}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          choose(event.target.files?.[0])
          // The same file can be chosen again after a Remove.
          event.target.value = ''
        }}
      />
      {problem && (
        <p role="alert" className={`${ERROR} m-0`}>
          {problem}
        </p>
      )}
      {file && (
        <TextField
          id={`${idPrefix}-image-alt`}
          label="Alt text"
          value={alt}
          onChange={onAlt}
          hint="Describes the picture for people who can't see it."
        />
      )}
    </div>
  )
}

/** SEO title and description, with their character counts. */
export function SeoFields({
  draft,
  errors,
  onChange,
  idPrefix,
}: {
  draft: CollectionDraft
  errors: DraftErrors
  onChange: Change
  idPrefix: string
}) {
  return (
    <>
      <TextField
        id={`${idPrefix}-seo-title`}
        label="Page title"
        value={draft.seoTitle}
        max={SEO_TITLE_MAX}
        onChange={(seoTitle) => onChange({ seoTitle })}
        error={errors.seoTitle}
      />
      <TextField
        id={`${idPrefix}-seo-description`}
        label="Meta description"
        multiline
        value={draft.seoDescription}
        max={SEO_DESCRIPTION_MAX}
        onChange={(seoDescription) => onChange({ seoDescription })}
        error={errors.seoDescription}
      />
    </>
  )
}

/** How the collection's products are ordered in the store (from the rule options). */
export function SortOrderField({
  value,
  sortOrders,
  onChange,
  id,
}: {
  value: string
  sortOrders: readonly string[]
  onChange: (value: string) => void
  id: string
}) {
  const options: SelectOption[] = [
    ...(value ? [] : [{ value: '', label: 'Store default' }]),
    ...sortOrders.map((code) => ({ value: code, label: sortOrderLabel(code) })),
  ]
  if (value && !sortOrders.includes(value)) {
    options.unshift({ value, label: sortOrderLabel(value) })
  }
  return (
    <SelectField
      id={id}
      label="Sort products"
      value={value}
      options={options}
      onChange={onChange}
    />
  )
}

/**
 * The conditions of an Automated collection: "Products must match all / any conditions", then a
 * row per condition — what to check, how, and the value (a number box for numbers, nothing for a
 * yes/no column). 1 to 60 rows. Every choice comes from `GET /collections/rule-options`.
 */
export function RulesEditor({
  options,
  match,
  conditions,
  errors,
  onChange,
  idPrefix,
  hideMatch = false,
  hideAdd = false,
  tags,
}: {
  options: CollectionRuleOptions
  match: 'all' | 'any'
  conditions: ConditionDraft[]
  errors: DraftErrors
  onChange: (changes: Partial<Pick<CollectionDraft, 'match' | 'conditions'>>) => void
  idPrefix: string
  /** Leave out "Products must match all / any condition" (the draft keeps its own `match`). */
  hideMatch?: boolean
  /** Leave out the "Add another condition" button (the page puts it in its own header). */
  hideAdd?: boolean
  /** The store's tags: on a Tag condition the value box lists them all and narrows as you type. */
  tags?: readonly string[]
}) {
  const columns = options.columns
  const columnOptions: SelectOption[] = columns.map((column) => ({
    value: column.column,
    label: column.label,
  }))

  function update(index: number, changes: Partial<ConditionDraft>) {
    onChange({
      conditions: conditions.map((condition, at) =>
        at === index ? { ...condition, ...changes } : condition,
      ),
    })
  }

  function changeColumn(index: number, column: CollectionRuleColumn | undefined) {
    if (!column) return
    const current = conditions[index]
    const keepsRelation = column.relations.some(
      (relation) => relation.value === current.relation,
    )
    update(index, {
      column: column.column,
      relation: keepsRelation ? current.relation : (column.relations[0]?.value ?? ''),
      condition: column.value_type === 'boolean' ? '' : current.condition,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {!hideMatch && (
        <fieldset className="m-0 flex flex-wrap items-center gap-x-5 gap-y-2 border-none p-0">
          <legend className={`${LABEL} float-left mr-3`}>Products must match:</legend>
          {(options.match.length > 0
            ? options.match
            : [
                { value: 'all', label: 'all conditions' },
                { value: 'any', label: 'any condition' },
              ]
          ).map((item) => (
            <label
              key={item.value}
              className="flex cursor-pointer items-center gap-2 text-[0.85rem]"
            >
              <input
                type="radio"
                name={`${idPrefix}-match`}
                checked={match === item.value}
                onChange={() => onChange({ match: item.value === 'any' ? 'any' : 'all' })}
                className="accent-accent h-4 w-4"
              />
              {item.label}
            </label>
          ))}
        </fieldset>
      )}

      {errors.conditions && (
        <p role="alert" className={`${ERROR} m-0`}>
          {errors.conditions}
        </p>
      )}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {conditions.map((condition, index) => {
          const column = columnOf(columns, condition.column)
          const relations: SelectOption[] = (column?.relations ?? []).map((relation) => ({
            value: relation.value,
            label: relation.label,
          }))
          const valueError = errors[`conditions.${index}.condition`]
          const isNumber = column?.value_type === 'number'
          return (
            <li
              key={condition.key}
              className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-3"
            >
              <div className="grid items-center gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))_2rem]">
                <ListSelect
                  id={`${idPrefix}-condition-${index}-column`}
                  label={`Condition ${index + 1}: what to check`}
                  value={condition.column}
                  options={columnOptions}
                  onChange={(value) => changeColumn(index, columnOf(columns, value))}
                />
                <ListSelect
                  id={`${idPrefix}-condition-${index}-relation`}
                  label={`Condition ${index + 1}: how`}
                  value={condition.relation}
                  options={relations}
                  onChange={(relation) => update(index, { relation })}
                />
                {column?.value_type === 'boolean' ? (
                  <span className="text-text-muted flex h-8 items-center text-[0.76rem]">
                    No value needed
                  </span>
                ) : (column?.column.toUpperCase() === 'TAG' ||
                    column?.label.toLowerCase() === 'tag') &&
                  tags ? (
                  <SuggestInput
                    asSelect
                    id={`${idPrefix}-condition-${index}-value`}
                    value={condition.condition}
                    onChange={(value) => update(index, { condition: value })}
                    suggestions={tags}
                    placeholder="Search tags…"
                    invalid={Boolean(valueError)}
                    maxLength={255}
                    className={`${INPUT} h-8 pr-9 text-[0.76rem]`}
                  />
                ) : (
                  <input
                    type={isNumber ? 'number' : 'text'}
                    step={column?.column === 'VARIANT_INVENTORY' ? 1 : 'any'}
                    inputMode={isNumber ? 'decimal' : undefined}
                    aria-label={`Condition ${index + 1}: value`}
                    aria-invalid={Boolean(valueError)}
                    value={condition.condition}
                    placeholder={isNumber ? '0' : 'Value'}
                    onChange={(event) => update(index, { condition: event.target.value })}
                    className={`${INPUT} h-8 text-[0.76rem]`}
                  />
                )}
                <button
                  type="button"
                  aria-label={`Remove condition ${index + 1}`}
                  title="Remove condition"
                  disabled={conditions.length <= 1}
                  onClick={() =>
                    onChange({ conditions: conditions.filter((_, at) => at !== index) })
                  }
                  className="text-text-muted hover:bg-danger-bg hover:text-danger inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent transition-colors disabled:pointer-events-none disabled:opacity-40"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
              {valueError && (
                <p role="alert" className={`${ERROR} m-0`}>
                  {valueError}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {!hideAdd && (
        <div>
          <button
            type="button"
            disabled={conditions.length >= MAX_CONDITIONS || columns.length === 0}
            onClick={() =>
              onChange({ conditions: [...conditions, blankCondition(columns)] })
            }
            className="border-border bg-bg text-text hover:border-accent inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <PlusIcon width={14} height={14} />
            Add another condition
          </button>
        </div>
      )}
    </div>
  )
}

const CHOSEN_TH =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-2.5 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const CHOSEN_TD = 'px-3 py-1.5 align-middle'

/**
 * The products chosen for a manual collection, as a table like the listing pages': a sticky header, its
 * own vertical scroll (the box is capped in height) and the shared pagination footer under it (10 /
 * 25 / 50 / 100 a page). Picture and title, price, status and a remove button on each row.
 */
function ChosenProductsTable({
  picked,
  onChange,
}: {
  picked: PickedProduct[]
  onChange: (picked: PickedProduct[]) => void
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const totalPages = Math.max(1, Math.ceil(picked.length / pageSize))
  // Removing the last row of the last page steps back one page.
  const current = Math.min(page, totalPages)
  const rows = picked.slice((current - 1) * pageSize, current * pageSize)

  return (
    <div className="border-border-strong overflow-hidden rounded-xl border">
      <div className="relative max-h-80 overflow-auto">
        <table
          aria-label="Chosen products"
          className="w-full min-w-[480px] border-collapse text-[0.85rem]"
        >
          <thead>
            <tr>
              <th className={`${CHOSEN_TH} text-left`}>Product</th>
              <th className={`${CHOSEN_TH} text-right`}>Price</th>
              <th className={`${CHOSEN_TH} text-center`}>Status</th>
              <th className={`${CHOSEN_TH} text-center`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr
                key={item.id}
                className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors last:border-b-0"
              >
                <td className={CHOSEN_TD}>
                  <span className="flex min-w-0 items-center gap-3">
                    <CollectionImage src={item.image} />
                    <span className="min-w-0 truncate font-semibold" title={item.title}>
                      {item.title}
                    </span>
                  </span>
                </td>
                <td className={`${CHOSEN_TD} text-right whitespace-nowrap tabular-nums`}>
                  {item.price === null || item.price === undefined
                    ? '—'
                    : formatPrice(item.price, item.currency)}
                </td>
                <td className={`${CHOSEN_TD} text-text-muted text-center`}>
                  {item.status ? item.status.toLowerCase() : '—'}
                </td>
                <td className={`${CHOSEN_TD} text-center`}>
                  <button
                    type="button"
                    aria-label={`Remove ${item.title}`}
                    title="Remove"
                    onClick={() =>
                      onChange(picked.filter((other) => other.id !== item.id))
                    }
                    className={ROW_ACTION_DANGER}
                  >
                    <TrashIcon width={ROW_ACTION_ICON} height={ROW_ACTION_ICON} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationFooter
        compact
        page={current}
        pageSize={pageSize}
        total={picked.length}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />
    </div>
  )
}

/** A product chosen for a manual collection. */
export interface PickedProduct {
  id: string
  title: string
  image: string | null
  /** What the table of chosen products shows (all optional: a product without them shows a dash). */
  price?: string | number | null
  currency?: string | null
  status?: string | null
}

/**
 * Search the store's products (`GET /products?search=`) — nothing is listed until something is
 * typed — and tick them. Ticked ones stay as chips through searches. `exclude` hides products that
 * are already in the collection.
 */
export function ProductPicker({
  shop,
  picked,
  onChange,
  exclude,
  error,
  idPrefix,
  listAll = false,
  table = false,
}: {
  shop: string
  picked: PickedProduct[]
  onChange: (picked: PickedProduct[]) => void
  exclude?: ReadonlySet<string>
  error?: string
  idPrefix: string
  /**
   * Suggest every product of the store (A–Z, with its picture) as soon as the box is focused, and
   * narrow the list as the person types — instead of listing nothing until something is typed.
   */
  listAll?: boolean
  /** Show the chosen products as a scrolling, paged table (Add collection) instead of small cards. */
  table?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearchState] = useState('')
  const [page, setPage] = useState(1)
  const [typed, setTyped] = useDebouncedField(search, (value) => {
    setSearchState(value)
    setPage(1)
  })
  // Two ways to list: the suggestion list that loads more as it is scrolled (`listAll`), and the
  // paged one with Previous / Next (the Add products window).
  const paged = usePickProducts(shop, search, page, false, !listAll)
  const scrolled = usePickProductsScroll(
    shop,
    search,
    listAll && (open || search.trim() !== ''),
  )
  const store = listAll
    ? {
        items: scrolled.items,
        total: scrolled.total,
        totalPages: 1,
        isFetching: scrolled.isFetching,
        error: scrolled.error,
      }
    : paged
  const pickedIds = new Set(picked.map((item) => item.id))
  const rows = store.items.filter((item) => !exclude?.has(item.id))

  function toggle(item: (typeof store.items)[number]) {
    onChange(
      pickedIds.has(item.id)
        ? picked.filter((other) => other.id !== item.id)
        : [
            ...picked,
            {
              id: item.id,
              title: item.title,
              image: item.image_url,
              price: item.price_min,
              currency: item.currency,
              status: item.status,
            },
          ].slice(0, MAX_PRODUCTS),
    )
  }

  return (
    <div
      className="flex flex-col gap-3"
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        // Focus moving to something inside the picker (a row, the paging) keeps the list open.
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <label className="border-border bg-surface focus-within:border-accent flex h-10 items-center gap-2 rounded-lg border px-3">
        <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
        <span className="sr-only">Search the store’s products</span>
        <input
          id={`${idPrefix}-product-search`}
          type="search"
          value={typed}
          maxLength={200}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={
            listAll
              ? 'Search the store’s products to add…'
              : 'Type a product name or SKU to find it…'
          }
          className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {store.isFetching && (
          <SpinnerIcon width={14} height={14} className="text-text-muted animate-spin" />
        )}
      </label>

      {(search.trim() || (listAll && open)) && (
        <div
          tabIndex={-1}
          onScroll={(event) => {
            // Near the bottom: bring in the next products, if the store has more.
            const box = event.currentTarget
            if (
              listAll &&
              scrolled.hasMore &&
              !scrolled.isFetching &&
              box.scrollTop + box.clientHeight >= box.scrollHeight - 48
            ) {
              scrolled.fetchMore()
            }
          }}
          className="border-border max-h-72 overflow-y-auto rounded-lg border outline-none"
        >
          {store.error ? (
            <p className="text-danger m-0 px-3 py-4 text-center text-[0.82rem]">
              {store.error}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-text-muted m-0 px-3 py-4 text-center text-[0.82rem]">
              {store.isFetching
                ? search.trim()
                  ? 'Searching…'
                  : 'Loading the store’s products…'
                : search.trim() || !listAll
                  ? 'No product matches.'
                  : 'This store has no products.'}
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {rows.map((item) => (
                <li key={item.id} className="border-border border-b last:border-b-0">
                  <label className="hover:bg-accent-tint/40 flex cursor-pointer items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={pickedIds.has(item.id)}
                      onChange={() => toggle(item)}
                      className="accent-accent h-4 w-4"
                    />
                    <CollectionImage src={item.image_url} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.85rem] font-semibold">
                        {item.title}
                      </span>
                      <span className="text-text-muted block truncate text-[0.75rem]">
                        {formatPrice(item.price_min, item.currency)}
                        {item.status ? ` · ${item.status.toLowerCase()}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {listAll && rows.length > 0 && (
            <div className="border-border bg-bg text-text-muted sticky bottom-0 flex items-center justify-between gap-2 border-t px-3 py-2 text-[0.78rem]">
              <span>
                {rows.length.toLocaleString('en-GB')} of{' '}
                {store.total.toLocaleString('en-GB')} products
              </span>
              {scrolled.isFetchingMore ? (
                <span className="flex items-center gap-1.5">
                  <SpinnerIcon width={12} height={12} className="animate-spin" />
                  Loading more…
                </span>
              ) : scrolled.hasMore ? (
                <span>Scroll for more</span>
              ) : null}
            </div>
          )}
          {store.totalPages > 1 && (
            <div className="border-border flex items-center justify-between border-t px-3 py-2 text-[0.78rem]">
              <span className="text-text-muted">
                {store.total.toLocaleString('en-GB')} found
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="border-border bg-bg hover:border-accent h-7 cursor-pointer rounded-lg border px-2 text-[0.75rem] font-semibold disabled:pointer-events-none disabled:opacity-50"
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
                  className="border-border bg-bg hover:border-accent h-7 cursor-pointer rounded-lg border px-2 text-[0.75rem] font-semibold disabled:pointer-events-none disabled:opacity-50"
                >
                  Next
                </button>
              </span>
            </div>
          )}
        </div>
      )}

      {table && picked.length > 0 && (
        <ChosenProductsTable picked={picked} onChange={onChange} />
      )}
      {!table && picked.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-text-muted m-0 text-[0.75rem] font-semibold">
            {picked.length.toLocaleString('en-GB')}{' '}
            {picked.length === 1 ? 'product' : 'products'} in this collection
          </p>
          <ul
            className="m-0 grid list-none grid-cols-1 gap-2 p-0 min-[560px]:grid-cols-2 xl:grid-cols-3"
            aria-label="Chosen products"
          >
            {picked.map((item) => (
              <li
                key={item.id}
                className="border-border bg-bg flex items-center gap-2.5 rounded-lg border p-2"
              >
                <CollectionImage src={item.image} />
                <span
                  className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold"
                  title={item.title}
                >
                  {item.title}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${item.title}`}
                  onClick={() => onChange(picked.filter((other) => other.id !== item.id))}
                  className="text-text-muted hover:bg-danger-bg hover:text-danger flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 transition-colors"
                >
                  <XIcon width={12} height={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className={`${ERROR} m-0`}>
          {error}
        </p>
      )}
    </div>
  )
}
