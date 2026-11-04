import { useMemo, useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { ConfirmCancelDialog } from '../../../../components/ui/ConfirmCancelDialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import { ArrowLeftIcon, BoxesIcon, PencilIcon } from '../../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../../components/ui/OpenTabsBar.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import {
  DIMENSION_UNITS,
  WEIGHT_UNITS,
  type DimensionUnit,
  type ProductDetail,
  type WeightUnit,
} from '../../../../lib/api/endpoints.ts'
import { currencySymbol, formatPrice } from '../../../../lib/format.ts'
import { useSectionEdit, type SavedHandler } from '../../hooks/useSectionEdit.ts'
import { variantPreviewUrl, type VariantDraft } from '../../utils/editDraft.ts'
import { countryOptions } from '../../../../lib/countries.ts'
import { variantStock } from '../../utils/stock.ts'
import { ConfirmUpdateDialog } from '../ConfirmUpdateDialog.tsx'
import { ProductImage } from '../ProductImage.tsx'
import { ImagePicker, NO_PICTURE } from './ImagePicker.tsx'
import { PageCard } from './PageCard.tsx'
import { CheckField, EditField, FIELD_INPUT, MoneyInput } from './fields.tsx'

const UNIT_OPTIONS = WEIGHT_UNITS.map((unit) => ({
  value: unit,
  label: unit.charAt(0) + unit.slice(1).toLowerCase(),
}))

const SIZE_UNIT_OPTIONS = DIMENSION_UNITS.map((unit) => ({
  value: unit,
  label: unit === 'CENTIMETERS' ? 'cm' : 'in',
}))
const COUNTRY_OPTIONS = countryOptions()

const BUTTON =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-5 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const GHOST = `${BUTTON} border-border bg-bg text-text hover:border-accent`
const SOLID = `${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`

const GRID = 'grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2'

/** Which section a problem belongs to, so the page can say where to look. */
const hasProblem = (errors: Record<string, string>, index: number, pattern: RegExp) =>
  Object.keys(errors).some((key) => {
    const prefix = `variants.${index}.`
    return key.startsWith(prefix) && pattern.test(key.slice(prefix.length))
  })

/**
 * **Edit Variant** — the chosen variant of the Variants tab as a page of its own, in place of the
 * tab (the way the demo's Edit Customer page is laid out): a strip with an "Editing <variant>" tab,
 * a header (title, one-line note and a **Back to <variant>** button), cards for the variant's
 * **Variant** summary, **Pricing**, **Inventory**, **Shipping** and **Picture**, and a foot with
 * **Cancel** and **Save Changes**. Nothing is sent until Save Changes, which checks the fields,
 * asks "Are you sure?" and sends just this variant's changes (`variants: [{ id, … }]`); Cancel,
 * Back, the tab's ✕ or Escape leave, asking first when something was changed.
 */
export function VariantEditPage({
  product,
  variantId,
  onSaved,
  onClose,
}: {
  product: ProductDetail
  variantId: string
  onSaved?: SavedHandler
  onClose: () => void
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
  // The edit starts as the page opens (once: after a save the page closes).
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
  const stockError = edit.errors[`variants.${index}.stock.0.quantity`]
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
      <div
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented && !busy) {
            event.stopPropagation()
            close()
          }
        }}
        className="flex flex-col gap-4"
      >
        <OpenTabsBar
          tabs={[
            {
              id: original.id,
              label: title,
              title: `Editing ${product.title} – ${title}`,
            },
          ]}
          activeId={original.id}
          navLabel="Editing a variant"
          listLabel="All variants"
          kind="Editing"
          historyLabel="Variant being edited"
          icon={PencilIcon}
          onShowList={close}
          onSelect={() => undefined}
          onClose={close}
          onClear={close}
        />

        <section
          aria-label={`Edit variant – ${title}`}
          className="border-border bg-bg flex flex-col rounded-2xl border"
        >
          <div className="border-border flex flex-wrap items-start justify-between gap-3 rounded-t-2xl border-b px-5 py-4">
            <div className="min-w-0">
              <h2 className="m-0 text-[1.1rem] font-bold">Edit Variant</h2>
              <p className="text-text-muted m-0 mt-1 text-[0.8rem]">
                {product.title} · {title} · changes are also saved to Shopify
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={edit.isSaving}
              className={SOLID}
            >
              <ArrowLeftIcon width={16} height={16} />
              Back to {title}
            </button>
          </div>

          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <PageCard title="Variant">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <div className="border-border-strong w-36 overflow-hidden rounded-lg border p-1.5">
                  <ProductImage src={preview} alt={`Picture of ${title}`} size="xl" />
                </div>
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-text m-0 text-[0.8rem] font-semibold">Options</p>
                    {original.selected_options && original.selected_options.length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {original.selected_options.map((chosen) => (
                          <span
                            key={chosen.name}
                            className="border-border-strong bg-surface rounded-full border px-2.5 py-0.5 text-[0.8rem]"
                          >
                            <span className="text-text-muted">{chosen.name}: </span>
                            {chosen.value}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-text-muted text-[0.85rem]">{title}</span>
                    )}
                    <p className="text-text-muted m-0 text-[0.74rem]">
                      Names and values of the options are changed with Edit options.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-text m-0 text-[0.8rem] font-semibold">
                      Unit price
                    </p>
                    <p className="m-0 flex flex-wrap items-center gap-2.5 text-[1.4rem] leading-tight font-bold">
                      {variant.price.trim() && Number.isFinite(Number(variant.price))
                        ? formatPrice(variant.price, product.currency)
                        : '—'}
                      {(stock ?? 0) <= 0 ? (
                        <Badge tone="danger">Out of stock</Badge>
                      ) : (
                        <Badge tone="success">In stock</Badge>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </PageCard>

            <PageCard
              title="Pricing"
              problem={hasProblem(
                edit.errors,
                index,
                /^(price|compareAtPrice|cost|taxCode)/,
              )}
            >
              <div className={GRID}>
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
            </PageCard>

            <PageCard
              title="Inventory"
              problem={hasProblem(edit.errors, index, /^(sku|barcode|stock)/)}
            >
              <div className={GRID}>
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
                  error={stockError}
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
                    aria-invalid={stockError ? true : undefined}
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
            </PageCard>

            <PageCard
              title="Shipping"
              problem={hasProblem(
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
              {variant.requiresShipping ? (
                <div className="flex flex-col gap-3">
                  {/* Weight: one box and its unit. */}
                  <div className="grid max-w-sm grid-cols-[minmax(0,1fr)_7rem] items-end gap-2">
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
                      label="Weight unit"
                      hideLabel
                      value={variant.weightUnit}
                      options={UNIT_OPTIONS}
                      onChange={(unit) => update({ weightUnit: unit as WeightUnit })}
                    />
                  </div>

                  {/* Packed size: three small boxes with their letters above, then the unit. */}
                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend className="text-text mb-1 p-0 text-[0.8rem] font-semibold">
                      Packed product size
                    </legend>
                    <div className="grid max-w-lg grid-cols-[repeat(3,minmax(0,1fr))_5.5rem] items-end gap-2">
                      {(
                        [
                          ['length', 'Length', 'L'],
                          ['width', 'Width', 'W'],
                          ['height', 'Height', 'H'],
                        ] as const
                      ).map(([field, name, letter]) => (
                        <label key={field} className="flex min-w-0 flex-col gap-1">
                          <span className="text-text-muted text-[0.72rem] font-semibold">
                            {letter}
                            <span className="sr-only">{name}</span>
                          </span>
                          <input
                            aria-label={name}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.0"
                            value={variant.shipping[field]}
                            aria-invalid={at('dimensions') ? true : undefined}
                            onChange={(event) =>
                              update({
                                shipping: {
                                  ...variant.shipping,
                                  [field]: event.target.value,
                                },
                              })
                            }
                            className={FIELD_INPUT}
                          />
                        </label>
                      ))}
                      <SelectField
                        id={`${id}-size-unit`}
                        label="Size unit"
                        hideLabel
                        value={variant.shipping.dimensionUnit}
                        options={SIZE_UNIT_OPTIONS}
                        onChange={(unit) =>
                          update({
                            shipping: {
                              ...variant.shipping,
                              dimensionUnit: unit as DimensionUnit,
                            },
                          })
                        }
                      />
                    </div>
                    {at('dimensions') && (
                      <p role="alert" className="text-danger m-0 mt-1 text-[0.8rem]">
                        {at('dimensions')}
                      </p>
                    )}
                  </fieldset>

                  {/* Customs: where it comes from and its HS code, side by side. */}
                  <div className={GRID}>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <SelectField
                        id={`${id}-country`}
                        label="Country of origin"
                        value={variant.shipping.countryCode}
                        options={COUNTRY_OPTIONS}
                        onChange={(countryCode) =>
                          update({ shipping: { ...variant.shipping, countryCode } })
                        }
                      />
                      {at('countryCode') && (
                        <p role="alert" className="text-danger m-0 text-[0.8rem]">
                          {at('countryCode')}
                        </p>
                      )}
                    </div>
                    <EditField id={`${id}-hs`} label="HS code" error={at('hsCode')}>
                      <input
                        id={`${id}-hs`}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="6–13 digits"
                        value={variant.shipping.hsCode}
                        aria-invalid={at('hsCode') ? true : undefined}
                        onChange={(event) =>
                          update({
                            shipping: { ...variant.shipping, hsCode: event.target.value },
                          })
                        }
                        className={FIELD_INPUT}
                      />
                    </EditField>
                  </div>
                </div>
              ) : (
                <p className="text-text-muted m-0 flex items-center gap-2 text-[0.85rem]">
                  <BoxesIcon width={16} height={16} />
                  This variant doesn&apos;t need shipping (for example a digital product
                  or a service).
                </p>
              )}
            </PageCard>

            <PageCard
              title="Picture"
              problem={hasProblem(edit.errors, index, /^imageUrl/)}
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
            </PageCard>

            {edit.error && <FormMessage tone="error">{edit.error}</FormMessage>}
            {!edit.error && edit.showErrors && edit.hasProblems && (
              <FormMessage tone="error">Fix the highlighted fields to save.</FormMessage>
            )}
          </div>

          <div className="border-border bg-bg sticky bottom-0 z-[2] flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t px-5 py-3">
            <button
              type="button"
              onClick={close}
              disabled={edit.isSaving}
              className={GHOST}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={edit.commit}
              disabled={!edit.dirty || edit.isSaving}
              className={SOLID}
            >
              {edit.isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </section>
      </div>

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
