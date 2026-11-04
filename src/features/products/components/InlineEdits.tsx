import { useEffect, useRef, useState } from 'react'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import { DoubleClickEdit } from '../../../components/ui/DoubleClickEdit.tsx'
import { PencilIcon, XIcon } from '../../../components/ui/icons.tsx'
import type {
  ProductDetail,
  ProductUpdateBody,
  ProductVariant,
} from '../../../lib/api/endpoints.ts'
import {
  useProductStockLocations,
  type StockLocationChoice,
} from '../hooks/useProductStockLocations.ts'
import { useSaveProduct } from '../hooks/useSaveProduct.ts'
import type { SavedHandler } from '../hooks/useSectionEdit.ts'
import { formatPrice } from '../../../lib/format.ts'
import { LIMITS } from '../utils/editDraft.ts'
import type { AltTextEditor } from '../utils/slides.ts'
import { ConfirmUpdateDialog } from './ConfirmUpdateDialog.tsx'
import { CheckField } from './edit/fields.tsx'

const WHOLE_UNITS = /^\d+$/
const DECIMAL_PRICE = /^\d+(\.\d+)?$/

type StockLevel = ProductVariant['inventory_levels'][number]

/**
 * The **Available** figure of one variant at one location, changed where it is shown: double-click
 * it, type the new number, press Enter. A saved change also goes to the store, so it asks "Are you
 * sure?" first; then it sends just that stock — `variants: [{ id, stock: [{ location_id,
 * available }] }]` — and the new figure shows at once (the slice patches every cached copy when
 * the server confirms). Escape, or leaving the box unchanged, sends nothing.
 */
export function StockCell({
  product,
  variant,
  level,
  onSaved,
  zeroLabel,
  icon = true,
  align = 'right',
}: {
  product: ProductDetail
  variant: ProductVariant
  level: StockLevel
  onSaved?: SavedHandler
  /** Right in a table's number column; left among the Variants tab's labelled fields. */
  align?: 'left' | 'right'
  /** What to show instead of a 0 (the Variants tab says "Out of stock"); the box still holds 0. */
  zeroLabel?: string
  /** The small pencil beside the figure (the Variants table has none: a double-click is enough). */
  icon?: boolean
}) {
  const { save, error, clearError } = useSaveProduct()
  // The new number waiting for "Yes, update", and the one being sent.
  const [asking, setAsking] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const saved =
    level.available === null || level.available === undefined
      ? ''
      : String(level.available)
  const place = level.location_name ?? `location ${level.location_shopify_id}`
  const shown = sending ?? saved

  async function confirm() {
    const next = asking
    if (next === null) return
    setAsking(null)
    setSending(next)
    setFailed(false)
    clearError()
    const body: ProductUpdateBody = {
      variants: [
        {
          id: variant.id,
          stock: [{ location_id: level.location_shopify_id, available: Number(next) }],
        },
      ],
    }
    const result = await save({ id: product.id, body, shop: product.shop?.key })
    setSending(null)
    if (result) onSaved?.(result, product, body)
    else setFailed(true)
  }

  return (
    <>
      <DoubleClickEdit
        value={saved}
        label={`Available of ${variant.title ?? 'variant'} at ${place}`}
        inputMode="numeric"
        align={align}
        showIcon={icon}
        busy={sending !== null}
        validate={(next) =>
          WHOLE_UNITS.test(next) ? null : 'Enter a whole number, 0 or more'
        }
        onCommit={setAsking}
        display={
          <span
            className={
              zeroLabel && shown !== '' && Number(shown) <= 0
                ? 'text-danger font-semibold'
                : 'font-semibold'
            }
          >
            {shown === ''
              ? '—'
              : zeroLabel && Number(shown) <= 0
                ? zeroLabel
                : Number(shown).toLocaleString('en-GB')}
          </span>
        }
      />
      {failed && error && (
        <span role="alert" className="text-danger block text-[0.72rem] font-normal">
          {error}
        </span>
      )}
      {asking !== null && (
        <ConfirmUpdateDialog
          title={`Update “${product.title}”?`}
          change={{
            label: `Available of ${variant.title ?? 'variant'} at ${place}`,
            from: saved === '' ? '—' : Number(saved).toLocaleString('en-GB'),
            to: Number(asking).toLocaleString('en-GB'),
          }}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        />
      )}
    </>
  )
}

/**
 * The **price** of one variant, changed where it is shown: double-click it, type the new price,
 * press Enter. It asks "Are you sure?" first, saying the price now and the price it becomes; then
 * it sends just that variant's price — `variants: [{ id, price }]` — and the new price shows at
 * once. Escape, or a price that is the same number, sends nothing.
 */
export function PriceCell({
  product,
  variant,
  currency,
  onSaved,
}: {
  product: ProductDetail
  variant: ProductVariant
  currency?: string | null
  onSaved?: SavedHandler
}) {
  const { save, error, clearError } = useSaveProduct()
  const [asking, setAsking] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const saved = variant.price
  const name = variant.title ?? 'variant'

  async function confirm() {
    const next = asking
    if (next === null) return
    setAsking(null)
    setSending(next)
    setFailed(false)
    clearError()
    const body: ProductUpdateBody = { variants: [{ id: variant.id, price: next }] }
    const result = await save({ id: product.id, body, shop: product.shop?.key })
    setSending(null)
    if (result) onSaved?.(result, product, body)
    else setFailed(true)
  }

  return (
    <>
      <DoubleClickEdit
        value={saved}
        label={`Price of ${name}`}
        inputMode="decimal"
        showIcon
        busy={sending !== null}
        validate={(next) =>
          DECIMAL_PRICE.test(next) ? null : 'Enter a price, such as 9.99'
        }
        // "50" and "50.00" are the same price: nothing to ask about.
        onCommit={(next) => {
          if (Number(next) !== Number(saved)) setAsking(next)
        }}
        display={
          <span className="font-semibold">{formatPrice(sending ?? saved, currency)}</span>
        }
      />
      {failed && error && (
        <span role="alert" className="text-danger block text-[0.72rem] font-normal">
          {error}
        </span>
      )}
      {asking !== null && (
        <ConfirmUpdateDialog
          title={`Update “${product.title}”?`}
          change={{
            label: `Price of ${name}`,
            from: formatPrice(saved, currency),
            to: formatPrice(asking, currency),
          }}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        />
      )}
    </>
  )
}

/** The variant values the Variants table changes with a double-click. */
export type VariantField = 'sku' | 'barcode' | 'price' | 'compare_at_price' | 'cost'

const MONEY_FIELDS: VariantField[] = ['price', 'compare_at_price', 'cost']
const FIELD_NAMES: Record<VariantField, string> = {
  sku: 'SKU',
  barcode: 'Barcode',
  price: 'Price',
  compare_at_price: 'Compare-at price',
  cost: 'Cost per item',
}

/**
 * One value of a variant in the Variants table — SKU, barcode, price, compare-at price or cost —
 * changed where it is shown: double-click it (or press Enter on it), type, Enter. It asks "Are you
 * sure?" first, saying the value now and the one it becomes, then sends just that field —
 * `variants: [{ id, <field> }]` — and the new value shows at once. A pencil is drawn only with `icon`. A blank
 * compare-at price or cost clears it (`null`); a price can't be blank. Escape, or the same value,
 * sends nothing.
 */
export function VariantFieldCell({
  product,
  variant,
  field,
  onSaved,
  align = 'left',
  strike = false,
  icon = false,
}: {
  product: ProductDetail
  variant: ProductVariant
  field: VariantField
  onSaved?: SavedHandler
  align?: 'left' | 'right'
  /** Drawn struck through, as a compare-at price is. */
  strike?: boolean
  /** A small pencil beside the value (the details view); the table drew none. */
  icon?: boolean
}) {
  const { save, error, clearError } = useSaveProduct()
  const [asking, setAsking] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const money = MONEY_FIELDS.includes(field)
  const currency = variant.currency ?? product.currency
  const saved = (variant[field] ?? '').toString()
  const title = variant.title ?? 'variant'
  const what = `${FIELD_NAMES[field]} of ${title}`
  const shown = sending ?? saved
  const show = (value: string) =>
    value === '' ? '—' : money ? formatPrice(value, currency) : value

  async function confirm() {
    const next = asking
    if (next === null) return
    setAsking(null)
    setSending(next)
    setFailed(false)
    clearError()
    const value = next === '' && field !== 'sku' && field !== 'barcode' ? null : next
    const body = {
      variants: [{ id: variant.id, [field]: value }],
    } as ProductUpdateBody
    const result = await save({ id: product.id, body, shop: product.shop?.key })
    setSending(null)
    if (result) onSaved?.(result, product, body)
    else setFailed(true)
  }

  return (
    <>
      <DoubleClickEdit
        value={saved}
        label={what}
        inputMode={money ? 'decimal' : 'text'}
        align={align}
        showIcon={icon}
        maxLength={
          field === 'sku' ? LIMITS.sku : field === 'barcode' ? LIMITS.barcode : 20
        }
        busy={sending !== null}
        validate={(next) => {
          if (!money) return null
          if (next === '') return field === 'price' ? 'Enter a price' : null
          if (DECIMAL_PRICE.test(next)) return null
          return field === 'price'
            ? 'Enter a price, such as 9.99'
            : 'Enter a number, such as 9.99'
        }}
        // "50" and "50.00" are the same amount: nothing to ask about.
        onCommit={(next) => {
          if (money && next !== '' && saved !== '' && Number(next) === Number(saved))
            return
          setAsking(next)
        }}
        display={
          <span
            className={`${shown === '' ? 'text-text-muted' : ''} ${
              strike && shown !== '' ? 'text-text-muted line-through' : ''
            } ${field === 'price' ? 'font-semibold' : ''} ${field === 'sku' ? 'font-mono text-[0.8rem]' : ''}`}
          >
            {show(shown)}
          </span>
        }
      />
      {failed && error && (
        <span role="alert" className="text-danger block text-[0.72rem] font-normal">
          {error}
        </span>
      )}
      {asking !== null && (
        <ConfirmUpdateDialog
          title={`Update “${product.title}”?`}
          change={{ label: what, from: show(saved), to: show(asking) }}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        />
      )}
    </>
  )
}

/** The product's own text fields that can be changed where they are shown (the SEO card). */
export type ProductTextField = 'seoTitle' | 'seoDescription' | 'templateSuffix'

const PRODUCT_TEXT_NAMES: Record<ProductTextField, string> = {
  seoTitle: 'SEO title',
  seoDescription: 'SEO description',
  templateSuffix: 'Template suffix',
}

const productText = (product: ProductDetail, field: ProductTextField) =>
  (field === 'seoTitle'
    ? product.seo?.title
    : field === 'seoDescription'
      ? product.seo?.description
      : product.template_suffix) ?? ''

/**
 * A product's SEO title, SEO description or template suffix, changed where it is shown: the small
 * pencil (or a double-click, or Enter on it) turns it into a box; Enter or leaving it asks "Are you
 * sure?" with old → new, and only "Yes, update" sends it — `seo: { title, description }` (the
 * other one kept as it is, as the SEO editor sends both) or `template_suffix`. Blank clears it.
 */
export function ProductTextCell({
  product,
  field,
  onSaved,
}: {
  product: ProductDetail
  field: ProductTextField
  onSaved?: SavedHandler
}) {
  const { save, error, clearError } = useSaveProduct()
  const [asking, setAsking] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const saved = productText(product, field)
  const what = PRODUCT_TEXT_NAMES[field]
  const shown = sending ?? saved
  const show = (value: string) => (value === '' ? '—' : value)

  async function confirm() {
    const next = asking
    if (next === null) return
    setAsking(null)
    setSending(next)
    setFailed(false)
    clearError()
    const body: ProductUpdateBody =
      field === 'templateSuffix'
        ? { template_suffix: next }
        : {
            seo: {
              title: field === 'seoTitle' ? next : productText(product, 'seoTitle'),
              description:
                field === 'seoDescription'
                  ? next
                  : productText(product, 'seoDescription'),
            },
          }
    const result = await save({ id: product.id, body, shop: product.shop?.key })
    setSending(null)
    if (result) onSaved?.(result, product, body)
    else setFailed(true)
  }

  return (
    <>
      <DoubleClickEdit
        value={saved}
        label={what}
        showIcon
        maxLength={LIMITS[field]}
        busy={sending !== null}
        onCommit={(next) => {
          const trimmed = next.trim()
          if (trimmed !== saved) setAsking(trimmed)
        }}
        display={
          <span className={`break-words ${shown === '' ? 'text-text-muted' : ''}`}>
            {show(shown)}
          </span>
        }
      />
      {failed && error && (
        <span role="alert" className="text-danger block text-[0.72rem] font-normal">
          {error}
        </span>
      )}
      {asking !== null && (
        <ConfirmUpdateDialog
          title={`Update “${product.title}”?`}
          change={{ label: what, from: show(saved), to: show(asking) }}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        />
      )}
    </>
  )
}

/**
 * An image's alt text under its picture on the Media tab, changed where it is shown: double-click
 * it, edit, Enter. It asks "Are you sure?" first, then sends just that image's alt text (the same
 * save as the lightbox's, `useImageAltSave`).
 */
export function AltCaption({
  product,
  imageId,
  alt,
  position,
  editor,
}: {
  product: ProductDetail
  imageId: string
  /** The alt text as saved (not empty — a picture without one shows no caption). */
  alt: string
  /** Which picture it is, for the box's name. */
  position: number
  editor: AltTextEditor | undefined
}) {
  const [asking, setAsking] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  async function confirm() {
    const next = asking
    if (next === null || !editor) return
    setAsking(null)
    setSending(next)
    setFailed(false)
    editor.clearError()
    const ok = await editor.save(imageId, next)
    setSending(null)
    setFailed(!ok)
  }

  return (
    <div className="px-0.5 pt-1.5 text-center">
      <DoubleClickEdit
        value={alt}
        label={`Alt text of image ${position}`}
        maxLength={LIMITS.mediaAlt}
        busy={sending !== null}
        validate={(next) => (next.length > LIMITS.mediaAlt ? 'That is too long' : null)}
        onCommit={setAsking}
        align="center"
        highlighted
        showIcon
        className="w-full"
        display={
          <span
            title={sending ?? alt}
            className="text-text line-clamp-2 block text-[0.72rem] leading-snug break-words"
          >
            {sending ?? alt}
          </span>
        }
      />
      {failed && editor?.error && (
        <span role="alert" className="text-danger block text-[0.7rem]">
          {editor.error}
        </span>
      )}
      {asking !== null && (
        <ConfirmUpdateDialog
          title={`Update “${product.title}”?`}
          change={{
            label: `Alt text of image ${position}`,
            from: alt === '' ? '(empty)' : `“${alt}”`,
            to: asking === '' ? '(empty)' : `“${asking}”`,
          }}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        />
      )}
    </div>
  )
}

/**
 * The **location** of one variant's stock, changed where it is shown: double-click the name (or
 * press Enter on it, or click the pencil) and it turns into a dropdown of the store's locations
 * the variant has no stock at yet. Choosing one asks "Are you sure?" first, then **moves the
 * stock**: the chosen location gets what this one has and this one is set to 0 —
 * `variants: [{ id, stock: [{ location_id: new, available }, { location_id: old, available: 0 }] }]`
 * (Shopify keeps the old location listed, at 0). The store's locations are only asked for once the
 * dropdown opens; Escape or ✕ closes it and sends nothing.
 */
export function LocationCell({
  product,
  variant,
  level,
  onSaved,
}: {
  product: ProductDetail
  variant: ProductVariant
  level: StockLevel
  onSaved?: SavedHandler
}) {
  const [editing, setEditing] = useState(false)
  const [asking, setAsking] = useState<StockLocationChoice | null>(null)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const { save, error, clearError } = useSaveProduct()
  const place = level.location_name ?? `Location ${level.location_shopify_id}`
  const units = level.available ?? 0
  const name = variant.title ?? 'variant'

  async function confirm() {
    if (!asking) return
    const target = asking
    setAsking(null)
    setSending(true)
    setFailed(false)
    clearError()
    const body: ProductUpdateBody = {
      variants: [
        {
          id: variant.id,
          stock: [
            { location_id: Number(target.id), available: units },
            { location_id: level.location_shopify_id, available: 0 },
          ],
        },
      ],
    }
    const result = await save({ id: product.id, body, shop: product.shop?.key })
    setSending(false)
    if (result) onSaved?.(result, product, body)
    else setFailed(true)
  }

  return (
    <>
      {editing ? (
        <LocationPicker
          product={product}
          variant={variant}
          level={level}
          onPick={(choice) => {
            setEditing(false)
            setAsking(choice)
          }}
          onClose={() => setEditing(false)}
        />
      ) : (
        <button
          type="button"
          title="Double-click to change the location"
          onDoubleClick={() => setEditing(true)}
          onClick={(event) => {
            if (
              event.detail === 0 ||
              (event.target as Element).closest('[data-edit-icon]')
            ) {
              setEditing(true)
            }
          }}
          className={`focus-visible:outline-accent hover:bg-accent-tint/60 -mx-1 inline-flex max-w-80 min-w-0 cursor-text items-center gap-1.5 rounded border-none bg-transparent px-1 py-0.5 text-left transition-colors focus-visible:outline-2 ${
            sending ? 'opacity-60' : ''
          }`}
        >
          <span className="truncate" title={level.location_name ?? ''}>
            {place}
          </span>
          <span
            data-edit-icon
            aria-hidden="true"
            className="text-text-muted hover:text-accent inline-flex shrink-0 cursor-pointer opacity-70 transition-colors hover:opacity-100"
          >
            <PencilIcon width={12} height={12} />
          </span>
        </button>
      )}
      {failed && error && (
        <span role="alert" className="text-danger block text-[0.72rem] font-normal">
          {error}
        </span>
      )}
      {asking !== null && (
        <ConfirmUpdateDialog
          title={`Update \u201c${product.title}\u201d?`}
          change={{
            label: `Location of ${name}\u2019s stock`,
            from: place,
            to: asking.name,
          }}
          note={`The stock moves: ${asking.name} gets ${units.toLocaleString('en-GB')} and ${place} is set to 0.`}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        />
      )}
    </>
  )
}

/** The dropdown a location turns into (its own component, so the store's list is only asked for now). */
function LocationPicker({
  product,
  variant,
  level,
  onPick,
  onClose,
}: {
  product: ProductDetail
  variant: ProductVariant
  level: StockLevel
  onPick: (choice: StockLocationChoice) => void
  onClose: () => void
}) {
  const locations = useProductStockLocations(product)
  const current = String(level.location_shopify_id)
  const taken = new Set(
    variant.inventory_levels.map((other) => String(other.location_shopify_id)),
  )
  const choices = locations.filter(
    (place) => place.id === current || !taken.has(place.id),
  )
  const place = level.location_name ?? `Location ${current}`
  // The dropdown has the keyboard as soon as it appears (so Escape closes it).
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    box.current?.querySelector('select')?.focus()
  }, [])

  return (
    <div
      ref={box}
      className="flex items-center gap-1.5"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="w-64 max-w-full">
        <SelectField
          id={`location-${variant.id}-${current}`}
          label={`Location of ${variant.title ?? 'variant'} at ${place}`}
          hideLabel
          compact
          value={current}
          options={
            choices.some((choice) => choice.id === current)
              ? choices.map((choice) => ({ value: choice.id, label: choice.name }))
              : [{ value: current, label: place }]
          }
          onChange={(next) => {
            const choice = choices.find((candidate) => candidate.id === next)
            if (choice && choice.id !== current) onPick(choice)
            else onClose()
          }}
        />
      </div>
      <button
        type="button"
        aria-label="Cancel changing the location"
        onClick={onClose}
        className="border-border text-text-muted hover:border-accent hover:text-text inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-transparent transition-colors"
      >
        <XIcon width={14} height={14} />
      </button>
    </div>
  )
}

/**
 * "Continue selling when out of stock" for one variant, on the Inventory tab: the same box as the
 * Variants editor's. Ticking or unticking it asks "Are you sure?" (Off \u2192 On), then sends just
 * `variants: [{ id, inventory_policy }]` (`CONTINUE` / `DENY`); the box follows the saved value, so
 * it only flips once the store has the change.
 */
export function ContinueSellingBox({
  product,
  variant,
  onSaved,
}: {
  product: ProductDetail
  variant: ProductVariant
  onSaved?: SavedHandler
}) {
  const { save, error, clearError } = useSaveProduct()
  const [asking, setAsking] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const keeps = variant.inventory_policy?.toUpperCase() === 'CONTINUE'
  const name = variant.title ?? 'variant'

  async function confirm() {
    if (asking === null) return
    const next = asking
    setAsking(null)
    setSending(true)
    setFailed(false)
    clearError()
    const body: ProductUpdateBody = {
      variants: [{ id: variant.id, inventory_policy: next ? 'CONTINUE' : 'DENY' }],
    }
    const result = await save({ id: product.id, body, shop: product.shop?.key })
    setSending(false)
    if (result) onSaved?.(result, product, body)
    else setFailed(true)
  }

  return (
    <div className={`pt-3 ${sending ? 'opacity-60' : ''}`}>
      <CheckField
        id={`continue-selling-${variant.id}`}
        label="Continue selling when out of stock"
        hint="Customers can keep buying after the stock runs out."
        checked={keeps}
        onChange={(next) => {
          if (!sending) setAsking(next)
        }}
      />
      {failed && error && (
        <span role="alert" className="text-danger block pt-1 text-[0.72rem]">
          {error}
        </span>
      )}
      {asking !== null && (
        <ConfirmUpdateDialog
          title={`Update \u201c${product.title}\u201d?`}
          change={{
            label: `Continue selling when out of stock \u2014 ${name}`,
            from: keeps ? 'On' : 'Off',
            to: asking ? 'On' : 'Off',
          }}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        />
      )}
    </div>
  )
}
