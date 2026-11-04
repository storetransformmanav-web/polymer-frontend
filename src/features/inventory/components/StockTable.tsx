import { MapPinIcon, PencilIcon } from '../../../components/ui/icons.tsx'
import type {
  EditableStockQuantity,
  InventoryItem,
  StockLine,
  StockQuantities,
  StockQuantityName,
} from '../../../lib/api/endpoints.ts'
import {
  QUANTITY_LABELS,
  formatQuantity,
  quantityOf,
  sumLines,
} from '../../../lib/inventoryStock.ts'
import { when } from '../utils/format.ts'
import { StockValueCell } from './StockValueCell.tsx'

const TH =
  'text-text border-border-strong bg-table-head border-b px-3 py-2 text-[0.68rem] font-bold tracking-wide whitespace-nowrap uppercase'
const TD =
  'border-border border-b px-3 py-2 align-middle text-[0.85rem] whitespace-nowrap'
const NUMBER = 'text-right tabular-nums'
const ACTION =
  'border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-[0.76rem] font-semibold transition-colors'

const SUMMARY: StockQuantityName[] = [
  'available',
  'on_hand',
  'committed',
  'incoming',
  'unavailable',
]
const FULL: StockQuantityName[] = [
  'available',
  'on_hand',
  'committed',
  'incoming',
  'reserved',
  'safety_stock',
  'damaged',
  'quality_control',
  'unavailable',
]

export interface StockEditRequest {
  locationId: number
  mode: 'set' | 'adjust'
  quantity?: EditableStockQuantity
}

/**
 * A variant's stock at each location: one row per location with its quantities, and a **Set** and
 * an **Adjust** button on each (the edit window, starting on that location). `summary` shows the
 * five headline quantities (the list's expanded row), `full` all nine and a **totals** row (the
 * variant's page). **Available** and **On hand** change by double-clicking them. A variant that is
 * not tracked in Shopify has no buttons and no pencils.
 */
export function StockTable({
  item,
  lines,
  totals,
  columns = 'full',
  onEdit,
}: {
  item: Pick<InventoryItem, 'variant_id' | 'title' | 'variant_title' | 'tracked'>
  lines: StockLine[]
  /** The variant's totals; worked out from the lines when not given. */
  totals?: StockQuantities
  columns?: 'summary' | 'full'
  onEdit: (request: StockEditRequest) => void
}) {
  const names = columns === 'full' ? FULL : SUMMARY
  const editable = item.tracked !== false
  const sums = totals ?? sumLines(lines)

  return (
    <div className="border-border-strong overflow-x-auto border">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} text-left`}>Location</th>
            {names.map((name) => (
              <th key={name} className={`${TH} text-right`}>
                {QUANTITY_LABELS[name]}
              </th>
            ))}
            {columns === 'full' && <th className={`${TH} text-left`}>Updated</th>}
            {editable && <th className={`${TH} text-center`}>Change</th>}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td
                colSpan={names.length + 3}
                className={`${TD} text-text-muted py-5 text-center`}
              >
                No stock is recorded at any location yet.
              </td>
            </tr>
          )}
          {lines.map((line) => (
            <tr
              key={line.location_id}
              className="hover:bg-accent-tint/40 transition-colors"
            >
              <td className={TD}>
                <span className="flex items-center gap-2 font-medium">
                  <MapPinIcon
                    width={14}
                    height={14}
                    className="text-text-muted shrink-0"
                  />
                  <span
                    className="max-w-72 truncate"
                    title={line.location_name ?? undefined}
                  >
                    {line.location_name ?? `Location ${line.location_id}`}
                  </span>
                </span>
              </td>
              {names.map((name) => (
                <td key={name} className={`${TD} ${NUMBER}`}>
                  {editable && (name === 'available' || name === 'on_hand') ? (
                    <StockValueCell item={item} line={line} name={name} />
                  ) : (
                    <span
                      className={
                        name === 'unavailable' && quantityOf(line, name) > 0
                          ? 'text-warning'
                          : ''
                      }
                    >
                      {formatQuantity(quantityOf(line, name))}
                    </span>
                  )}
                </td>
              ))}
              {columns === 'full' && (
                <td className={`${TD} text-text-muted`}>{when(line.updated_at)}</td>
              )}
              {editable && (
                <td className={`${TD} text-center`}>
                  <span className="inline-flex gap-1.5">
                    <button
                      type="button"
                      aria-label={`Set stock at ${line.location_name ?? line.location_id}`}
                      onClick={() =>
                        onEdit({ locationId: line.location_id, mode: 'set' })
                      }
                      className={ACTION}
                    >
                      <PencilIcon width={12} height={12} />
                      Set
                    </button>
                    <button
                      type="button"
                      aria-label={`Adjust stock at ${line.location_name ?? line.location_id}`}
                      onClick={() =>
                        onEdit({ locationId: line.location_id, mode: 'adjust' })
                      }
                      className={ACTION}
                    >
                      Adjust
                    </button>
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {columns === 'full' && lines.length > 0 && (
          <tfoot>
            <tr className="bg-table-head/60 font-bold">
              <td className={`${TD} border-b-0`}>Total</td>
              {names.map((name) => (
                <td key={name} className={`${TD} ${NUMBER} border-b-0`}>
                  {formatQuantity(quantityOf(sums, name))}
                </td>
              ))}
              <td className={`${TD} border-b-0`} />
              {editable && <td className={`${TD} border-b-0`} />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
