import { useEffect, useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  OrdersIcon,
} from '../../../components/ui/icons.tsx'
import { formatDateTime } from '../../../lib/format.ts'
import { useOrderDetails } from '../hooks/useOrderDetails.ts'
import {
  financialTone,
  fulfillmentTone,
  humanize,
  orderCustomer,
  orderLabel,
} from '../utils/format.ts'
import { orderPaymentMethod } from '../utils/payment.ts'
import { notesCount } from '../utils/tracking.ts'
import { OrderEventsPanel } from './OrderDetailPanels.tsx'
import { OrderNotesPanel } from './OrderNotesPanel.tsx'
import { OrderOverviewPanel } from './OrderOverviewPanel.tsx'
import { OrderShippingPanel } from './OrderShippingPanel.tsx'

type TabId = 'overview' | 'shipping' | 'attributes' | 'events'

interface OrderDetailsViewProps {
  /** The order number from the address (17516). */
  reference: string
  /** The order's store key from the address, when it has one. */
  shop: string | null
  onBack: () => void
}

/** One labelled fact of the page's header: the label small above its value. */
function HeaderFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-text-muted text-[0.68rem] font-semibold">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center gap-1 text-[0.8rem] font-medium break-words">
        {children}
      </dd>
    </div>
  )
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
  // What the backend said about the latest change; the order itself is re-read from the API.
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 8000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const known = order ?? preview
  const title = known ? orderLabel(known) : reference
  const created = known?.shopify_created_at
  const method = known ? orderPaymentMethod(known) : ''
  // Who it is for: the customer's name and, when the addresses name one, their company.
  const who = [
    known ? orderCustomer(known)?.name : null,
    order?.shipping_address?.company?.trim() || order?.billing_address?.company?.trim(),
  ]
    .filter(Boolean)
    .join(' · ')

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'shipping', label: 'Shipping' },
    ...(order
      ? [
          {
            id: 'attributes' as const,
            label: 'Notes & Tracking',
            count: notesCount(order) || undefined,
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
    <article className="border-border bg-bg overflow-hidden rounded-xl border">
      <header className="flex flex-col gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="bg-accent-tint text-accent inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          >
            <OrdersIcon width={18} height={18} />
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="m-0 text-base leading-snug font-bold break-words sm:text-lg">
              Order #{title}
            </h1>
            {details.isRefreshing && (
              <span className="text-text-muted text-[0.72rem]" role="status">
                Updating…
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to list"
            className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[0.78rem] font-semibold transition-colors"
          >
            <ArrowLeftIcon width={14} height={14} />
            <span className="hidden sm:inline" aria-hidden="true">
              Back to list
            </span>
          </button>
        </div>

        {known && (
          <dl className="border-border m-0 flex flex-wrap gap-x-8 gap-y-2.5 border-t pt-3">
            {(known.financial_status || known.cancelled_at) && (
              <HeaderFact label="Payment status">
                {known.financial_status && (
                  <Badge tone={financialTone(known.financial_status)}>
                    {humanize(known.financial_status)}
                  </Badge>
                )}
                {known.cancelled_at && <Badge tone="danger">Cancelled</Badge>}
              </HeaderFact>
            )}
            {known.fulfillment_status && (
              <HeaderFact label="Fulfillment status">
                <Badge tone={fulfillmentTone(known.fulfillment_status)}>
                  {humanize(known.fulfillment_status)}
                </Badge>
              </HeaderFact>
            )}
            {method && <HeaderFact label="Payment method">{method}</HeaderFact>}
            {created && (
              <HeaderFact label="Order date">{formatDateTime(created)}</HeaderFact>
            )}
            {who && <HeaderFact label="Customer">{who}</HeaderFact>}
            {known.shop?.name && <HeaderFact label="Store">{known.shop.name}</HeaderFact>}
          </dl>
        )}
      </header>

      {notice && (
        <div className="px-4 pb-3">
          <FormMessage tone="success">{notice}</FormMessage>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Order sections"
        className="border-border flex [scrollbar-width:none] gap-0.5 overflow-x-auto border-y px-2 [&::-webkit-scrollbar]:hidden"
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
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-2.5 text-[0.8rem] font-semibold whitespace-nowrap transition-colors ${
                selected
                  ? 'border-accent text-text'
                  : 'text-text-muted hover:text-text border-transparent'
              }`}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="bg-surface text-text-muted border-border rounded-full border px-1.5 text-[0.62rem] leading-4 font-bold">
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
        className="bg-surface p-3"
      >
        {tab === 'overview' && (
          <OrderOverviewPanel
            order={order}
            preview={preview}
            reference={reference}
            shop={shop}
            onSaved={(message) => setNotice(message || 'Order updated.')}
          />
        )}
        {tab !== 'overview' && !order && <DetailSkeleton />}
        {order && tab === 'shipping' && <OrderShippingPanel order={order} />}
        {order && tab === 'attributes' && <OrderNotesPanel order={order} />}
        {order && tab === 'events' && <OrderEventsPanel order={order} />}
      </div>
    </article>
  )
}
