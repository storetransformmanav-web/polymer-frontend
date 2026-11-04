import { useMemo, useState } from 'react'
import { ConfirmCancelDialog } from '../../../../components/ui/ConfirmCancelDialog.tsx'
import { Dialog } from '../../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import { PlusIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import { SuggestInput } from '../../../../components/ui/SuggestInput.tsx'
import {
  WEIGHT_UNITS,
  type ProductDetail,
  type WeightUnit,
} from '../../../../lib/api/endpoints.ts'
import { currencySymbol } from '../../../../lib/format.ts'
import { useProductStockLocations } from '../../hooks/useProductStockLocations.ts'
import { useSectionEdit, type SavedHandler } from '../../hooks/useSectionEdit.ts'
import {
  blankAddedOption,
  blankNewVariant,
  LIMITS,
  optionChoices,
  optionCount,
  type NewVariantDraft,
} from '../../utils/editDraft.ts'
import { ConfirmUpdateDialog } from '../ConfirmUpdateDialog.tsx'
import { DialogAccordion } from './DialogAccordion.tsx'
import { ImagePicker } from './ImagePicker.tsx'
import { StockFields } from './StockFields.tsx'
import { TagsInput } from './TagsSection.tsx'
import { EditField, FIELD_INPUT, MoneyInput } from './fields.tsx'

const UNIT_OPTIONS = WEIGHT_UNITS.map((unit) => ({
  value: unit,
  label: unit.charAt(0) + unit.slice(1).toLowerCase(),
}))

const BUTTON =
  'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** Small boxes: this is a dense window. */
const DENSE =
  '[&_input:not([type=checkbox]):not([type=radio])]:h-8 [&_input]:text-[0.8rem] [&_label]:text-[0.72rem] [&_p]:text-[0.74rem]'

/** Which accordion section a problem belongs to, so a closed one opens when it has one. */
const inSection = (errors: Record<string, string>, pattern: RegExp) =>
  Object.keys(errors).some((key) => pattern.test(key))

/**
 * **New variant** — adds one variant to the product in a window made of accordion sections.
 * **Options**: a dropdown per option (Size, Color…) to pick a value from — or to type a new one,
 * such as "Large" — and **Add an option** for a whole new option the product doesn't have yet
 * (Height, Width…): its name and its values, which then appear as one more dropdown. Then
 * **Pricing** (price, compare-at price, cost per item), **Inventory** (SKU, barcode, opening
 * stock), **Shipping** (weight and its unit) and **Picture** (a public address). **Add variant**
 * checks them (the save's own checks — a value for every option, a price, no repeat of an existing
 * combination), asks "Are you sure?" and sends the one new variant, with `options_add` when a new
 * option was made. Packed size, country of origin and HS code are set afterwards with **Edit
 * variant**.
 */
export function AddVariantDialog({
  product,
  start = [],
  onSaved,
  onClose,
}: {
  product: ProductDetail
  /** The values to begin with, one per option ('' = not chosen yet). */
  start?: string[]
  onSaved?: SavedHandler
  onClose: () => void
}) {
  const errorPrefixes = useMemo(() => ['newVariants', 'addedOptions', 'options'], [])
  const edit = useSectionEdit(product, {
    errorPrefixes,
    onSaved: (result, saved, body) => {
      onSaved?.(result, saved, body)
      onClose()
    },
  })
  const locations = useProductStockLocations(product)
  const [cancelling, setCancelling] = useState(false)
  // The edit starts as the window opens, with one blank new variant to fill in.
  const [begun, setBegun] = useState(false)
  if (!begun) {
    setBegun(true)
    edit.start()
  }
  const draft = edit.draft
  const [initial, setInitial] = useState<NewVariantDraft | null>(null)
  if (draft && initial === null) {
    const choices = optionChoices(draft)
    const unit = draft.variants[0]?.weightUnit ?? 'GRAMS'
    const blank = {
      ...blankNewVariant(unit),
      optionValues: choices.map((_, position) => start[position] ?? ''),
    }
    setInitial(blank)
    edit.change({ newVariants: [blank] })
  }

  const created = draft?.newVariants[0]
  if (!draft || !created || !initial) return null

  const current: NewVariantDraft = created
  const choices = optionChoices(draft)
  const patch = (change: Partial<NewVariantDraft>) =>
    edit.change({ newVariants: [{ ...current, ...change }] })
  const at = (field: string) => edit.errors[`newVariants.0.${field}`]
  const id = 'add-variant'
  const symbol = currencySymbol(product.currency ?? null)
  const canAddOption = optionCount(draft) < LIMITS.options
  // Nothing typed yet: closing needs no question.
  const typed =
    draft.addedOptions.length > 0 ||
    JSON.stringify({ ...created, key: '' }) !== JSON.stringify({ ...initial, key: '' })
  const busy = edit.confirming || cancelling

  function close() {
    if (typed) setCancelling(true)
    else {
      edit.discard()
      onClose()
    }
  }

  /** A whole new option (Height…): its own name and values, and a dropdown for this variant. */
  function addOption() {
    if (!draft) return
    edit.change({ addedOptions: [...draft.addedOptions, blankAddedOption()] })
  }
  function patchOption(index: number, change: { name?: string; values?: string[] }) {
    if (!draft) return
    edit.change({
      addedOptions: draft.addedOptions.map((option, i) =>
        i === index ? { ...option, ...change } : option,
      ),
    })
  }
  function removeOption(index: number) {
    if (!draft) return
    // The variant's value for it goes too (the options are in order: the product's, then the new).
    const position = draft.options.length + index
    const optionValues = current.optionValues.filter((_, i) => i !== position)
    edit.change({
      addedOptions: draft.addedOptions.filter((_, i) => i !== index),
      newVariants: [{ ...current, optionValues }],
    })
  }

  return (
    <>
      <Dialog
        title="New variant"
        role="dialog"
        extraWide
        closeButton
        closeDisabled={edit.isSaving || busy}
        onClose={close}
        footer={
          <>
            <button
              type="button"
              onClick={close}
              disabled={edit.isSaving}
              className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={edit.commit}
              disabled={edit.isSaving}
              className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
            >
              <PlusIcon width={14} height={14} />
              {edit.isSaving ? 'Adding…' : 'Add variant'}
            </button>
          </>
        }
      >
        <div className={`text-text flex flex-col gap-2 ${DENSE}`}>
          <DialogAccordion
            title="Options"
            forceOpen={inSection(
              edit.errors,
              /^(options|addedOptions|newVariants\.0\.(options|optionValues))/,
            )}
          >
            {at('options') && (
              <p role="alert" className="text-danger m-0 font-medium">
                {at('options')}
              </p>
            )}
            {choices.length === 0 && (
              <p className="text-text-muted m-0">
                This product has no option yet. Add one (for example Size) to give this
                variant a value for it.
              </p>
            )}
            {choices.length > 0 && (
              <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 min-[520px]:grid-cols-2">
                {choices.map((choice, position) => (
                  <EditField
                    key={`${choice.name}-${position}`}
                    id={`${id}-option-${position}`}
                    label={choice.name}
                    error={at(`optionValues.${position}`)}
                    hint="Pick one, or type a new value."
                  >
                    <SuggestInput
                      id={`${id}-option-${position}`}
                      asSelect
                      value={created.optionValues[position] ?? ''}
                      suggestions={choice.values}
                      maxLength={LIMITS.optionValue}
                      invalid={Boolean(at(`optionValues.${position}`))}
                      onChange={(value) => {
                        const optionValues = [...created.optionValues]
                        while (optionValues.length <= position) optionValues.push('')
                        optionValues[position] = value
                        patch({ optionValues })
                      }}
                      className={`${FIELD_INPUT} pr-9`}
                    />
                  </EditField>
                ))}
              </div>
            )}

            {draft.addedOptions.map((option, index) => (
              <div
                key={option.key}
                className="border-border bg-accent-tint/20 flex flex-col gap-2 rounded-lg border p-2.5"
              >
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <EditField
                      id={`${id}-new-option-${index}`}
                      label="New option name"
                      error={edit.errors[`addedOptions.${index}.name`]}
                    >
                      <input
                        id={`${id}-new-option-${index}`}
                        autoComplete="off"
                        value={option.name}
                        maxLength={LIMITS.optionName}
                        placeholder="e.g. Height"
                        aria-invalid={
                          edit.errors[`addedOptions.${index}.name`] ? true : undefined
                        }
                        onChange={(event) =>
                          patchOption(index, { name: event.target.value })
                        }
                        className={FIELD_INPUT}
                      />
                    </EditField>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove the new option ${option.name || index + 1}`}
                    onClick={() => removeOption(index)}
                    className="text-text-muted hover:text-danger inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
                  >
                    <TrashIcon width={15} height={15} />
                  </button>
                </div>
                <p className={`m-0 font-semibold`}>Its values</p>
                <TagsInput
                  id={`${id}-new-option-${index}-values`}
                  ariaLabel={`Values of ${option.name || 'the new option'}`}
                  listLabel="Values"
                  removeLabel={(value) => `Remove value ${value}`}
                  placeholder="Type a value and press Enter (e.g. 30 cm)"
                  tags={option.values}
                  onChange={(values) => patchOption(index, { values })}
                />
                {edit.errors[`addedOptions.${index}.values`] && (
                  <p role="alert" className="text-danger m-0">
                    {edit.errors[`addedOptions.${index}.values`]}
                  </p>
                )}
              </div>
            ))}
            {edit.errors.addedOptions && (
              <p role="alert" className="text-danger m-0 font-medium">
                {edit.errors.addedOptions}
              </p>
            )}
            <button
              type="button"
              disabled={!canAddOption}
              title={
                canAddOption
                  ? undefined
                  : `A product can have at most ${LIMITS.options} options.`
              }
              onClick={addOption}
              className="text-accent hover:text-accent-hover inline-flex cursor-pointer items-center gap-1.5 self-start border-none bg-transparent p-0 text-[0.8rem] font-semibold disabled:pointer-events-none disabled:opacity-50"
            >
              <PlusIcon width={13} height={13} />
              Add an option (for example Height)
            </button>
          </DialogAccordion>

          <DialogAccordion
            title="Pricing"
            forceOpen={inSection(
              edit.errors,
              /^newVariants\.0\.(price|compareAtPrice|cost)/,
            )}
          >
            <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 min-[520px]:grid-cols-3">
              <EditField id={`${id}-price`} label="Price" error={at('price')}>
                <MoneyInput
                  id={`${id}-price`}
                  symbol={symbol}
                  value={created.price}
                  invalid={Boolean(at('price'))}
                  onChange={(price) => patch({ price })}
                />
              </EditField>
              <EditField
                id={`${id}-compare`}
                label="Compare-at price"
                optional
                error={at('compareAtPrice')}
              >
                <MoneyInput
                  id={`${id}-compare`}
                  symbol={symbol}
                  value={created.compareAtPrice}
                  invalid={Boolean(at('compareAtPrice'))}
                  onChange={(compareAtPrice) => patch({ compareAtPrice })}
                />
              </EditField>
              <EditField
                id={`${id}-cost`}
                label="Cost per item"
                optional
                error={at('cost')}
              >
                <MoneyInput
                  id={`${id}-cost`}
                  symbol={symbol}
                  value={created.cost}
                  invalid={Boolean(at('cost'))}
                  onChange={(cost) => patch({ cost })}
                />
              </EditField>
            </div>
          </DialogAccordion>

          <DialogAccordion
            title="Inventory"
            forceOpen={inSection(edit.errors, /^newVariants\.0\.(sku|barcode|stock)/)}
          >
            <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 min-[520px]:grid-cols-2">
              <EditField id={`${id}-sku`} label="SKU" optional error={at('sku')}>
                <input
                  id={`${id}-sku`}
                  autoComplete="off"
                  value={created.sku}
                  aria-invalid={at('sku') ? true : undefined}
                  onChange={(event) => patch({ sku: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
              <EditField
                id={`${id}-barcode`}
                label="Barcode"
                optional
                error={at('barcode')}
              >
                <input
                  id={`${id}-barcode`}
                  autoComplete="off"
                  value={created.barcode}
                  aria-invalid={at('barcode') ? true : undefined}
                  onChange={(event) => patch({ barcode: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
            </div>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="text-text mb-1.5 p-0 text-[0.76rem] font-semibold">
                Opening stock{' '}
                <span className="text-text-muted font-normal">(optional)</span>
              </legend>
              <StockFields
                rows={created.stock}
                onChange={(stock) => patch({ stock })}
                locations={locations}
                errors={edit.errors}
                prefix="newVariants.0.stock"
                label="Stock of the new variant"
              />
            </fieldset>
          </DialogAccordion>

          <DialogAccordion
            title="Shipping"
            forceOpen={inSection(edit.errors, /^newVariants\.0\.weight/)}
          >
            <div className="grid max-w-sm grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-2">
              <EditField id={`${id}-weight`} label="Weight" optional error={at('weight')}>
                <input
                  id={`${id}-weight`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={created.weight}
                  placeholder="0"
                  aria-invalid={at('weight') ? true : undefined}
                  onChange={(event) => patch({ weight: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
              <SelectField
                id={`${id}-unit`}
                label="Unit"
                hideLabel
                compact
                value={created.weightUnit}
                options={UNIT_OPTIONS}
                onChange={(unit) => patch({ weightUnit: unit as WeightUnit })}
              />
            </div>
            <p className="text-text-muted m-0">
              Packed size, country of origin and HS code are set afterwards with Edit
              variant.
            </p>
          </DialogAccordion>

          <DialogAccordion
            title="Picture"
            defaultOpen={false}
            forceOpen={inSection(edit.errors, /^newVariants\.0\.imageUrl/)}
          >
            <ImagePicker
              idPrefix={id}
              images={product.images}
              selected={
                product.images.find(
                  (image) =>
                    created.imageUrl.trim() !== '' && image.url === created.imageUrl,
                )?.id ?? ''
              }
              onMedia={(image) => patch({ imageUrl: image.url })}
              url={created.imageUrl}
              onUrl={(imageUrl) => patch({ imageUrl })}
              error={at('imageUrl')}
              hint="A public https:// link. It is added to the product's pictures."
            />
          </DialogAccordion>

          {edit.error && <FormMessage tone="error">{edit.error}</FormMessage>}
          {!edit.error && edit.showErrors && edit.hasProblems && (
            <FormMessage tone="error">Fix the highlighted fields to add it.</FormMessage>
          )}
        </div>
      </Dialog>

      {edit.confirming && (
        <ConfirmUpdateDialog
          title={`Add a variant to “${product.title}”?`}
          onConfirm={() => void edit.confirmSave()}
          onCancel={edit.cancelConfirm}
        />
      )}
      {cancelling && (
        <ConfirmCancelDialog
          lose="this new variant"
          onConfirm={() => {
            setCancelling(false)
            edit.discard()
            onClose()
          }}
          onKeep={() => setCancelling(false)}
        />
      )}
    </>
  )
}
