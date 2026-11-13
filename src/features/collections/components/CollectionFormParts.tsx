import { useState, type ReactNode } from 'react'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import {
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { RichTextEditor } from '../../../components/ui/RichTextEditor.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type {
  CollectionRuleColumn,
  CollectionRuleOptions,
} from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'
import { usePickProducts } from '../hooks/useCollections.ts'
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
  'border-border bg-surface text-text placeholder:text-text-muted focus:border-accent h-10 w-full rounded-lg border px-3 text-[0.85rem] outline-none transition-colors aria-[invalid=true]:border-danger'
const LABEL = 'text-[0.8rem] font-semibold'
const HINT = 'text-text-muted text-[0.75rem]'
const ERROR = 'text-danger text-[0.78rem]'

/** A form card: a bold heading (and a line under it), then its fields. */
export function FormCard({
  title,
  description,
  actions,
  error,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} className={`${DETAIL_CARD} flex flex-col`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-[0.95rem] font-semibold">{title}</h3>
          {description && (
            <p className="text-text-muted mt-0.5 text-[0.8rem] leading-snug">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {error && (
        <p role="alert" className="text-danger px-5 pb-2 text-[0.82rem]">
          {error}
        </p>
      )}
      <div className="border-border-strong flex flex-col gap-4 border-t p-5">
        {children}
      </div>
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
}: {
  draft: CollectionDraft
  errors: DraftErrors
  onChange: Change
  idPrefix: string
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
}: {
  options: CollectionRuleOptions
  match: 'all' | 'any'
  conditions: ConditionDraft[]
  errors: DraftErrors
  onChange: (changes: Partial<Pick<CollectionDraft, 'match' | 'conditions'>>) => void
  idPrefix: string
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
              <div className="grid items-start gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <SelectField
                  compact
                  hideLabel
                  id={`${idPrefix}-condition-${index}-column`}
                  label={`Condition ${index + 1}: what to check`}
                  value={condition.column}
                  options={columnOptions}
                  onChange={(value) => changeColumn(index, columnOf(columns, value))}
                />
                <SelectField
                  compact
                  hideLabel
                  id={`${idPrefix}-condition-${index}-relation`}
                  label={`Condition ${index + 1}: how`}
                  value={condition.relation}
                  options={relations}
                  onChange={(relation) => update(index, { relation })}
                />
                {column?.value_type === 'boolean' ? (
                  <span className="text-text-muted flex h-8 items-center text-[0.78rem]">
                    No value needed
                  </span>
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
                    className={`${INPUT} h-8 text-[0.78rem]`}
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
    </div>
  )
}

/** A product chosen for a manual collection. */
export interface PickedProduct {
  id: string
  title: string
  image: string | null
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
}: {
  shop: string
  picked: PickedProduct[]
  onChange: (picked: PickedProduct[]) => void
  exclude?: ReadonlySet<string>
  error?: string
  idPrefix: string
}) {
  const [search, setSearchState] = useState('')
  const [page, setPage] = useState(1)
  const [typed, setTyped] = useDebouncedField(search, (value) => {
    setSearchState(value)
    setPage(1)
  })
  const store = usePickProducts(shop, search, page)
  const pickedIds = new Set(picked.map((item) => item.id))
  const rows = store.items.filter((item) => !exclude?.has(item.id))

  function toggle(item: (typeof store.items)[number]) {
    onChange(
      pickedIds.has(item.id)
        ? picked.filter((other) => other.id !== item.id)
        : [...picked, { id: item.id, title: item.title, image: item.image_url }].slice(
            0,
            MAX_PRODUCTS,
          ),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="border-border bg-surface focus-within:border-accent flex h-10 items-center gap-2 rounded-lg border px-3">
        <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
        <span className="sr-only">Search the store’s products</span>
        <input
          id={`${idPrefix}-product-search`}
          type="search"
          value={typed}
          maxLength={200}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="Type a product name or SKU to find it…"
          className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {store.isFetching && (
          <SpinnerIcon width={14} height={14} className="text-text-muted animate-spin" />
        )}
      </label>

      {search.trim() && (
        <div className="border-border max-h-64 overflow-y-auto rounded-lg border">
          {store.error ? (
            <p className="text-danger m-0 px-3 py-4 text-center text-[0.82rem]">
              {store.error}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-text-muted m-0 px-3 py-4 text-center text-[0.82rem]">
              {store.isFetching ? 'Searching…' : 'No product matches.'}
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

      {picked.length > 0 && (
        <ul
          className="m-0 flex list-none flex-wrap gap-1.5 p-0"
          aria-label="Chosen products"
        >
          {picked.map((item) => (
            <li
              key={item.id}
              className="bg-accent-tint text-accent inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-[0.75rem] font-semibold"
            >
              {item.title}
              <button
                type="button"
                aria-label={`Remove ${item.title}`}
                onClick={() => onChange(picked.filter((other) => other.id !== item.id))}
                className="hover:bg-accent hover:text-accent-contrast flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current"
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className={`${ERROR} m-0`}>
          {error}
        </p>
      )}
    </div>
  )
}
