import { Badge } from '../../../../components/ui/Badge.tsx'
import { ListSelect } from '../../../../components/ui/ListSelect.tsx'
import { PlusIcon, TrashIcon, XIcon } from '../../../../components/ui/icons.tsx'
import { METAFIELD_TYPES } from '../../utils/createDraft.ts'
import {
  blankMetafieldEdit,
  LIMITS,
  type MetafieldEditDraft,
} from '../../utils/editDraft.ts'
import { metafieldName, metafieldTypeLabel } from '../../utils/metafields.ts'
import {
  EditField,
  FIELD_INPUT,
  ICON_BUTTON,
  TEXT_BUTTON,
  type SectionProps,
} from './fields.tsx'
import { MetafieldValueField } from './MetafieldValueField.tsx'

/**
 * The product's metafields, being edited: every existing detail (the product's and each
 * variant's) can have its value changed or be removed, and a new one can be added to the whole
 * product or to a variant. The description sections and the SEO title / description are not
 * here — they have their own editors. A kind (type) cannot be changed on an existing detail;
 * remove it and add it again to change that. Only what changed is sent.
 */
export function MetafieldsSection({ product, draft, errors, onChange }: SectionProps) {
  const variantName = (id: string | null) => {
    if (!id) return 'Whole product'
    const variant = product.variants.find((candidate) => candidate.id === id)
    return `Variant: ${variant?.title?.trim() || variant?.sku || 'Variant'}`
  }

  const update = (index: number, patch: Partial<MetafieldEditDraft>) =>
    onChange({
      metafields: draft.metafields.map((field, i) =>
        i === index ? { ...field, ...patch } : field,
      ),
    })

  const dropNew = (index: number) =>
    onChange({ metafields: draft.metafields.filter((_, i) => i !== index) })

  const appliesTo = [
    { value: '', label: 'Whole product' },
    ...product.variants.map((variant) => ({
      value: variant.id,
      label: variantName(variant.id),
    })),
  ]

  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-muted text-[0.82rem] leading-snug">
        Change a value, remove a detail, or add a new one. The description sections and
        the SEO title and description are edited in their own cards.
      </p>

      {errors.metafields && (
        <p role="alert" className="text-danger text-[0.82rem] font-medium">
          {errors.metafields}
        </p>
      )}

      <ul aria-label="Metafields" className="flex flex-col gap-2.5">
        {draft.metafields.map((field, index) => {
          const at = (name: string) => errors[`metafields.${index}.${name}`]
          const prefix = `metafield-${field.key}`
          const hasError = Object.keys(errors).some((key) =>
            key.startsWith(`metafields.${index}.`),
          )
          const label = field.isNew
            ? field.metaKey.trim()
              ? metafieldName(field.namespace, field.metaKey)
              : 'New detail'
            : metafieldName(field.namespace, field.metaKey)

          return (
            <li
              key={field.key}
              className={`rounded-xl border p-3.5 ${hasError ? 'border-danger' : 'border-border'} ${
                field.removed ? 'opacity-60' : ''
              }`}
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[0.9rem] font-semibold ${field.removed ? 'line-through' : ''}`}
                  >
                    {label}
                  </p>
                  <p className="text-text-muted truncate text-[0.74rem]">
                    {variantName(field.variantId)} · {metafieldTypeLabel(field.type)}
                    {!field.isNew && ` · ${field.namespace}.${field.metaKey}`}
                  </p>
                </div>
                {field.isNew ? (
                  <button
                    type="button"
                    aria-label={`Discard the new detail ${label}`}
                    onClick={() => dropNew(index)}
                    className={`${ICON_BUTTON} hover:text-danger`}
                  >
                    <XIcon width={16} height={16} />
                  </button>
                ) : field.removed ? (
                  <>
                    <Badge tone="danger">Will be deleted</Badge>
                    <button
                      type="button"
                      className={TEXT_BUTTON}
                      onClick={() => update(index, { removed: false })}
                    >
                      Undo
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() => update(index, { removed: true })}
                    className={`${ICON_BUTTON} hover:text-danger`}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                )}
              </div>

              {field.isNew && (
                <div className="mb-3 grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
                  <EditField id={`${prefix}-applies`} label="Applies to">
                    <ListSelect
                      id={`${prefix}-applies`}
                      label="Applies to"
                      large
                      value={field.variantId ?? ''}
                      options={appliesTo}
                      onChange={(value) => update(index, { variantId: value || null })}
                    />
                  </EditField>
                  <EditField id={`${prefix}-type`} label="Kind" error={at('type')}>
                    <ListSelect
                      id={`${prefix}-type`}
                      label="Kind"
                      large
                      invalid={Boolean(at('type'))}
                      value={field.type}
                      options={METAFIELD_TYPES.map((type) => ({
                        value: type,
                        label: metafieldTypeLabel(type),
                      }))}
                      // A value typed for the old type rarely fits the new one: start clean.
                      onChange={(type) => {
                        if (type !== field.type) update(index, { type, value: '' })
                      }}
                    />
                  </EditField>
                  <EditField
                    id={`${prefix}-namespace`}
                    label="Namespace"
                    error={at('namespace')}
                    hint="The group the detail belongs to, e.g. custom."
                    counter={{
                      value: field.namespace.trim().length,
                      max: LIMITS.metafieldNamespace,
                    }}
                  >
                    <input
                      id={`${prefix}-namespace`}
                      autoComplete="off"
                      value={field.namespace}
                      aria-invalid={at('namespace') ? true : undefined}
                      onChange={(event) =>
                        update(index, { namespace: event.target.value })
                      }
                      className={FIELD_INPUT}
                    />
                  </EditField>
                  <EditField
                    id={`${prefix}-key`}
                    label="Key"
                    error={at('metaKey')}
                    hint="The detail's name, e.g. unit_of_sale."
                    counter={{
                      value: field.metaKey.trim().length,
                      max: LIMITS.metafieldKey,
                    }}
                  >
                    <input
                      id={`${prefix}-key`}
                      autoComplete="off"
                      value={field.metaKey}
                      aria-invalid={at('metaKey') ? true : undefined}
                      onChange={(event) => update(index, { metaKey: event.target.value })}
                      className={FIELD_INPUT}
                    />
                  </EditField>
                </div>
              )}

              {!field.removed && (
                <MetafieldValueField
                  id={`${prefix}-value`}
                  type={field.type}
                  value={field.value}
                  error={at('value')}
                  maxLength={LIMITS.metafieldValue}
                  onChange={(value) => update(index, { value })}
                />
              )}
            </li>
          )
        })}
      </ul>

      <div>
        <button
          type="button"
          className={TEXT_BUTTON}
          onClick={() =>
            onChange({ metafields: [...draft.metafields, blankMetafieldEdit()] })
          }
        >
          <PlusIcon width={15} height={15} />
          Add a metafield
        </button>
      </div>
    </div>
  )
}
