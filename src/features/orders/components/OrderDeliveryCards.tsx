import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { BoxesIcon, TruckIcon } from '../../../components/ui/icons.tsx'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { formatDateTime, formatPrice } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { humanize } from '../utils/format.ts'
import {
  fulfillmentDate,
  fulfillmentStatus,
  fulfillmentTracking,
  itemsToShip,
} from '../utils/tracking.ts'
import { EmptyNote, MiniCard, Row, Rows } from './OrderCompact.tsx'
import {
  OrderDeliveryCostCell,
  OrderDeliveryMethodCell,
  type OrderEditContext,
} from './OrderInlineEdits.tsx'

/** Fields of a fulfillment that are ids or internals, or already shown as their own row. */
const HIDDEN_KEY =
  /(^|_)(id|ids|raw|receipt)$|_id$|^tracking|^admin_graphql|^name$|^status$|^shipment_status$|^(shopify_)?created_at$|^(shopify_)?updated_at$|^(company|carrier|service)$/i

/** The status of a fulfillment as a pill tone. */
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const word = status.toLowerCase()
  if (['success', 'fulfilled', 'delivered', 'complete', 'completed'].includes(word)) {
    return 'success'
  }
  if (['cancelled', 'canceled', 'failure', 'failed', 'error'].includes(word)) {
    return 'danger'
  }
  if (['pending', 'open', 'in_transit', 'out_for_delivery', 'partial'].includes(word)) {
    return 'warning'
  }
  return 'neutral'
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

/**
 * The other plain fields of a fulfillment: dates as dates, yes/no as words, the number of items
 * instead of the list. Its shape is not documented, so nothing is assumed — ids and anything
 * nested are left out, and so is whatever already has a row of its own.
 */
function otherFields(record: Record<string, unknown>): [string, string][] {
  return Object.entries(record).flatMap(([key, value]): [string, string][] => {
    if (Array.isArray(value)) {
      return key === 'line_items' || key === 'items'
        ? [['Items', String(value.length)]]
        : []
    }
    if (value === null || value === undefined || value === '') return []
    if (HIDDEN_KEY.test(key)) return []
    if (typeof value === 'boolean') return [[humanize(key), value ? 'Yes' : 'No']]
    if (typeof value === 'number') return [[humanize(key), String(value)]]
    if (typeof value === 'string') {
      return [[humanize(key), /_at$/.test(key) ? formatDateTime(value) : humanize(value)]]
    }
    return []
  })
}

/**
 * **Shipping method**: the delivery method and what it cost (both edited in place — double-click
 * them or use their small pencil), the store's ID for the method (its source and code) and how
 * many items are still to ship. A discounted price shows the original struck out under it.
 */
export function ShippingMethodCard({ context }: { context: OrderEditContext }) {
  const { order } = context
  const methods = order.shipping_lines.map((line) => line.title).filter(Boolean)
  const methodIds = order.shipping_lines
    .map((line) => [line.source, line.code].filter(Boolean).join(' · '))
    .filter(Boolean)
  const toShip = itemsToShip(order)
  const charged =
    order.total_shipping === null || order.total_shipping === undefined
      ? '—'
      : formatPrice(order.total_shipping, order.currency)
  const first = order.shipping_lines[0]
  const original =
    first &&
    first.price !== null &&
    first.price !== undefined &&
    first.discounted_price !== null &&
    first.discounted_price !== undefined &&
    Number(first.discounted_price) < Number(first.price)
      ? formatPrice(first.price, order.currency)
      : null

  return (
    <MiniCard title="Shipping method" icon={TruckIcon}>
      <Rows>
        <Row label="Delivery method">
          <OrderDeliveryMethodCell
            context={context}
            display={methods.length > 0 ? methods.join(', ') : '—'}
          />
        </Row>
        <Row label="Shipping method ID">
          {methodIds.length > 0 ? (
            <span className="text-text-muted text-[0.72rem] break-words">
              {methodIds.join(', ')}
            </span>
          ) : null}
        </Row>
        <Row label="Shipping charged">
          <span className="flex flex-col items-end">
            <OrderDeliveryCostCell context={context} display={charged} />
            {original && (
              <span className="text-text-muted text-[0.7rem] line-through">
                {original}
              </span>
            )}
          </span>
        </Row>
        <Row label="Items to ship">{String(toShip)}</Row>
      </Rows>
    </MiniCard>
  )
}

/**
 * **Fulfillments**: a block for each — its id (the store's name for it, `#17915-F1`) and status —
 * with the carrier, tracking number (copyable) and link, the date, the service and when Shopify
 * last updated it. Nothing fulfilled yet says so.
 */
export function FulfillmentsCard({ order }: { order: OrderDetail }) {
  return (
    <MiniCard title="Fulfillments" icon={BoxesIcon} count={order.fulfillments.length}>
      {order.fulfillments.length === 0 ? (
        <EmptyNote>Nothing has been fulfilled yet.</EmptyNote>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {order.fulfillments.map((record, index) => {
            const name = text(record.name) ?? `Fulfillment ${index + 1}`
            const status = fulfillmentStatus(record)
            const date = fulfillmentDate(record)
            const updated = text(record.shopify_updated_at) ?? text(record.updated_at)
            const service = text(record.service)
            const parcels = fulfillmentTracking([record])
            const carrier =
              parcels.find((parcel) => parcel.company)?.company ??
              text(record.tracking_company) ??
              text(record.carrier)
            const fields = otherFields(record)
            return (
              <li
                key={`${name}-${index}`}
                className="border-border bg-surface/40 min-w-0 rounded-lg border px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 py-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-[0.85rem] font-semibold">
                    <BoxesIcon width={14} height={14} className="text-accent shrink-0" />
                    <span className="truncate">{name}</span>
                  </span>
                  {status && <Badge tone={statusTone(status)}>{humanize(status)}</Badge>}
                </div>
                <Rows>
                  <Row label="Carrier">{carrier}</Row>
                  {parcels.length === 0 && <Row label="Tracking number">{null}</Row>}
                  {parcels.map((parcel) => {
                    const link = safeUrl(parcel.url)
                    return (
                      <div key={parcel.key} className="contents">
                        <Row label="Tracking number">
                          {parcel.number && (
                            <span className="flex items-center justify-end gap-1 font-mono text-[0.74rem] break-all">
                              {parcel.number}
                              <CopyButton
                                value={parcel.number}
                                label="Copy tracking number"
                              />
                            </span>
                          )}
                        </Row>
                        {link && (
                          <Row label="Tracking URL">
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent break-all hover:underline"
                            >
                              {link}
                            </a>
                          </Row>
                        )}
                      </div>
                    )
                  })}
                  <Row label="Fulfillment date">{date ? formatDateTime(date) : null}</Row>
                  <Row label="Service">{service ? humanize(service) : null}</Row>
                  <Row label="Shopify updated at">
                    {updated ? formatDateTime(updated) : null}
                  </Row>
                  {fields.map(([label, value]) => (
                    <Row key={label} label={label}>
                      {value}
                    </Row>
                  ))}
                </Rows>
              </li>
            )
          })}
        </ul>
      )}
    </MiniCard>
  )
}
