import { useState } from 'react'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import {
  DetailsHeader,
  HeaderChip,
  StatusPill,
} from '../../../components/ui/DetailsHeader.tsx'
import {
  AlertTriangleIcon,
  BarcodeIcon,
  PlusIcon,
  PoundIcon,
  StoreIcon,
} from '../../../components/ui/icons.tsx'
import { formatPrice } from '../../../lib/format.ts'
import {
  formatQuantity,
  quantityOf,
  QUANTITY_HINTS,
  QUANTITY_LABELS,
} from '../../../lib/inventoryStock.ts'
import type {
  InventoryItem,
  InventoryVariant,
  StockQuantityName,
} from '../../../lib/api/endpoints.ts'
import { useLocationChoices } from '../hooks/useLocationChoices.ts'
import { useVariantStock } from '../hooks/useVariantStock.ts'
import { statusLabel, statusTone, variantName } from '../utils/format.ts'
import { StockEditDialog } from './StockEditDialog.tsx'
import { StockHistory } from './StockHistory.tsx'
import { StockTable, type StockEditRequest } from './StockTable.tsx'
import { VariantImage } from './VariantImage.tsx'

type TabId = 'stock' | 'history'

const FIGURES: StockQuantityName[] = [
  'available',
  'on_hand',
  'committed',
  'incoming',
  'unavailable',
]

/**
 * One variant's stock, shown in place of the list (same page, no overlay), laid out like a
 * product's page: a header (picture, product, variant, SKU and barcode with copy, status, price,
 * what happens at 0, the store), a strip of the five figures, and two tabs — **Stock** (a row per
 * location with every quantity and **Set** / **Adjust** on each, a totals row, and **Stock at
 * another location** for a location the variant has none at yet) and **History** (this
 * variant's changes). The header and the figures draw from the list row while the full record
 * loads; an edit changes them at once.
 */
export function VariantStockView({ id, onBack }: { id: string; onBack: () => void }) {
  const details = useVariantStock(id)
  const { variant, preview } = details
  // The full record when loaded, else the list row — it already has the stock by location.
  const source: InventoryItem | InventoryVariant | null = variant ?? preview
  const choices = useLocationChoices(source)
  const [tab, setTab] = useState<TabId>('stock')
  const [editing, setEditing] = useState<StockEditRequest | null>(null)

  if (details.error) {
    return (
      <section className="border-border bg-bg flex flex-col items-center gap-3 rounded-2xl border px-4 py-16 text-center">
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="font-semibold">Couldn&apos;t load this variant</p>
          <p className="text-text-muted text-[0.9rem]">{details.error}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={details.retry}
            className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onBack}
            className="border-border bg-bg text-text-muted hover:text-text cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            Back to list
          </button>
        </div>
      </section>
    )
  }

  const title = source?.title ?? 'Loading variant…'
  const name = source ? variantName(source) : null
  const editable = source?.tracked !== false
  const keepsSelling = variant?.inventory_policy?.toUpperCase() === 'CONTINUE'
  const tabs: { id: TabId; label: string }[] = [
    { id: 'stock', label: 'Stock' },
    { id: 'history', label: 'History' },
  ]

  return (
    <article className="border-border bg-bg overflow-hidden rounded-2xl border">
      <DetailsHeader
        className="shrink-0 p-4 pb-3 sm:p-6 sm:pb-3"
        visual={<VariantImage src={source?.image_url} size="lg" />}
        title={title}
        status={
          <>
            {name && (
              <span className="text-text-muted text-[1rem] font-semibold">{name}</span>
            )}
            {source?.status && (
              <StatusPill
                label={statusLabel(source.status)}
                tone={statusTone(source.status)}
              />
            )}
            {source && !editable && <StatusPill label="Not tracked" tone="neutral" />}
            {details.isRefreshing && (
              <span className="text-text-muted text-[0.75rem]" role="status">
                Updating…
              </span>
            )}
          </>
        }
        chips={
          <>
            {source?.sku && (
              <HeaderChip icon={BarcodeIcon} label="SKU">
                <span className="flex items-center gap-1.5 font-mono text-[0.8rem]">
                  {source.sku}
                  <CopyButton value={source.sku} label={`Copy ${source.sku}`} />
                </span>
              </HeaderChip>
            )}
            {source?.barcode && <HeaderChip label="Barcode">{source.barcode}</HeaderChip>}
            {variant?.price && (
              <HeaderChip icon={PoundIcon} label="Price">
                <span className="font-bold">
                  {formatPrice(variant.price, variant.currency)}
                </span>
              </HeaderChip>
            )}
            {variant && (
              <HeaderChip label="When out of stock">
                {keepsSelling ? 'Keeps selling at 0' : 'Stops selling at 0'}
              </HeaderChip>
            )}
            {variant?.shop?.name && (
              <HeaderChip icon={StoreIcon} label="Store">
                {variant.shop.name}
              </HeaderChip>
            )}
          </>
        }
        onBack={onBack}
      />

      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        <dl className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-3 lg:grid-cols-5">
          {FIGURES.map((figure) => (
            <div
              key={figure}
              className="border-border bg-surface flex flex-col gap-0.5 rounded-xl border px-4 py-3"
            >
              <dt className="text-text-muted text-[0.68rem] font-bold tracking-wider uppercase">
                {QUANTITY_LABELS[figure]}
              </dt>
              <dd
                className={`m-0 text-[1.4rem] leading-tight font-bold tabular-nums ${
                  figure === 'available' &&
                  source &&
                  quantityOf(source.totals, figure) <= 0
                    ? 'text-danger'
                    : ''
                }`}
              >
                {source ? formatQuantity(quantityOf(source.totals, figure)) : '—'}
              </dd>
              <dd className="text-text-muted m-0 text-[0.7rem] leading-snug">
                {QUANTITY_HINTS[figure]}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div
        role="tablist"
        aria-label="Variant sections"
        className="border-border flex [scrollbar-width:none] gap-1 overflow-x-auto border-y px-2 sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((item) => {
          const selected = item.id === tab
          return (
            <button
              key={item.id}
              id={`inventory-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="inventory-tabpanel"
              onClick={() => setTab(item.id)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-3 text-[0.85rem] font-semibold whitespace-nowrap transition-colors ${
                selected
                  ? 'border-accent text-text'
                  : 'text-text-muted hover:text-text border-transparent'
              }`}
            >
              {item.label}
              {item.id === 'stock' && source && (
                <span className="bg-surface text-text-muted border-border rounded-full border px-1.5 py-0.5 text-[0.68rem] font-bold">
                  {source.locations.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        id="inventory-tabpanel"
        role="tabpanel"
        aria-labelledby={`inventory-tab-${tab}`}
        className="bg-surface flex flex-col gap-4 p-3 sm:p-5"
      >
        {!source && <DetailSkeleton />}
        {source && tab === 'stock' && (
          <>
            <StockTable
              item={source}
              lines={source.locations}
              totals={source.totals}
              columns="full"
              onEdit={setEditing}
            />
            {editable && choices.length > source.locations.length && (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      locationId:
                        choices.find(
                          (choice) =>
                            !source.locations.some(
                              (line) => line.location_id === choice.id,
                            ),
                        )?.id ?? choices[0].id,
                      mode: 'set',
                    })
                  }
                  className="border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors"
                >
                  <PlusIcon width={14} height={14} />
                  Stock at another location
                </button>
              </div>
            )}
          </>
        )}
        {source && tab === 'history' && (
          <StockHistory
            variantId={id}
            locations={choices.map((c) => ({ id: c.id, name: c.name, variants: 0 }))}
          />
        )}
      </div>

      {editing && source && (
        <StockEditDialog
          key={`edit-${editing.locationId}-${editing.mode}`}
          variant={source}
          locationId={editing.locationId || undefined}
          mode={editing.mode}
          quantity={editing.quantity}
          onClose={() => setEditing(null)}
        />
      )}
    </article>
  )
}
