import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { AlertTriangleIcon, HistoryIcon } from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import type { StockHistoryParams, StockLocation } from '../../../lib/api/endpoints.ts'
import {
  formatDelta,
  formatQuantity,
  quantityLabel,
  reasonLabel,
} from '../../../lib/inventoryStock.ts'
import { useStockHistory } from '../hooks/useStockHistory.ts'
import { syncLabel, syncTone, userName, when } from '../utils/format.ts'

const TH =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-2.5 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase'
const TD = 'border-border border-b px-3 py-2 align-middle text-[0.85rem]'
const SKELETON_ROWS = 6

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any status' },
  { value: 'pending', label: 'Pending' },
  { value: 'synced', label: 'Synced' },
  { value: 'error', label: 'Error' },
]

/**
 * The stock history: one row per change — when, who, what, where, the quantity and how it
 * moved (before → after, with the amount), why, the note, and a status badge (pending grey,
 * synced green, error red with the store's reason as hover text) with the time Shopify
 * confirmed it. Filters: location and status (and, on a variant's page, only that variant).
 * Cached like every list, so coming back shows at once.
 */
export function StockHistory({
  variantId,
  locations,
}: {
  /** Only this variant's changes (its page); none = every variant. */
  variantId?: string
  locations: StockLocation[]
}) {
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const params: StockHistoryParams = {
    ...(variantId ? { variant_id: variantId } : {}),
    ...(location ? { location } : {}),
    ...(status ? { status: status as StockHistoryParams['status'] } : {}),
    page,
    page_size: pageSize,
  }
  const history = useStockHistory(params)
  const data = history.data
  const locationOptions: SelectOption[] = [
    { value: '', label: 'All locations' },
    ...locations.map((choice) => ({
      value: String(choice.id),
      label: choice.name ?? `Location ${choice.id}`,
    })),
  ]

  return (
    <section aria-label="Stock history" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56 max-w-full">
          <SelectField
            compact
            id="history-location"
            label="Location"
            value={location}
            options={locationOptions}
            onChange={(next) => {
              setLocation(next)
              setPage(1)
            }}
          />
        </div>
        <div className="w-44 max-w-full">
          <SelectField
            compact
            id="history-status"
            label="Status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(next) => {
              setStatus(next)
              setPage(1)
            }}
          />
        </div>
      </div>

      <div className="border-border-strong bg-bg overflow-hidden border">
        {history.error ? (
          <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-12 text-center text-[0.9rem]">
            <AlertTriangleIcon width={26} height={26} className="text-danger" />
            <p className="text-text m-0 font-semibold">Couldn&apos;t load the history</p>
            <p className="m-0">{history.error}</p>
            <button
              type="button"
              onClick={history.retry}
              className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold"
            >
              Try again
            </button>
          </div>
        ) : !history.isPending && history.items.length === 0 ? (
          <div className="text-text-muted flex flex-col items-center gap-2 px-4 py-12 text-center text-[0.9rem]">
            <HistoryIcon width={26} height={26} />
            <p className="m-0">No stock changes yet.</p>
          </div>
        ) : (
          <div
            aria-busy={history.isPending}
            className="max-h-[min(60svh,640px)] overflow-auto"
          >
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>User</th>
                  {!variantId && <th className={TH}>Product</th>}
                  <th className={TH}>Location</th>
                  <th className={TH}>Quantity</th>
                  <th className={TH}>Mode</th>
                  <th className={TH}>Change</th>
                  <th className={TH}>Reason</th>
                  <th className={TH}>Note</th>
                  <th className={`${TH} text-center`}>Status</th>
                  <th className={TH}>Confirmed at</th>
                </tr>
              </thead>
              <tbody>
                {history.isPending
                  ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                      <tr key={row} aria-hidden="true">
                        {Array.from({ length: variantId ? 10 : 11 }, (_, cell) => (
                          <td key={cell} className={TD}>
                            <span className="bg-surface block h-4 animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : history.items.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-accent-tint/40 transition-colors"
                      >
                        <td className={`${TD} whitespace-nowrap`}>
                          {when(entry.created_at)}
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {userName(entry.user)}
                        </td>
                        {!variantId && (
                          <td className={TD}>
                            <span className="block max-w-64 truncate font-medium">
                              {entry.title ?? '—'}
                            </span>
                            {entry.sku && (
                              <span className="text-text-muted block font-mono text-[0.74rem]">
                                {entry.sku}
                              </span>
                            )}
                          </td>
                        )}
                        <td className={`${TD} whitespace-nowrap`}>
                          {entry.location_name ?? '—'}
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {quantityLabel(entry.quantity_name)}
                        </td>
                        <td className={`${TD} whitespace-nowrap capitalize`}>
                          {entry.mode ?? '—'}
                        </td>
                        <td className={`${TD} whitespace-nowrap tabular-nums`}>
                          <span className="text-text-muted">
                            {formatQuantity(entry.quantity_before)}
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-accent mx-1.5 font-bold"
                          >
                            →
                          </span>
                          <strong>{formatQuantity(entry.quantity_after)}</strong>
                          <span
                            className={`ml-1.5 text-[0.78rem] ${
                              (entry.delta ?? 0) < 0 ? 'text-danger' : 'text-text-muted'
                            }`}
                          >
                            ({formatDelta(entry.delta)})
                          </span>
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {reasonLabel(entry.reason)}
                        </td>
                        <td className={TD}>
                          <span
                            className="block max-w-56 truncate"
                            title={entry.note ?? undefined}
                          >
                            {entry.note || '—'}
                          </span>
                        </td>
                        <td className={`${TD} text-center`}>
                          <span title={entry.error ?? undefined}>
                            <Badge tone={syncTone(entry.status)}>
                              {syncLabel(entry.status)}
                            </Badge>
                          </span>
                        </td>
                        <td className={`${TD} text-text-muted whitespace-nowrap`}>
                          {when(entry.synced_at)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 0 && (
          <PaginationFooter
            page={data.page}
            pageSize={pageSize}
            total={data.total}
            totalPages={data.total_pages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        )}
      </div>
    </section>
  )
}
