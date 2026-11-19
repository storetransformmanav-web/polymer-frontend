import { useState } from 'react'
import { DoubleClickEdit } from '../../../components/ui/DoubleClickEdit.tsx'
import type { InventoryItem, StockLine } from '../../../lib/api/endpoints.ts'
import {
  quantityLabel,
  formatQuantity,
  quantityOf,
  validateSet,
} from '../../../lib/inventoryStock.ts'
import { useStockOptions } from '../hooks/useStockOptions.ts'
import { useStockWrites } from '../hooks/useStockWrites.ts'
import { fullName } from '../utils/format.ts'
import { ConfirmStockDialog } from './ConfirmStockDialog.tsx'

/**
 * One quantity of a variant at one location, changed where it is shown: **double-click it**
 * (a small pencil marks it), type the new number, press Enter. It asks "Are you sure?" with the
 * number now → the number it becomes, then sends just that one quantity (`PUT /inventory/{variant}`
 * with `quantities: { available: 22 }` and the backend's default reason) — and the new number shows at once,
 * in the table, the variant's page and the figures above; a refusal puts it back and says why.
 */
export function StockValueCell({
  item,
  line,
  name,
}: {
  item: Pick<InventoryItem, 'variant_id' | 'title' | 'variant_title'>
  line: StockLine
  name: 'available' | 'on_hand'
}) {
  const writes = useStockWrites()
  // The reason is the backend's own first one (its default); none is sent when it listed none.
  const reason = useStockOptions().reasons[0]?.value
  const [asking, setAsking] = useState<number | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const saved = quantityOf(line, name)
  const place = line.location_name ?? `location ${line.location_id}`
  const label = `${quantityLabel(name)} of ${fullName(item)} at ${place}`

  async function confirm() {
    const next = asking
    if (next === null) return
    setAsking(null)
    setFailure(null)
    const outcome = await writes.save({
      ref: item.variant_id,
      request: {
        mode: 'set',
        body: {
          location_id: line.location_id,
          quantities: { [name]: next },
          ...(reason ? { reason } : {}),
        },
      },
      label: `${quantityLabel(name)} at ${place}: ${formatQuantity(saved)} → ${formatQuantity(next)}`,
    })
    if (!outcome.ok) setFailure(outcome.error)
  }

  return (
    <>
      <DoubleClickEdit
        value={String(saved)}
        label={label}
        inputMode="numeric"
        align="right"
        showIcon
        autoWidth
        validate={validateSet}
        onCommit={(next) => setAsking(Number(next))}
        display={<span className="font-semibold">{formatQuantity(saved)}</span>}
      />
      {failure && (
        <span role="alert" className="text-danger block text-[0.72rem] font-normal">
          {failure}
        </span>
      )}
      {asking !== null && (
        <ConfirmStockDialog
          title={`Update “${fullName(item)}”?`}
          change={{
            label: `${quantityLabel(name)} at ${place}`,
            from: formatQuantity(saved),
            to: formatQuantity(asking),
          }}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        />
      )}
    </>
  )
}
