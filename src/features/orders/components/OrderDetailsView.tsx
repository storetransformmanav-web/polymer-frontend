import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  OrdersIcon,
} from '../../../components/ui/icons.tsx'
import { formatDateTime, formatPrice } from '../../../lib/format.ts'
import { useOrderDetails } from '../hooks/useOrderDetails.ts'
import { financialTone, fulfillmentTone, humanize, orderLabel } from '../utils/format.ts'
import {
  OrderAttributesPanel,
  OrderEventsPanel,
  OrderItemsPanel,
  OrderOverviewPanel,
  OrderPaymentsPanel,
  OrderShippingPanel,
} from './OrderDetailPanels.tsx'

type TabId = 'overview' | 'items' | 'payments' | 'shipping' | 'attributes' | 'events'

interface OrderDetailsViewProps {
  /** The order number from the address (17516). */
  reference: string
  /** The order's store key from the address, when it has one. */
  shop: string | null
  onBack: () => void
}

/**
 * An order's full details, shown in place of the list (same page, no overlay) and laid
 * out like a product's: a header, tabs, and cards. The header and summary draw straight
 * from the list row while the full record loads, so nothing waits on the network when you
 * come from the list.
 */
export function OrderDetailsView({ reference, shop, onBack }: OrderDetailsViewProps) {
  const details = useOrderDetails(reference, shop)
  const { order, preview } = details
  const [tab, setTab] = useState<TabId>('overview')

  const known = order ?? preview
  const title = known ? orderLabel(known) : reference
  const created = known?.shopify_created_at

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'items', label: 'Items', count: order?.line_items.length },
    { id: 'payments', label: 'Payments', count: order?.transactions.length },
    { id: 'shipping', label: 'Shipping' },
    ...(order && order.note_attributes.length > 0
      ? [
          {
            id: 'attributes' as const,
            label: 'Notes & Tracking',
            count: order.note_attributes.length,
          },
        ]
      : []),
    ...(order && order.events.length > 0
      ? [{ id: 'events' as const, label: 'Timeline', count: order.events.length }]
      : []),
  ]

  if (details.error) {
    return (
      <section className="border-border bg-bg flex flex-col items-center gap-3 rounded-2xl border px-4 py-16 text-center">
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="font-semibold">Couldn&apos;t load this order</p>
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

  return (
    <article className="border-border bg-bg overflow-hidden rounded-2xl border">
      <header className="flex items-start gap-4 p-4 sm:p-6">
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
        >
          <OrdersIcon width={26} height={26} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-snug font-bold break-words sm:text-2xl">
            Order {title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.85rem]">
            {known && (
              <>
                {known.financial_status && (
                  <Badge tone={financialTone(known.financial_status)}>
                    {humanize(known.financial_status)}
                  </Badge>
                )}
                {known.fulfillment_status && (
                  <Badge tone={fulfillmentTone(known.fulfillment_status)}>
                    {humanize(known.fulfillment_status)}
                  </Badge>
                )}
                {known.cancelled_at && <Badge tone="danger">Cancelled</Badge>}
                <span className="font-semibold">
                  {formatPrice(known.total_price, known.currency)}
                </span>
                {created && (
                  <span className="text-text-muted">{formatDateTime(created)}</span>
                )}
                {known.shop?.name && (
                  <span className="text-text-muted">{known.shop.name}</span>
                )}
              </>
            )}
            {details.isRefreshing && (
              <span className="text-text-muted text-[0.75rem]" role="status">
                Updating…
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold transition-colors"
        >
          <ArrowLeftIcon width={16} height={16} />
          <span className="hidden sm:inline" aria-hidden="true">
            Back to list
          </span>
        </button>
      </header>

      <div
        role="tablist"
        aria-label="Order sections"
        className="border-border flex [scrollbar-width:none] gap-1 overflow-x-auto border-y px-2 sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((item) => {
          const selected = item.id === tab
          return (
            <button
              key={item.id}
              id={`order-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="order-tabpanel"
              onClick={() => setTab(item.id)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-3 text-[0.85rem] font-semibold whitespace-nowrap transition-colors ${
                selected
                  ? 'border-accent text-text'
                  : 'text-text-muted hover:text-text border-transparent'
              }`}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="bg-surface text-text-muted border-border rounded-full border px-1.5 py-0.5 text-[0.68rem] font-bold">
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        id="order-tabpanel"
        role="tabpanel"
        aria-labelledby={`order-tab-${tab}`}
        className="bg-surface p-3 sm:p-5"
      >
        {tab === 'overview' && <OrderOverviewPanel order={order} preview={preview} />}
        {tab !== 'overview' && !order && <DetailSkeleton />}
        {order && tab === 'items' && <OrderItemsPanel order={order} />}
        {order && tab === 'payments' && <OrderPaymentsPanel order={order} />}
        {order && tab === 'shipping' && <OrderShippingPanel order={order} />}
        {order && tab === 'attributes' && <OrderAttributesPanel order={order} />}
        {order && tab === 'events' && <OrderEventsPanel order={order} />}
      </div>
    </article>
  )
}
