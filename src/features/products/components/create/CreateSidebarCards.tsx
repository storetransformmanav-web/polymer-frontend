import { useState, type KeyboardEvent } from 'react'
import { PlusIcon, TrashIcon, XIcon } from '../../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../../components/ui/SelectField.tsx'
import {
  PRODUCT_EDIT_STATUSES,
  type ProductEditStatus,
} from '../../../../lib/api/endpoints.ts'
import {
  blankMetafield,
  CREATE_LIMITS,
  METAFIELD_TYPES,
  type MetafieldDraft,
} from '../../utils/createDraft.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { statusLabel } from '../../utils/format.ts'
import { TAG_CHIP, TagsInput } from '../edit/TagsSection.tsx'
import {
  CheckField,
  EditField,
  FIELD_INPUT,
  ICON_BUTTON,
  TEXT_BUTTON,
} from '../edit/fields.tsx'
import { CreateCard, type CreateSectionProps } from './CreateCard.tsx'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUS_OPTIONS: SelectOption[] = PRODUCT_EDIT_STATUSES.map((status) => ({
  value: status,
  label: statusLabel(status),
}))

interface StatusCardProps extends CreateSectionProps {
  /** The stores a product can be created in. */
  shopOptions: SelectOption[]
  /** The store in use (the chosen one, or the default). */
  shop: string
}

/** Where the product is created, and whether it is live. */
export function CreateStatusCard({
  draft,
  errors,
  update,
  shopOptions,
  shop,
}: StatusCardProps) {
  return (
    <CreateCard title="Status and store">
      <SelectField
        id="create-status"
        label="Status"
        value={draft.status}
        options={STATUS_OPTIONS}
        onChange={(status) => update({ status: status as ProductEditStatus })}
      />
      <div className="flex flex-col gap-1.5">
        <SelectField
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
    </CreateCard>
  )
}

/** A list of collection ids: type or paste one, Enter adds it, ✕ removes it. */
function CollectionIds({
  ids,
  errors,
  onChange,
}: {
  ids: string[]
  errors: CreateSectionProps['errors']
  onChange: (ids: string[]) => void
}) {
  const [input, setInput] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  function add() {
    const id = input.trim().toLowerCase()
    if (!id) return
    if (!UUID.test(id)) return setProblem('That is not a valid collection ID')
    if (ids.includes(id)) return setProblem('Already added')
    onChange([...ids, id])
    setInput('')
    setProblem(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      add()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {ids.length > 0 && (
        <ul aria-label="Collections" className="flex flex-col gap-1.5">
          {ids.map((id, index) => (
            <li
              key={id}
              className={`${TAG_CHIP} flex items-center justify-between gap-2 font-mono text-[0.74rem]`}
            >
              <span className="min-w-0 truncate">{id}</span>
              <button
                type="button"
                aria-label={`Remove collection ${id}`}
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
      <div className="flex gap-2">
        <input
          aria-label="Add a collection by ID"
          autoComplete="off"
          spellCheck={false}
          value={input}
          placeholder="Collection ID"
          aria-invalid={problem ? true : undefined}
          onChange={(event) => {
            setInput(event.target.value)
            setProblem(null)
          }}
          onKeyDown={handleKeyDown}
          className={`${FIELD_INPUT} font-mono text-[0.78rem]`}
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
      {problem && (
        <p role="alert" className="text-danger text-[0.78rem]">
          {problem}
        </p>
      )}
    </div>
  )
}

/** Vendor, type, tags, collections, category and gift card. */
export function CreateOrganizationCard({ draft, errors, update }: CreateSectionProps) {
  return (
    <CreateCard title="Organization">
      <EditField
        id="create-vendor"
        label="Vendor"
        optional
        error={errors.vendor}
        counter={{ value: draft.vendor.trim().length, max: LIMITS.vendor }}
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
      <EditField
        id="create-type"
        label="Product type"
        optional
        error={errors.productType}
      >
        <input
          id="create-type"
          autoComplete="off"
          value={draft.productType}
          aria-invalid={errors.productType ? true : undefined}
          onChange={(event) => update({ productType: event.target.value })}
          className={FIELD_INPUT}
        />
      </EditField>
      <EditField id="create-tags" label="Tags" optional>
        <TagsInput
          id="create-tags"
          ariaLabel="Add tags"
          listLabel="Tags"
          removeLabel={(tag) => `Remove tag ${tag}`}
          tags={draft.tags}
          onChange={(tags) => update({ tags })}
          hint="Press Enter or a comma to add a tag."
        />
      </EditField>
      <EditField
        id="create-collections"
        label="Collections"
        optional
        hint="By collection ID (manual collections only)."
      >
        <CollectionIds
          ids={draft.collections}
          errors={errors}
          onChange={(collections) => update({ collections })}
        />
      </EditField>
      <EditField
        id="create-category"
        label="Category (Shopify taxonomy ID)"
        optional
        error={errors.categoryGid}
      >
        <input
          id="create-category"
          autoComplete="off"
          spellCheck={false}
          value={draft.categoryGid}
          placeholder="gid://shopify/TaxonomyCategory/…"
          aria-invalid={errors.categoryGid ? true : undefined}
          onChange={(event) => update({ categoryGid: event.target.value })}
          className={FIELD_INPUT}
        />
      </EditField>
      <CheckField
        label="This is a gift card"
        checked={draft.giftCard}
        onChange={(giftCard) => update({ giftCard })}
      />
    </CreateCard>
  )
}

/** Custom fields: a namespace, key, type and value each. */
export function CreateMetafieldsCard({ draft, errors, update }: CreateSectionProps) {
  const setField = (index: number, patch: Partial<MetafieldDraft>) =>
    update({
      metafields: draft.metafields.map((field, i) =>
        i === index ? { ...field, ...patch } : field,
      ),
    })

  return (
    <CreateCard
      title="Metafields"
      description="Extra information stored with the product (material, care, size guide…)."
    >
      {draft.metafields.map((field, index) => {
        const at = (name: string) => errors[`metafields.${index}.${name}`]
        return (
          <div
            key={field.key}
            className="border-border flex items-start gap-3 rounded-xl border p-3"
          >
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[520px]:grid-cols-2">
              <EditField
                id={`create-mf-ns-${field.key}`}
                label="Namespace"
                error={at('namespace')}
              >
                <input
                  id={`create-mf-ns-${field.key}`}
                  autoComplete="off"
                  value={field.namespace}
                  aria-invalid={at('namespace') ? true : undefined}
                  onChange={(event) => setField(index, { namespace: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
              <EditField
                id={`create-mf-key-${field.key}`}
                label="Key"
                error={at('metaKey')}
              >
                <input
                  id={`create-mf-key-${field.key}`}
                  autoComplete="off"
                  value={field.metaKey}
                  placeholder="material"
                  aria-invalid={at('metaKey') ? true : undefined}
                  onChange={(event) => setField(index, { metaKey: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
              <SelectField
                id={`create-mf-type-${field.key}`}
                label="Type"
                value={field.type}
                options={METAFIELD_TYPES.map((type) => ({ value: type, label: type }))}
                onChange={(type) => setField(index, { type })}
              />
              <EditField
                id={`create-mf-value-${field.key}`}
                label="Value"
                error={at('value')}
              >
                <input
                  id={`create-mf-value-${field.key}`}
                  autoComplete="off"
                  value={field.value}
                  aria-invalid={at('value') ? true : undefined}
                  onChange={(event) => setField(index, { value: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
            </div>
            <button
              type="button"
              aria-label={`Remove metafield ${index + 1}`}
              onClick={() =>
                update({ metafields: draft.metafields.filter((_, i) => i !== index) })
              }
              className={`${ICON_BUTTON} hover:text-danger mt-6`}
            >
              <TrashIcon width={16} height={16} />
            </button>
          </div>
        )
      })}
      {errors.metafields && (
        <p role="alert" className="text-danger text-[0.78rem]">
          {errors.metafields}
        </p>
      )}
      <button
        type="button"
        onClick={() => update({ metafields: [...draft.metafields, blankMetafield()] })}
        disabled={draft.metafields.length >= CREATE_LIMITS.metafields}
        className={`${TEXT_BUTTON} self-start disabled:pointer-events-none disabled:opacity-50`}
      >
        <PlusIcon width={14} height={14} />
        Add a metafield
      </button>
    </CreateCard>
  )
}
