import { PlusIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import {
  blankMetafield,
  CREATE_LIMITS,
  METAFIELD_TYPES,
  type MetafieldDraft,
} from '../../utils/createDraft.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { EditField, FIELD_INPUT, FIELD_TEXTAREA, ICON_BUTTON } from '../edit/fields.tsx'
import { CreateCard, type CreateSectionProps } from './CreateCard.tsx'

/** A small grey pill button in a heading's right corner ("Add a metafield"). */
const HEADING_BUTTON =
  'bg-surface text-text border-border hover:border-accent inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.8rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** Plain names for the metafield types; what is sent is still the API's own type. */
const METAFIELD_TYPE_LABELS: Record<string, string> = {
  single_line_text_field: 'Text (one line)',
  multi_line_text_field: 'Text (several lines)',
  number_integer: 'Whole number',
  number_decimal: 'Decimal number',
  boolean: 'Yes / No',
  url: 'Web link',
  json: 'JSON data',
  date: 'Date',
  date_time: 'Date and time',
  color: 'Colour',
  rich_text_field: 'Formatted text',
  'list.single_line_text_field': 'List of texts',
  'list.number_integer': 'List of whole numbers',
  'list.number_decimal': 'List of decimal numbers',
  'list.url': 'List of web links',
  'list.date': 'List of dates',
  'list.color': 'List of colours',
}

/** What to type as the value, for the kinds that need a specific format. */
function valueHint(type: string): string | undefined {
  if (type.startsWith('list.'))
    return 'A list: write the values in square brackets, e.g. ["Plastic", "Paper"].'
  if (type === 'boolean') return 'Type true or false.'
  if (type === 'date') return 'Use the format YYYY-MM-DD, e.g. 2026-12-31.'
  if (type === 'date_time')
    return 'Use the format YYYY-MM-DDTHH:MM:SS, e.g. 2026-12-31T09:30:00.'
  if (type === 'color') return 'A hex colour, e.g. #1a73e8.'
  if (type === 'url') return 'A full web address, e.g. https://example.com.'
  if (type === 'json') return 'Valid JSON, e.g. {"care": "Hand wash"}.'
  return undefined
}

/** **Search engine listing**: the SEO title and description, and the product's web address (handle). */
export function CreateSeoCard({ draft, errors, update }: CreateSectionProps) {
  return (
    <CreateCard title="Search engine listing" headingAbove>
      <p className="text-text-muted text-[0.82rem]">
        How the product appears in Google and other search results, and the end of its web
        address. Everything here is optional.
      </p>
      <EditField
        id="create-seo-title"
        label="SEO title"
        error={errors.seoTitle}
        hint="The headline shown in search results. Leave blank to use the product title."
        counter={{ value: draft.seoTitle.trim().length, max: LIMITS.seoTitle }}
      >
        <input
          id="create-seo-title"
          autoComplete="off"
          value={draft.seoTitle}
          aria-invalid={errors.seoTitle ? true : undefined}
          onChange={(event) => update({ seoTitle: event.target.value })}
          className={FIELD_INPUT}
        />
      </EditField>
      <EditField
        id="create-seo-description"
        label="SEO description"
        error={errors.seoDescription}
        hint="A short summary shown under the headline in search results. Leave blank to use the product description."
        counter={{
          value: draft.seoDescription.trim().length,
          max: LIMITS.seoDescription,
        }}
      >
        <textarea
          id="create-seo-description"
          rows={3}
          value={draft.seoDescription}
          aria-invalid={errors.seoDescription ? true : undefined}
          onChange={(event) => update({ seoDescription: event.target.value })}
          className={FIELD_TEXTAREA}
        />
      </EditField>
      <EditField
        id="create-handle"
        label="URL handle"
        error={errors.handle}
        hint="The last part of the product's web address, e.g. hippo-bag. Leave blank and the store makes one from the title."
      >
        <input
          id="create-handle"
          autoComplete="off"
          spellCheck={false}
          value={draft.handle}
          aria-invalid={errors.handle ? true : undefined}
          onChange={(event) => update({ handle: event.target.value })}
          className={FIELD_INPUT}
        />
      </EditField>
    </CreateCard>
  )
}

/** **Product metafields**: extra information stored with the product — a namespace, key, type and value each. */
export function CreateMetafieldsCard({ draft, errors, update }: CreateSectionProps) {
  const setField = (index: number, patch: Partial<MetafieldDraft>) =>
    update({
      metafields: draft.metafields.map((field, i) =>
        i === index ? { ...field, ...patch } : field,
      ),
    })

  return (
    <CreateCard
      title="Product metafields"
      headingAbove
      action={
        <button
          type="button"
          onClick={() => update({ metafields: [...draft.metafields, blankMetafield()] })}
          disabled={draft.metafields.length >= CREATE_LIMITS.metafields}
          className={HEADING_BUTTON}
        >
          <PlusIcon width={14} height={14} />
          Add a metafield
        </button>
      }
    >
      {draft.metafields.length === 0 && (
        <p className="text-text-muted text-[0.85rem]">
          Extra details saved with the product that the standard fields don't cover, such
          as material, care instructions or a size guide. Give each one a group name
          (namespace), a name (key), a type and a value.
        </p>
      )}
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
                hint="A group name for your metafields, e.g. custom."
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
                hint="The name of this detail, e.g. material."
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
                options={METAFIELD_TYPES.map((type) => ({
                  value: type,
                  label: METAFIELD_TYPE_LABELS[type] ?? type,
                }))}
                onChange={(type) => setField(index, { type })}
              />
              <EditField
                id={`create-mf-value-${field.key}`}
                label="Value"
                error={at('value')}
                hint={valueHint(field.type)}
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
    </CreateCard>
  )
}
