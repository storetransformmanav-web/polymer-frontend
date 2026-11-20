import { MapPinIcon } from '../../../components/ui/icons.tsx'
import type {
  InventoryItem,
  StockLine,
  StockQuantities,
  StockQuantityName,
} from '../../../lib/api/endpoints.ts'
import {
  quantityLabel,
  formatQuantity,
  quantityOf,
  sumLines,
} from '../../../lib/inventoryStock.ts'
import { when } from '../utils/format.ts'
import { StockQuickEdit } from './StockQuickEdit.tsx'

const TH =
  'text-text border-border-strong bg-table-head border-b px-3 py-2 text-[0.68rem] font-bold tracking-wide whitespace-nowrap uppercase'
const TD =
  'border-border border-b px-3 py-2 align-middle text-[0.85rem] whitespace-nowrap'
const NUMBER = 'text-right tabular-nums'

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

/**
 * A variant's stock at each location: one row per location with its quantities. `summary` shows the
 * five headline quantities, `full` all nine, when it was updated and a **totals** row (the variant's
 * page and the list's dropdown row). **Available** and **On hand** of each location carry the same small
 * pencil as the list (`StockQuickEdit`, starting on that location: Set to / Adjust by, the reason and
 * note); there is no Set / Adjust button column. A variant that is not tracked in Shopify has no
 * pencils. With `readOnly` (the list's dropdown row) it only shows the numbers.
 */
export function StockTable({
  item,
  lines,
  totals,
  columns = 'full',
  readOnly = false,
}: {
  item: Pick<InventoryItem, 'variant_id' | 'title' | 'variant_title' | 'tracked'>
  lines: StockLine[]
  /** The variant's totals; worked out from the lines when not given. */
  totals?: StockQuantities
  columns?: 'summary' | 'full'
  /** Show the numbers only — not editable. */
  readOnly?: boolean
}) {
  const names = columns === 'full' ? FULL : SUMMARY
  const editable = item.tracked !== false && !readOnly
  const sums = totals ?? sumLines(lines)
  // What the pencils need: the variant and the lines (so a box starts on a location with its stock).
  const editItem = {
    variant_id: item.variant_id,
    title: item.title,
    variant_title: item.variant_title,
    locations: lines,
  }

  return (
    <div className="border-border-strong overflow-x-auto border">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} text-left`}>Location</th>
            {names.map((name) => (
              <th key={name} className={`${TH} text-right`}>
                {quantityLabel(name)}
              </th>
            ))}
            {columns === 'full' && <th className={`${TH} text-left`}>Updated</th>}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td
                colSpan={names.length + 2}
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
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span className="font-semibold">
                        {formatQuantity(quantityOf(line, name))}
                      </span>
                      <StockQuickEdit
                        item={editItem}
                        name={name}
                        locationId={line.location_id}
                      />
                    </span>
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
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
