import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLinkedState } from '../../../hooks/useLinkedState.ts'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import {
  DetailsHeader,
  HeaderChip,
  HeaderTile,
  StatusPill,
} from '../../../components/ui/DetailsHeader.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  BarcodeIcon,
  CalendarIcon,
  MailIcon,
  OrdersIcon,
  StoreIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { formatDateTime } from '../../../lib/format.ts'
import { useOrderDetails } from '../hooks/useOrderDetails.ts'
import { customerPath, orderCustomer, orderLabel, orderStatus } from '../utils/format.ts'
import { notesCount } from '../utils/tracking.ts'
import { OrderDetailsPanel } from './OrderDetailsPanel.tsx'
import {
  EditableOrderItems,
  OrderEmailCell,
  type OrderEditContext,
} from './OrderInlineEdits.tsx'
import { OrderNotesPanel } from './OrderNotesPanel.tsx'
import { OrderTimelinePanel } from './OrderTimelinePanel.tsx'

type TabId = 'details' | 'items' | 'attributes' | 'events'

interface OrderDetailsViewProps {
  /** The order number from the address (17516). */
  reference: string
  /** The order's store key from the address, when it has one. */
  shop: string | null
  onBack: () => void
  /** What the back button says; "Back to list" by default. */
  backLabel?: string
}

/**
 * An order's full details, shown in place of the list (same page, no overlay). A header card —
 * the order number and its overall status, then its date, customer and store, and under them a
 * summary strip: payment status, fulfillment status, payment method, total items, number of
 * fulfillments and shipping charged — then the tabs **Details**, **Notes & Tracking** and
 * **Timeline**. The header and summary draw straight from the list row while the full record
 * loads, so nothing waits on the network when you come from the list.
 */
export function OrderDetailsView({
  reference,
  shop,
  onBack,
  backLabel = 'Back to list',
}: OrderDetailsViewProps) {
  const details = useOrderDetails(reference, shop)
  const { order, preview } = details
  const [tab, setTab] = useState<TabId>('details')
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
  const status = known ? orderStatus(known) : null
  // Who it is for: the customer's name — a link to their page when they are in the CRM — and,
  // when the addresses name one, their company. (The Customer card doesn't repeat the name.)
  const linkedState = useLinkedState()
  const customerName = known ? orderCustomer(known)?.name : null
  const customerLink = known ? customerPath(known) : null
  const company =
    order?.shipping_address?.company?.trim() || order?.billing_address?.company?.trim()

  // The summary's figures: the quantities on the order's lines (the list row's count until the
  // lines arrive), the number of fulfillments, and what shipping cost.
  const lineQuantity = order
    ? order.line_items.reduce((sum, line) => sum + (line.quantity ?? 0), 0)
    : 0
  const totalItems = lineQuantity > 0 ? lineQuantity : (known?.items_count ?? 0)
  // The order's email (editable in place, like it was in the Customer card) and Shopify ID.
  const email = known?.email?.trim() || known?.customer?.email?.trim() || ''
  const shopifyId = known?.shopify_id != null ? String(known.shopify_id) : ''
  const context: OrderEditContext | null = order
    ? {
        order,
        reference,
        shop,
        onSaved: (message) => setNotice(message || 'Order updated.'),
      }
    : null

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'details', label: 'Overview' },
    ...(order ? [{ id: 'items' as const, label: 'Items', count: totalItems }] : []),
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
            {backLabel}
          </button>
        </div>
      </section>
    )
  }

  return (
    <article className="border-border bg-bg flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1">
      <DetailsHeader
        visual={
          <HeaderTile>
            <OrdersIcon width={26} height={26} />
          </HeaderTile>
        }
        title={<>Order #{title}</>}
        status={
          <>
            {status && <StatusPill label={status.label} tone={status.tone} />}
            {details.isRefreshing && (
              <span className="text-text-muted text-[0.72rem]" role="status">
                Updating…
              </span>
            )}
          </>
        }
        chips={
          known && (
            <>
              {created && (
                <HeaderChip icon={CalendarIcon} label="Order date">
                  {formatDateTime(created)}
                </HeaderChip>
              )}
              {(customerName || company) && (
                <HeaderChip icon={UsersIcon} label="Customer">
                  {customerName &&
                    (customerLink ? (
                      <Link
                        to={customerLink}
                        state={linkedState(customerName)}
                        title={`Open ${customerName}`}
                        className="text-accent font-semibold hover:underline"
                      >
                        {customerName}
                      </Link>
                    ) : (
                      customerName
                    ))}
                  {customerName && company && ' · '}
                  {company}
                </HeaderChip>
              )}
              {known.shop?.name && (
                <HeaderChip icon={StoreIcon} label="Store">
                  {known.shop.name}
                </HeaderChip>
              )}
              {email && (
                <HeaderChip icon={MailIcon} label="Email">
                  <span className="flex items-center gap-1.5 break-all">
                    {context ? (
                      <OrderEmailCell context={context} display={email} />
                    ) : (
                      email
                    )}
                    <CopyButton value={email} label="Copy email" />
                  </span>
                </HeaderChip>
              )}
              {shopifyId && (
                <HeaderChip icon={BarcodeIcon} label="Shopify ID">
                  <span className="flex items-center gap-1.5">
                    {shopifyId}
                    <CopyButton value={shopifyId} label="Copy Shopify ID" />
                  </span>
                </HeaderChip>
              )}
            </>
          )
        }
        onBack={onBack}
        backLabel={backLabel}
      />

      {notice && (
        <div className="shrink-0 px-4 pb-3 sm:px-6">
          <FormMessage tone="success">{notice}</FormMessage>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Order sections"
        className="border-border flex shrink-0 [scrollbar-width:none] gap-1 overflow-x-auto border-y px-2 sm:px-4 [&::-webkit-scrollbar]:hidden"
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
        className="bg-surface p-3 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {tab === 'details' && (
          <OrderDetailsPanel
            order={order}
            preview={preview}
            reference={reference}
            shop={shop}
            onSaved={(message) => setNotice(message || 'Order updated.')}
          />
        )}
        {tab !== 'details' && !order && <DetailSkeleton />}
        {context && tab === 'items' && <EditableOrderItems context={context} />}
        {order && tab === 'attributes' && <OrderNotesPanel order={order} />}
        {order && tab === 'events' && <OrderTimelinePanel order={order} />}
      </div>
    </article>
  )
}
