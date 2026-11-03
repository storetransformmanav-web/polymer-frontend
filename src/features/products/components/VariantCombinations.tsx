import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DETAIL_CARD as CARD,
  DETAIL_TH as TH,
  DetailEmpty as Empty,
} from '../../../components/ui/DetailSection.tsx'
import { BoxesIcon, SearchIcon } from '../../../components/ui/icons.tsx'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import type { ProductDetail, ProductVariant } from '../../../lib/api/endpoints.ts'
import type { SavedHandler } from '../hooks/useSectionEdit.ts'
import { productStock, variantStock } from '../utils/stock.ts'
import { VariantBulkEdit } from './edit/VariantBulkEdit.tsx'
import { VariantEditPanel } from './edit/VariantEditPanel.tsx'
import { StockCell, VariantFieldCell } from './InlineEdits.tsx'
import { ProductImage } from './ProductImage.tsx'

const TD = 'border-border border-b px-3 py-2.5 align-middle text-[0.85rem]'
const FILTERS = [
  { value: 'all', label: 'All variants' },
  { value: 'in', label: 'In stock' },
  { value: 'out', label: 'Out of stock' },
]
const TOOL_BUTTON =
  'border-border bg-bg text-text hover:border-accent inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

const num = (value: number) => value.toLocaleString('en-GB')

/**
 * The product's options as the store admin shows them: one box per option (Size · 3) with a pill
 * per value. Read-only — **Edit variants** at the top of the tab changes them.
 */
export function VariantOptionsCard({ product }: { product: ProductDetail }) {
  const options = product.has_only_default_variant
    ? []
    : [...product.options].sort((a, b) => a.position - b.position)
  if (options.length === 0) return null
  return (
    <section aria-label="Variant options" className={`${CARD} flex flex-col gap-3 p-4`}>
      <h3 className="text-[0.95rem] font-semibold">Variant options</h3>
      <div
        className={`grid grid-cols-1 gap-3 ${options.length > 1 ? 'md:grid-cols-2' : ''} ${
          options.length > 2 ? 'xl:grid-cols-3' : ''
        }`}
      >
        {options.map((option) => (
          <div
            key={option.name}
            className="border-border flex flex-col gap-2 rounded-lg border px-3 py-2.5"
          >
            <p className="flex items-center gap-2 text-[0.85rem] font-semibold">
              {option.name}
              <span className="bg-accent-tint text-text-muted rounded-full px-2 text-[0.72rem]">
                {option.values.length}
              </span>
            </p>
            <ul
              aria-label={`Values of ${option.name}`}
              className="flex flex-wrap gap-1.5"
            >
              {option.values.map((value) => (
                <li
                  key={value}
                  className="border-border-strong bg-bg rounded-full border px-3 py-0.5 text-[0.8rem] font-medium"
                >
                  {value}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * **Variant combinations** — every variant in one table, as the store admin lists them: a search
 * box (name or SKU), a stock filter and **Bulk edit**; then a row per variant with a tick box, its
 * picture and name, SKU, price, compare-at price, cost, inventory, an In stock / Out of stock pill
 * and an **Edit** button. **Every value is changed by double-clicking it** (no pencils): SKU,
 * price, compare-at, cost and — for a variant kept at one location — the inventory; each asks
 * "Are you sure?" and sends just that field. **Edit** opens that variant alone in a panel beside
 * the table; **Bulk edit** turns the ticked variants (or all shown) into a spreadsheet like the
 * products' bulk editor.
 */
export function VariantCombinations({
  product,
  onSaved,
}: {
  product: ProductDetail
  onSaved?: SavedHandler
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [bulk, setBulk] = useState<string[] | null>(null)

  if (product.variants.length === 0) {
    return <Empty icon={BoxesIcon}>This product has no variants.</Empty>
  }

  const words = search.trim().toLowerCase()
  const shown = product.variants.filter((variant) => {
    const stock = variantStock(variant) ?? 0
    if (filter === 'in' && stock <= 0) return false
    if (filter === 'out' && stock > 0) return false
    if (!words) return true
    return `${variant.title ?? ''} ${variant.sku ?? ''}`.toLowerCase().includes(words)
  })
  const ticked = shown.filter((variant) => selected.has(variant.id))
  const allTicked = shown.length > 0 && ticked.length === shown.length
  const total = productStock(product) ?? 0

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (bulk) {
    return (
      <VariantBulkEdit
        product={product}
        ids={bulk}
        onSaved={onSaved}
        onClose={() => {
          setBulk(null)
          setSelected(new Set())
        }}
      />
    )
  }

  return (
    <div
      className={`grid grid-cols-1 items-start gap-4 ${
        editing ? '2xl:grid-cols-[minmax(0,1fr)_30rem]' : ''
      }`}
    >
      <section
        aria-label="Variant combinations"
        className={`${CARD} flex min-w-0 flex-col overflow-hidden`}
      >
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
          <h3 className="mr-2 flex items-center gap-2 text-[0.95rem] font-semibold">
            Variant combinations
            <span className="bg-accent-tint text-text-muted rounded-full px-2 text-[0.72rem]">
              {product.variants.length}
            </span>
          </h3>
          <label className="relative min-w-52 flex-1">
            <span className="sr-only">Search variants</span>
            <SearchIcon
              width={15}
              height={15}
              className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search variants (e.g. Small / Red, SKU)"
              className="border-border bg-bg focus:border-accent h-9 w-full rounded-lg border pr-3 pl-9 text-[0.85rem] outline-none"
            />
          </label>
          <div className="w-40">
            <SelectField
              id={`variant-filter-${product.id}`}
              label="Show"
              hideLabel
              compact
              value={filter}
              options={FILTERS}
              onChange={setFilter}
            />
          </div>
          <button
            type="button"
            className={TOOL_BUTTON}
            disabled={shown.length === 0}
            onClick={() => {
              setEditing(null)
              setBulk((ticked.length > 0 ? ticked : shown).map((variant) => variant.id))
            }}
          >
            Bulk edit{ticked.length > 0 ? ` (${ticked.length})` : ''}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr>
                <th className={`${TH} w-10`}>
                  <input
                    type="checkbox"
                    aria-label="Select every variant shown"
                    checked={allTicked}
                    onChange={() =>
                      setSelected(
                        allTicked
                          ? new Set()
                          : new Set(shown.map((variant) => variant.id)),
                      )
                    }
                    className="accent-accent h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className={TH}>Variant</th>
                <th className={TH}>SKU</th>
                <th className={`${TH} text-right`}>Price</th>
                <th className={`${TH} text-right`}>Compare-at</th>
                <th className={`${TH} text-right`}>Cost</th>
                <th className={`${TH} text-right`}>Inventory</th>
                <th className={`${TH} text-center`}>Status</th>
                <th className={`${TH} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={9} className={`${TD} text-text-muted py-6 text-center`}>
                    No variants match.
                  </td>
                </tr>
              ) : (
                shown.map((variant) => (
                  <CombinationRow
                    key={variant.id}
                    product={product}
                    variant={variant}
                    ticked={selected.has(variant.id)}
                    open={editing === variant.id}
                    onTick={() => toggle(variant.id)}
                    onEdit={() => setEditing(variant.id)}
                    onSaved={onSaved}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-border-strong bg-surface border-t px-3.5 py-3 text-[0.85rem]">
          Total inventory across all locations: <strong>{num(total)}</strong> available
          <span className="text-text-muted ml-2 hidden text-[0.78rem] md:inline">
            · Double-click a value to change it.
          </span>
        </p>
      </section>

      {editing && (
        <VariantEditPanel
          key={editing}
          product={product}
          variantId={editing}
          onSaved={onSaved}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function CombinationRow({
  product,
  variant,
  ticked,
  open,
  onTick,
  onEdit,
  onSaved,
}: {
  product: ProductDetail
  variant: ProductVariant
  ticked: boolean
  open: boolean
  onTick: () => void
  onEdit: () => void
  onSaved?: SavedHandler
}) {
  const stock = variantStock(variant)
  const out = (stock ?? 0) <= 0
  const title = variant.title ?? '—'
  // One recorded location: the stock is changed right here (several go through the Inventory tab).
  const onlyLevel =
    variant.inventory_levels.length === 1 ? variant.inventory_levels[0] : null
  return (
    <tr
      className={`border-border hover:bg-accent-tint/60 transition-colors ${
        ticked || open ? 'bg-accent-tint/40' : ''
      }`}
    >
      <td className={TD}>
        <input
          type="checkbox"
          aria-label={`Select ${title}`}
          checked={ticked}
          onChange={onTick}
          className="accent-accent h-4 w-4 cursor-pointer"
        />
      </td>
      <td className={TD}>
        <div className="flex items-center gap-3">
          <span className="border-border h-9 w-9 shrink-0 overflow-hidden border">
            <ProductImage src={variant.image_url ?? null} alt="" size="thumb" />
          </span>
          <span className="truncate font-semibold" title={title}>
            {title}
          </span>
        </div>
      </td>
      <td className={TD}>
        <span className="flex items-center gap-1">
          <VariantFieldCell
            product={product}
            variant={variant}
            field="sku"
            onSaved={onSaved}
          />
          {variant.sku && (
            <CopyButton value={variant.sku} label={`Copy ${variant.sku}`} />
          )}
        </span>
      </td>
      <td className={`${TD} text-right`}>
        <VariantFieldCell
          product={product}
          variant={variant}
          field="price"
          align="right"
          onSaved={onSaved}
        />
      </td>
      <td className={`${TD} text-right`}>
        <VariantFieldCell
          product={product}
          variant={variant}
          field="compare_at_price"
          align="right"
          strike
          onSaved={onSaved}
        />
      </td>
      <td className={`${TD} text-right`}>
        <VariantFieldCell
          product={product}
          variant={variant}
          field="cost"
          align="right"
          onSaved={onSaved}
        />
      </td>
      <td className={`${TD} text-right`}>
        {onlyLevel ? (
          <StockCell
            product={product}
            variant={variant}
            level={onlyLevel}
            onSaved={onSaved}
            icon={false}
          />
        ) : (
          <span
            title={
              variant.inventory_levels.length > 1
                ? 'Several locations: change them on the Inventory tab'
                : undefined
            }
            className={`font-semibold ${out ? 'text-danger' : ''}`}
          >
            {stock === null ? '—' : num(stock)}
          </span>
        )}
      </td>
      <td className={`${TD} text-center`}>
        <span className="inline-flex flex-wrap items-center justify-center gap-1">
          {out ? (
            <Badge tone="danger">Out of stock</Badge>
          ) : (
            <Badge tone="success">In stock</Badge>
          )}
          {variant.available_for_sale === false && (
            <Badge tone="neutral">Unavailable</Badge>
          )}
        </span>
      </td>
      <td className={`${TD} text-center`}>
        <button
          type="button"
          aria-label={`Edit ${title}`}
          onClick={onEdit}
          className="border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex h-7 cursor-pointer items-center rounded-md border px-2.5 text-[0.78rem] font-semibold transition-colors"
        >
          Edit
        </button>
      </td>
    </tr>
  )
}
