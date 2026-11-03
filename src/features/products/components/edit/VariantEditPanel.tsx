import { useMemo, useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { ConfirmCancelDialog } from '../../../../components/ui/ConfirmCancelDialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import { XIcon } from '../../../../components/ui/icons.tsx'
import type { ProductDetail } from '../../../../lib/api/endpoints.ts'
import { useProductStockLocations } from '../../hooks/useProductStockLocations.ts'
import { useSectionEdit, type SavedHandler } from '../../hooks/useSectionEdit.ts'
import { variantPreviewUrl, type VariantDraft } from '../../utils/editDraft.ts'
import { variantStock } from '../../utils/stock.ts'
import { ConfirmUpdateDialog } from '../ConfirmUpdateDialog.tsx'
import { ProductImage } from '../ProductImage.tsx'
import {
  VariantImageCard,
  VariantInventoryCard,
  VariantPriceCard,
  VariantShippingCard,
} from './VariantSections.tsx'

/** The Image dropdown's choice for "take the picture off this variant". */
const NO_IMAGE = 'none'

const TABS = ['General', 'Inventory', 'Shipping', 'Image'] as const
type Tab = (typeof TABS)[number]

const BUTTON =
  'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/**
 * **Edit variant** — one variant only, in a panel beside the Variants table (opened by a row's
 * Edit button): its picture, name, SKU and stock on top, then tabs — **General** (price,
 * compare-at, cost, tax), **Inventory** (tracked, the quantity at each location, SKU, barcode,
 * continue selling), **Shipping** and **Image** — the same cards as the whole-tab editor. Only
 * this variant's changes are sent (`variants: [{ id, … }]`), after "Are you sure?";
 * **Update variant** saves, **Cancel** (or ✕, or Escape) closes, asking first when something
 * was changed.
 */
export function VariantEditPanel({
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
  const locations = useProductStockLocations(product)
  const [tab, setTab] = useState<Tab>('General')
  const [cancelling, setCancelling] = useState(false)
  // The edit starts as the panel opens (once: after a save the panel closes).
  const [begun, setBegun] = useState(false)
  if (!begun) {
    setBegun(true)
    edit.start()
  }

  const draft = edit.draft
  const variant = draft?.variants[index]
  const original = product.variants[index]
  if (index < 0 || !original) return null

  const update = (patch: Partial<VariantDraft>) => {
    if (!draft) return
    edit.change({
      variants: draft.variants.map((candidate, i) =>
        i === index ? { ...candidate, ...patch } : candidate,
      ),
    })
  }
  // A problem in a tab that isn't shown is pointed at, so it is never hidden.
  const problems = Object.keys(edit.errors)
  const tabHasProblem = (name: Tab) =>
    problems.some((key) => {
      const field = key.split('.').slice(2).join('.')
      if (name === 'Inventory') return /^(stock|sku|barcode)/.test(field)
      if (name === 'Shipping')
        return /^(weight|dimensions|countryCode|hsCode)/.test(field)
      if (name === 'Image') return field.startsWith('imageUrl')
      return /^(price|compareAtPrice|cost|taxCode)/.test(field)
    })

  function close() {
    if (edit.dirty) setCancelling(true)
    else {
      edit.discard()
      onClose()
    }
  }

  const stock = variantStock(original)
  const title = original.title ?? 'Variant'
  const prefix = `panel-variant-${original.id}`
  const preview = variant
    ? variantPreviewUrl(variant, draft?.images ?? [], original.image_url)
    : (original.image_url ?? null)

  return (
    <aside
      aria-label={`Edit variant ${title}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !edit.confirming && !cancelling) {
          event.stopPropagation()
          close()
        }
      }}
      className="border-border-strong bg-bg flex min-w-0 flex-col self-start border"
    >
      <div className="border-border-strong bg-table-head flex items-center gap-2 border-b px-4 py-3">
        <h3 className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">
          Edit variant – {title}
        </h3>
        <button
          type="button"
          aria-label="Close the variant editor"
          onClick={close}
          className="text-text-muted hover:text-text inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent"
        >
          <XIcon width={16} height={16} />
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="border-border h-14 w-14 shrink-0 overflow-hidden border">
          <ProductImage src={preview} alt="" size="thumb" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{title}</span>
            {(stock ?? 0) <= 0 ? (
              <Badge tone="danger">Out of stock</Badge>
            ) : (
              <Badge tone="success">In stock</Badge>
            )}
          </span>
          <span className="text-text-muted text-[0.78rem]">
            SKU: {original.sku || '—'} · Inventory: {(stock ?? 0).toLocaleString('en-GB')}
          </span>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Variant details"
        className="border-border mx-4 mt-3 flex gap-1 overflow-x-auto border-b"
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`-mb-px shrink-0 cursor-pointer border-x-0 border-t-0 border-b-2 bg-transparent px-3 py-2 text-[0.82rem] font-semibold transition-colors ${
              tab === name
                ? 'border-accent text-text'
                : 'text-text-muted hover:text-text border-transparent'
            }`}
          >
            {name}
            {tabHasProblem(name) && (
              <span className="text-danger ml-1" aria-label="has a problem">
                •
              </span>
            )}
          </button>
        ))}
      </div>

      {draft && variant && (
        <div
          role="tabpanel"
          aria-label={tab}
          className="flex flex-col gap-4 p-4 [&_input]:text-[0.82rem] [&_label]:text-[0.75rem]"
        >
          {tab === 'General' && (
            <VariantPriceCard
              product={product}
              variant={variant}
              index={index}
              errors={edit.errors}
              prefix={prefix}
              update={update}
            />
          )}
          {tab === 'Inventory' && (
            <VariantInventoryCard
              product={product}
              variant={variant}
              index={index}
              errors={edit.errors}
              prefix={prefix}
              update={update}
              locations={locations}
            />
          )}
          {tab === 'Shipping' && (
            <VariantShippingCard
              product={product}
              variant={variant}
              index={index}
              errors={edit.errors}
              prefix={prefix}
              update={update}
            />
          )}
          {tab === 'Image' && (
            <VariantImageCard
              previewSrc={preview}
              variant={variant}
              index={index}
              errors={edit.errors}
              prefix={prefix}
              options={[
                { value: '', label: 'Keep the current image' },
                ...draft.images.map((image, position) => ({
                  value: image.id,
                  label: `Image ${position + 1}${image.alt ? ` — ${image.alt}` : ''}`,
                })),
                ...(variant.hasImage ? [{ value: NO_IMAGE, label: 'No image' }] : []),
              ]}
              value={variant.removeImage ? NO_IMAGE : variant.imageId}
              onChange={(choice) =>
                update(
                  choice === NO_IMAGE
                    ? { removeImage: true, imageId: '', imageUrl: '' }
                    : { removeImage: false, imageId: choice, imageUrl: '' },
                )
              }
              onAddress={(imageUrl) =>
                update(
                  imageUrl.trim()
                    ? { imageUrl, imageId: '', removeImage: false }
                    : { imageUrl },
                )
              }
            />
          )}

          {edit.error && <FormMessage tone="error">{edit.error}</FormMessage>}
          {!edit.error && edit.showErrors && edit.hasProblems && (
            <FormMessage tone="error">Fix the highlighted fields to save.</FormMessage>
          )}
        </div>
      )}

      <div className="border-border mt-auto flex justify-end gap-2 border-t px-4 py-3">
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
    </aside>
  )
}
