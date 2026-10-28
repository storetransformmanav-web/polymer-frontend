import { useState } from 'react'
import { PlusCircleIcon } from '../../../../components/ui/icons.tsx'
import {
  blankOption,
  CREATE_LIMITS,
  type CreateOptionDraft,
  type CreateVariantDraft,
} from '../../utils/createDraft.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { TAG_CHIP, TagsInput } from '../edit/TagsSection.tsx'
import { EditField, FIELD_INPUT } from '../edit/fields.tsx'
import { CreateCard, type CreateSectionProps } from './CreateCard.tsx'
import { isSingleVariant } from './CreatePricingCards.tsx'

const CELL =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-9 w-full min-w-0 rounded-lg border px-2.5 text-[0.85rem] outline-none focus:outline-2 aria-[invalid=true]:border-danger'

const TH =
  'text-text border-border-strong bg-table-head border-b px-2.5 py-2 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase'

const variantName = (variant: CreateVariantDraft) => variant.optionValues.join(' / ')

/** The table's columns, by the draft field each edits, as named in a problem message. */
const CELL_LABELS: Record<string, string> = {
  price: 'Price',
  compareAtPrice: 'Compare-at price',
  cost: 'Cost',
  weight: 'Weight',
  sku: 'SKU',
  barcode: 'Barcode',
  stock: 'Stock',
  imageUrl: 'Image link',
}

/**
 * **Variants**, after the store admin's: each option (Size, Colour…) is a block with its name
 * and values and **Delete** / **Done** buttons (Done folds it into a one-line summary you can
 * click to open again), then "Add another option". Every combination of the option values
 * becomes a variant, listed in a table with its own price, compare-at price, cost, weight,
 * SKU, barcode, opening stock and picture. Without options there is one variant, edited in
 * the Price, Inventory and Shipping cards.
 */
export function CreateVariantsCard({ draft, errors, update }: CreateSectionProps) {
  // Options folded to their summary with "Done". A new option starts open.
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set())
  const single = isSingleVariant(draft.variants)
  const stockHere = draft.locationId !== ''
  // The table only shows a red border and a tooltip on a cell: say what is wrong in words too.
  const cellProblems = draft.variants.flatMap((variant, index) =>
    Object.entries(CELL_LABELS).flatMap(([field, label]) => {
      const message = errors[`variants.${index}.${field}`]
      return message
        ? [
            {
              key: `${variant.key}-${field}`,
              variant: variantName(variant),
              label,
              message,
            },
          ]
        : []
    }),
  )

  const setOption = (index: number, patch: Partial<CreateOptionDraft>) =>
    update({
      options: draft.options.map((option, i) =>
        i === index ? { ...option, ...patch } : option,
      ),
    })

  const setVariant = (index: number, patch: Partial<CreateVariantDraft>) =>
    update({
      variants: draft.variants.map((variant, i) =>
        i === index ? { ...variant, ...patch } : variant,
      ),
    })

  const fold = (key: string, on: boolean) =>
    setFolded((current) => {
      const next = new Set(current)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  return (
    <CreateCard
      title="Variants"
      description="Add options like size or colour. Every combination of values becomes a variant."
      flush
    >
      <div className="flex flex-col">
        {draft.options.map((option, index) => {
          const usable = option.name.trim() !== '' && option.values.length > 0
          const isFolded = folded.has(option.key) && usable
          return (
            <div key={option.key} className="border-border border-b p-4">
              {isFolded ? (
                <button
                  type="button"
                  aria-label={`Edit option ${option.name}`}
                  onClick={() => fold(option.key, false)}
                  className="flex w-full cursor-pointer flex-col items-start gap-2 border-none bg-transparent p-0 text-left"
                >
                  <span className="text-[0.88rem] font-semibold">{option.name}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {option.values.map((value) => (
                      <span key={value} className={TAG_CHIP}>
                        {value}
                      </span>
                    ))}
                  </span>
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <EditField
                    id={`create-option-name-${option.key}`}
                    label="Option name"
                    error={errors[`options.${index}.name`]}
                  >
                    <input
                      id={`create-option-name-${option.key}`}
                      autoComplete="off"
                      value={option.name}
                      maxLength={255}
                      placeholder="Size"
                      aria-invalid={errors[`options.${index}.name`] ? true : undefined}
                      onChange={(event) => setOption(index, { name: event.target.value })}
                      className={FIELD_INPUT}
                    />
                  </EditField>
                  <EditField
                    id={`create-option-values-${option.key}`}
                    label="Option values"
                    error={errors[`options.${index}.values`]}
                  >
                    <TagsInput
                      id={`create-option-values-${option.key}`}
                      ariaLabel={`Add values for option ${index + 1}`}
                      listLabel={`Values of option ${index + 1}`}
                      tags={option.values}
                      onChange={(values) => setOption(index, { values })}
                      placeholder="Small, Medium, Large"
                      hint="Type a value and press Enter or a comma. Each combination of values becomes one variant."
                    />
                  </EditField>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() =>
                        update({ options: draft.options.filter((_, i) => i !== index) })
                      }
                      className="bg-danger-bg text-danger hover:border-danger inline-flex h-8 cursor-pointer items-center rounded-full border border-transparent px-3.5 text-[0.8rem] font-semibold transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => fold(option.key, true)}
                      disabled={!usable}
                      className="bg-text text-bg inline-flex h-8 cursor-pointer items-center rounded-full border-none px-4 text-[0.8rem] font-semibold transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => update({ options: [...draft.options, blankOption()] })}
          disabled={draft.options.length >= CREATE_LIMITS.options}
          className="hover:bg-accent-tint/40 text-text flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-4 py-3 text-left text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          <PlusCircleIcon width={16} height={16} />
          {draft.options.length === 0
            ? 'Add options like size or colour'
            : 'Add another option'}
        </button>
      </div>

      {(errors.options || errors.variants) && (
        <div className="flex flex-col gap-1 px-4 pt-3">
          {errors.options && (
            <p role="alert" className="text-danger text-[0.78rem]">
              {errors.options}
            </p>
          )}
          {errors.variants && (
            <p role="alert" className="text-danger text-[0.82rem] font-medium">
              {errors.variants}
            </p>
          )}
        </div>
      )}

      {!single && (
        <div className="border-border flex flex-col gap-3 border-t p-4">
          <p className="text-text-muted text-[0.8rem]">
            {draft.variants.length} variants — one for every combination of the option
            values. Give each its own price.
          </p>
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[1080px] border-collapse text-[0.85rem]">
              <thead>
                <tr>
                  <th className={TH}>Variant</th>
                  <th className={`${TH} w-28`}>Price</th>
                  <th className={`${TH} w-28`}>Compare-at price</th>
                  <th className={`${TH} w-24`}>Cost</th>
                  <th className={`${TH} w-24`}>Weight</th>
                  <th className={`${TH} w-32`}>SKU</th>
                  <th className={`${TH} w-32`}>Barcode</th>
                  {stockHere && <th className={`${TH} w-24`}>Stock</th>}
                  <th className={`${TH} w-64`}>Image link</th>
                </tr>
              </thead>
              <tbody>
                {draft.variants.map((variant, index) => {
                  const name = variantName(variant)
                  const at = (field: string) => errors[`variants.${index}.${field}`]
                  const cell = (
                    field: keyof CreateVariantDraft & string,
                    label: string,
                    extra: Record<string, unknown> = {},
                  ) => (
                    <input
                      aria-label={`${label} for ${name}`}
                      autoComplete="off"
                      value={variant[field] as string}
                      aria-invalid={at(field) ? true : undefined}
                      title={at(field)}
                      onChange={(event) =>
                        setVariant(index, { [field]: event.target.value })
                      }
                      className={CELL}
                      {...extra}
                    />
                  )
                  return (
                    <tr
                      key={variant.key}
                      className="border-border border-b last:border-b-0"
                    >
                      <td className="px-2.5 py-2 font-medium whitespace-nowrap">
                        {name}
                      </td>
                      <td className="px-1.5 py-1.5">
                        {cell('price', 'Price', { inputMode: 'decimal' })}
                      </td>
                      <td className="px-1.5 py-1.5">
                        {cell('compareAtPrice', 'Compare-at price', {
                          inputMode: 'decimal',
                        })}
                      </td>
                      <td className="px-1.5 py-1.5">
                        {cell('cost', 'Cost', { inputMode: 'decimal' })}
                      </td>
                      <td className="px-1.5 py-1.5">
                        {cell('weight', 'Weight', { inputMode: 'decimal' })}
                      </td>
                      <td className="px-1.5 py-1.5">{cell('sku', 'SKU')}</td>
                      <td className="px-1.5 py-1.5">{cell('barcode', 'Barcode')}</td>
                      {stockHere && (
                        <td className="px-1.5 py-1.5">
                          {cell('stock', 'Stock', { inputMode: 'numeric' })}
                        </td>
                      )}
                      <td className="px-1.5 py-1.5">
                        {cell('imageUrl', 'Image link', {
                          type: 'url',
                          spellCheck: false,
                          placeholder: 'https://…',
                          maxLength: LIMITS.mediaUrl + 100,
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {cellProblems.length > 0 && (
            <ul role="alert" className="text-danger flex flex-col gap-0.5 text-[0.78rem]">
              {cellProblems.map((problem) => (
                <li key={problem.key}>
                  <strong>{problem.variant}</strong> · {problem.label}: {problem.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </CreateCard>
  )
}
