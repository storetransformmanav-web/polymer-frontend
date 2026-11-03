import { useMemo, useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { ConfirmCancelDialog } from '../../../../components/ui/ConfirmCancelDialog.tsx'
import { Dialog } from '../../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import { PlusIcon } from '../../../../components/ui/icons.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import {
  WEIGHT_UNITS,
  type ProductDetail,
  type WeightUnit,
} from '../../../../lib/api/endpoints.ts'
import { currencySymbol, formatPrice } from '../../../../lib/format.ts'
import { useSectionEdit, type SavedHandler } from '../../hooks/useSectionEdit.ts'
import { variantPreviewUrl, type VariantDraft } from '../../utils/editDraft.ts'
import { variantStock } from '../../utils/stock.ts'
import { ConfirmUpdateDialog } from '../ConfirmUpdateDialog.tsx'
import { ProductImage } from '../ProductImage.tsx'
import { DialogAccordion } from './DialogAccordion.tsx'
import { ImagePicker, NO_PICTURE } from './ImagePicker.tsx'
import { VariantShippingCard } from './VariantSections.tsx'
import { CheckField, EditField, FIELD_INPUT, MoneyInput } from './fields.tsx'

const UNIT_OPTIONS = WEIGHT_UNITS.map((unit) => ({
  value: unit,
  label: unit.charAt(0) + unit.slice(1).toLowerCase(),
}))

const BUTTON =
  'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** The boxes are one size down from the forms': this is a dense window. */
const DENSE =
  '[&_input:not([type=checkbox]):not([type=radio])]:h-8 [&_input]:text-[0.8rem] [&_label]:text-[0.72rem] [&_p]:text-[0.74rem]'

/** Which accordion section a problem belongs to, so a closed one opens when it has one. */
const inSection = (errors: Record<string, string>, index: number, pattern: RegExp) =>
  Object.keys(errors).some((key) => {
    const prefix = `variants.${index}.`
    return key.startsWith(prefix) && pattern.test(key.slice(prefix.length))
  })

/**
 * **Edit variant** — the chosen variant of the Variants tab in a window, laid out like the tab
 * itself: its picture and a live **Unit price** card on the left, and on the right accordion
 * sections of small labelled boxes — **Pricing** (price, compare-at price, cost per item, tax code,
 * Charge tax), **Inventory** (SKU, barcode, available, Continue selling when out of stock),
 * **Shipping** (weight and its unit, Physical product, and the shipping and customs details) and
 * **Picture**: one of the product's media to pick, or a new picture by web address (added to the
 * product's media in the same save). Nothing is sent until **Update variant**, which checks the
 * fields, asks "Are you sure?" and sends just this variant's changes (`variants: [{ id, … }]`);
 * Cancel, ✕ or Escape close it, asking first when something was changed.
 */
export function VariantEditDialog({
  product,
  variantId,
  onSaved,
  onClose,
  onNewVariant,
}: {
  product: ProductDetail
  variantId: string
  onSaved?: SavedHandler
  onClose: () => void
  /** Closes this window and opens the New variant window (offered while nothing is changed). */
  onNewVariant?: () => void
}) {
  const index = product.variants.findIndex((variant) => variant.id === variantId)
  // Only this variant's problems can block its save.
  const errorPrefixes = useMemo(() => [`variants.${index}`], [index])
  const edit = useSectionEdit(product, {
    errorPrefixes,
    onSaved: (result, saved, body) => {
      onSaved?.(result, saved, body)
      onClose()
    },
  })
  const [cancelling, setCancelling] = useState(false)
  // The edit starts as the window opens (once: after a save the window closes).
  const [begun, setBegun] = useState(false)
  if (!begun) {
    setBegun(true)
    edit.start()
  }

  const draft = edit.draft
  const variant = draft?.variants[index]
  const original = product.variants[index]
  if (index < 0 || !original || !draft || !variant) return null

  const update = (patch: Partial<VariantDraft>) =>
    edit.change({
      variants: draft.variants.map((candidate, i) =>
        i === index ? { ...candidate, ...patch } : candidate,
      ),
    })
  const at = (field: string) => edit.errors[`variants.${index}.${field}`]
  const title = original.title ?? 'Variant'
  const id = `edit-variant-${original.id}`
  const symbol = currencySymbol(product.currency ?? null)
  const preview = variantPreviewUrl(variant, draft.images, original.image_url)
  const stock = variantStock(original)
  // The stock is changed here for a variant kept at one location (several: the Inventory tab).
  const oneLocation = variant.tracked && variant.stock.length === 1
  const busy = edit.confirming || cancelling
  const picked = variant.removeImage
    ? NO_PICTURE
    : variant.imageUrl.trim()
      ? ''
      : variant.imageId

  function close() {
    if (edit.dirty) setCancelling(true)
    else {
      edit.discard()
      onClose()
    }
  }

  return (
    <>
      <Dialog
        title={`Edit variant – ${title}`}
        role="dialog"
        extraWide
        closeButton
        closeDisabled={edit.isSaving || busy}
        onClose={close}
        footer={
          <>
            {onNewVariant && (
              <button
                type="button"
                disabled={edit.isSaving || edit.dirty}
                title={edit.dirty ? 'Update or cancel your changes first' : undefined}
                onClick={() => {
                  edit.discard()
                  onClose()
                  onNewVariant()
                }}
                className={`${BUTTON} border-border bg-bg text-text hover:border-accent mr-auto`}
              >
                <PlusIcon width={14} height={14} />
                New variant
              </button>
            )}
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
              disabled={!edit.dirty || edit.isSaving}
              className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
            >
              {edit.isSaving ? 'Updating…' : 'Update variant'}
            </button>
          </>
        }
      >
        <div
          className={`text-text grid grid-cols-1 gap-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] ${DENSE}`}
        >
          <div className="flex flex-col gap-2">
            <div className="border-border-strong w-full overflow-hidden rounded-lg border p-1.5">
              <ProductImage src={preview} alt={`Picture of ${title}`} size="xl" />
            </div>
            <div className="border-border-strong bg-accent-tint/30 flex flex-col gap-0.5 rounded-lg border px-3 py-2">
              <p className="text-text-muted text-[0.62rem] font-bold tracking-wide uppercase">
                Unit price
              </p>
              <p className="text-[1.15rem] leading-tight font-bold">
                {variant.price.trim() && Number.isFinite(Number(variant.price))
                  ? formatPrice(variant.price, product.currency)
                  : '—'}
              </p>
              <p className="mt-0.5">
                {(stock ?? 0) <= 0 ? (
                  <Badge tone="danger">Out of stock</Badge>
                ) : (
                  <Badge tone="success">In stock</Badge>
                )}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <DialogAccordion
              title="Pricing"
              forceOpen={inSection(
                edit.errors,
                index,
                /^(price|compareAtPrice|cost|taxCode)/,
              )}
            >
              <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 min-[520px]:grid-cols-2">
                <EditField id={`${id}-price`} label="Price" error={at('price')}>
                  <MoneyInput
                    id={`${id}-price`}
                    symbol={symbol}
                    value={variant.price}
                    invalid={Boolean(at('price'))}
                    onChange={(price) => update({ price })}
                  />
                </EditField>
                <EditField
                  id={`${id}-compare`}
                  label="Compare-at price"
                  error={at('compareAtPrice')}
                >
                  <MoneyInput
                    id={`${id}-compare`}
                    symbol={symbol}
                    value={variant.compareAtPrice}
                    invalid={Boolean(at('compareAtPrice'))}
                    onChange={(compareAtPrice) => update({ compareAtPrice })}
                  />
                </EditField>
                <EditField id={`${id}-cost`} label="Cost per item" error={at('cost')}>
                  <MoneyInput
                    id={`${id}-cost`}
                    symbol={symbol}
                    value={variant.cost}
                    invalid={Boolean(at('cost'))}
                    onChange={(cost) => update({ cost })}
                  />
                </EditField>
                <EditField id={`${id}-taxcode`} label="Tax code" error={at('taxCode')}>
                  <input
                    id={`${id}-taxcode`}
                    autoComplete="off"
                    value={variant.taxCode}
                    placeholder="Leave blank to keep"
                    aria-invalid={at('taxCode') ? true : undefined}
                    onChange={(event) => update({ taxCode: event.target.value })}
                    className={FIELD_INPUT}
                  />
                </EditField>
              </div>
              <CheckField
                id={`${id}-taxable`}
                label="Charge tax"
                checked={variant.taxable}
                onChange={(taxable) => update({ taxable })}
              />
            </DialogAccordion>

            <DialogAccordion
              title="Inventory"
              forceOpen={inSection(edit.errors, index, /^(sku|barcode|stock)/)}
            >
              <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 min-[520px]:grid-cols-2">
                <EditField id={`${id}-sku`} label="SKU" error={at('sku')}>
                  <input
                    id={`${id}-sku`}
                    autoComplete="off"
                    value={variant.sku}
                    aria-invalid={at('sku') ? true : undefined}
                    onChange={(event) => update({ sku: event.target.value })}
                    className={FIELD_INPUT}
                  />
                </EditField>
                <EditField id={`${id}-barcode`} label="Barcode" error={at('barcode')}>
                  <input
                    id={`${id}-barcode`}
                    autoComplete="off"
                    value={variant.barcode}
                    aria-invalid={at('barcode') ? true : undefined}
                    onChange={(event) => update({ barcode: event.target.value })}
                    className={FIELD_INPUT}
                  />
                </EditField>
                <EditField
                  id={`${id}-available`}
                  label="Available"
                  error={edit.errors[`variants.${index}.stock.0.quantity`]}
                  hint={
                    oneLocation
                      ? undefined
                      : variant.tracked
                        ? 'Several locations: change them on the Inventory tab.'
                        : 'Stock is not tracked for this variant.'
                  }
                >
                  <input
                    id={`${id}-available`}
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={!oneLocation}
                    value={oneLocation ? variant.stock[0].available : ''}
                    placeholder={oneLocation ? undefined : '—'}
                    aria-invalid={
                      edit.errors[`variants.${index}.stock.0.quantity`] ? true : undefined
                    }
                    onChange={(event) =>
                      update({
                        stock: variant.stock.map((row, i) =>
                          i === 0 ? { ...row, available: event.target.value } : row,
                        ),
                      })
                    }
                    className={FIELD_INPUT}
                  />
                </EditField>
              </div>
              <CheckField
                id={`${id}-continue`}
                label="Continue selling when out of stock"
                checked={variant.inventoryPolicy === 'CONTINUE'}
                onChange={(keep) =>
                  update({ inventoryPolicy: keep ? 'CONTINUE' : 'DENY' })
                }
              />
            </DialogAccordion>

            <DialogAccordion
              title="Shipping"
              forceOpen={inSection(
                edit.errors,
                index,
                /^(weight|dimensions|countryCode|hsCode)/,
              )}
            >
              <CheckField
                id={`${id}-physical`}
                label="Physical product"
                checked={variant.requiresShipping}
                onChange={(requiresShipping) => update({ requiresShipping })}
              />
              <div className="grid max-w-sm grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-2">
                <EditField id={`${id}-weight`} label="Weight" error={at('weight')}>
                  <input
                    id={`${id}-weight`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={variant.weight}
                    placeholder="0"
                    aria-invalid={at('weight') ? true : undefined}
                    onChange={(event) => update({ weight: event.target.value })}
                    className={FIELD_INPUT}
                  />
                </EditField>
                <SelectField
                  id={`${id}-unit`}
                  label="Unit"
                  hideLabel
                  compact
                  value={variant.weightUnit}
                  options={UNIT_OPTIONS}
                  onChange={(unit) => update({ weightUnit: unit as WeightUnit })}
                />
              </div>
              {variant.requiresShipping && (
                <VariantShippingCard
                  product={product}
                  variant={variant}
                  index={index}
                  errors={edit.errors}
                  prefix={id}
                  update={update}
                />
              )}
            </DialogAccordion>

            <DialogAccordion
              title="Picture"
              defaultOpen={false}
              forceOpen={inSection(edit.errors, index, /^imageUrl/)}
            >
              <ImagePicker
                idPrefix={id}
                images={draft.images}
                selected={picked}
                canRemove={variant.hasImage}
                onMedia={(image) =>
                  update({ removeImage: false, imageId: image.id, imageUrl: '' })
                }
                onNone={() => update({ removeImage: true, imageId: '', imageUrl: '' })}
                url={variant.imageUrl}
                onUrl={(imageUrl) =>
                  // An address replaces whatever picture was chosen from the media.
                  update(
                    imageUrl.trim()
                      ? { imageUrl, imageId: '', removeImage: false }
                      : { imageUrl },
                  )
                }
                error={at('imageUrl')}
              />
            </DialogAccordion>

            {edit.error && <FormMessage tone="error">{edit.error}</FormMessage>}
            {!edit.error && edit.showErrors && edit.hasProblems && (
              <FormMessage tone="error">Fix the highlighted fields to save.</FormMessage>
            )}
          </div>
        </div>
      </Dialog>

      {edit.confirming && (
        <ConfirmUpdateDialog
          title={`Update “${product.title} – ${title}”?`}
          onConfirm={() => void edit.confirmSave()}
          onCancel={edit.cancelConfirm}
        />
      )}
      {cancelling && (
        <ConfirmCancelDialog
          lose="your changes to this variant"
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
