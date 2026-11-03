import { useMemo, useState } from 'react'
import { ConfirmCancelDialog } from '../../../../components/ui/ConfirmCancelDialog.tsx'
import { Dialog } from '../../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import { PlusIcon } from '../../../../components/ui/icons.tsx'
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
  blankNewVariant,
  LIMITS,
  optionChoices,
  type NewVariantDraft,
} from '../../utils/editDraft.ts'
import { ConfirmUpdateDialog } from '../ConfirmUpdateDialog.tsx'
import { StockFields } from './StockFields.tsx'
import { EditField, FIELD_INPUT, MoneyInput } from './fields.tsx'

const UNIT_OPTIONS = WEIGHT_UNITS.map((unit) => ({
  value: unit,
  label: unit.charAt(0) + unit.slice(1).toLowerCase(),
}))

const BUTTON =
  'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** The same small boxes as the Edit variant window. */
const DENSE =
  '[&_input:not([type=checkbox]):not([type=radio])]:h-8 [&_input]:text-[0.8rem] [&_label]:text-[0.72rem] [&_p]:text-[0.74rem]'

/**
 * **New variant** — adds one variant to the product in a window, like the Edit variant window: a
 * dropdown per option (Size, Color…) whose values can also be typed — a new value such as "Large"
 * makes a new variant of it — then Price, Compare-at price, Cost per item, SKU, Barcode, Weight
 * with its unit, the opening stock at a location and a picture address, in small boxes in a
 * two-column grid. **Add variant** checks them (the save's own checks: a value for every option, a
 * price, no repeat of an existing combination), asks "Are you sure?" and sends just this one new
 * variant — `variants: [{ option_values, price, … }]`; it appears in the tab when the store has
 * it. Packed size, country of origin and HS code are set afterwards with **Edit variant**.
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
  const errorPrefixes = useMemo(() => ['newVariants'], [])
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

  const choices = optionChoices(draft)
  const patch = (change: Partial<NewVariantDraft>) =>
    edit.change({ newVariants: [{ ...created, ...change }] })
  const at = (field: string) => edit.errors[`newVariants.0.${field}`]
  const id = 'add-variant'
  const symbol = currencySymbol(product.currency ?? null)
  // Nothing typed yet: closing needs no question.
  const typed =
    JSON.stringify({ ...created, key: '' }) !== JSON.stringify({ ...initial, key: '' })
  const busy = edit.confirming || cancelling

  function close() {
    if (typed) setCancelling(true)
    else {
      edit.discard()
      onClose()
    }
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
              disabled={choices.length === 0 || edit.isSaving}
              className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
            >
              <PlusIcon width={14} height={14} />
              {edit.isSaving ? 'Adding…' : 'Add variant'}
            </button>
          </>
        }
      >
        {choices.length === 0 ? (
          <p role="alert" className="text-danger m-0 text-[0.85rem]">
            This product has no option yet (for example Size). Add one with Edit variants,
            then add its variants here.
          </p>
        ) : (
          <div className={`text-text flex flex-col gap-2.5 ${DENSE}`}>
            {at('options') && (
              <p role="alert" className="text-danger m-0 font-medium">
                {at('options')}
              </p>
            )}
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
              <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-2">
                <EditField
                  id={`${id}-weight`}
                  label="Weight"
                  optional
                  error={at('weight')}
                >
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
              <EditField
                id={`${id}-image`}
                label="Picture address"
                optional
                error={at('imageUrl')}
              >
                <input
                  id={`${id}-image`}
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={created.imageUrl}
                  placeholder="https://…"
                  aria-invalid={at('imageUrl') ? true : undefined}
                  onChange={(event) => patch({ imageUrl: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
            </div>

            <fieldset className="border-border m-0 min-w-0 border-0 border-t p-0 pt-2.5">
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

            <p className="text-text-muted m-0">
              Packed size, country of origin and HS code are set afterwards with Edit
              variant.
            </p>
            {edit.error && <FormMessage tone="error">{edit.error}</FormMessage>}
            {!edit.error && edit.showErrors && edit.hasProblems && (
              <FormMessage tone="error">
                Fix the highlighted fields to add it.
              </FormMessage>
            )}
          </div>
        )}
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
