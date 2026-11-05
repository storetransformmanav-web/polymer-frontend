import { Fragment } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { BoxesIcon, CheckCircleIcon, OrdersIcon } from '../../../components/ui/icons.tsx'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { formatDateTime, formatPrice } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { fulfillmentTone, humanize } from '../utils/format.ts'
import {
  fulfillmentDate,
  fulfillmentStatus,
  fulfillmentTracking,
  itemsToShip,
} from '../utils/tracking.ts'
import { EmptyNote, MiniCard, Row, Rows } from './OrderCompact.tsx'

/** Fields of a fulfillment that are ids or internals, or already shown as their own row. */
const HIDDEN_KEY =
  /(^|_)(id|ids|raw|receipt)$|_id$|^tracking|^admin_graphql|^name$|^status$|^shipment_status$|^(shopify_)?created_at$|^updated_at$|^(company|carrier)$/i

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

/**
 * The other plain fields of a fulfillment: dates as dates, yes/no as words, the number of items
 * instead of the list. Its shape is not documented, so nothing is assumed — ids and anything
 * nested are left out.
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
 * The Shipping tab, in small sections: **Delivery** (fulfillment status, shipping charged, items
 * to ship, number of fulfillments), **Shipping method** (name, description, cost) and
 * **Fulfillments** — each with its status, carrier, tracking number and link, and date. The
 * addresses are on the Overview.
 */
export function OrderShippingPanel({ order }: { order: OrderDetail }) {
  const money = (value: string | null | undefined) =>
    value === null || value === undefined || value === ''
      ? null
      : formatPrice(value, order.currency)
  const toShip = itemsToShip(order)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <MiniCard title="Delivery" icon={OrdersIcon}>
          <Rows>
            <Row label="Fulfillment status">
              {order.fulfillment_status && (
                <Badge tone={fulfillmentTone(order.fulfillment_status)}>
                  {humanize(order.fulfillment_status)}
                </Badge>
              )}
            </Row>
            <Row label="Shipping charged">{money(order.total_shipping)}</Row>
            <Row label="Items to ship">{toShip > 0 ? String(toShip) : null}</Row>
            <Row label="Fulfillments">{String(order.fulfillments.length)}</Row>
          </Rows>
        </MiniCard>

        <MiniCard
          title="Shipping method"
          icon={OrdersIcon}
          count={order.shipping_lines.length}
        >
          {order.shipping_lines.length === 0 ? (
            <EmptyNote>No shipping method.</EmptyNote>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {order.shipping_lines.map((line, index) => {
                const paid = line.discounted_price ?? line.price
                const discounted =
                  line.discounted_price !== null &&
                  line.discounted_price !== undefined &&
                  line.price !== null &&
                  line.price !== undefined &&
                  Number(line.discounted_price) < Number(line.price)
                return (
                  <li
                    key={`${line.code}-${index}`}
                    className="border-border flex items-start justify-between gap-3 border-b py-1.5 text-[0.78rem] last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">{line.title || 'Shipping'}</span>
                      <span className="text-text-muted text-[0.7rem] break-words">
                        {[line.source, line.code].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="font-semibold tabular-nums">
                        {money(paid) ?? '—'}
                      </span>
                      {discounted && (
                        <span className="text-text-muted text-[0.7rem] line-through">
                          {money(line.price)}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </MiniCard>
      </div>

      <MiniCard
        title="Fulfillments"
        icon={CheckCircleIcon}
        count={order.fulfillments.length}
      >
        {order.fulfillments.length === 0 ? (
          <EmptyNote>Nothing has been fulfilled yet.</EmptyNote>
        ) : (
          <ul className="m-0 grid list-none gap-2.5 p-0 py-1 md:grid-cols-2">
            {order.fulfillments.map((record, index) => {
              const name =
                typeof record.name === 'string' && record.name.trim()
                  ? record.name.trim()
                  : `Fulfillment ${index + 1}`
              const status = fulfillmentStatus(record)
              const date = fulfillmentDate(record)
              const parcels = fulfillmentTracking([record])
              const carrier =
                parcels.find((parcel) => parcel.company)?.company ??
                (typeof record.tracking_company === 'string'
                  ? record.tracking_company
                  : null)
              const fields = otherFields(record)
              return (
                <li
                  key={`${name}-${index}`}
                  className="border-border bg-surface/40 min-w-0 rounded-lg border px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2 py-1">
                    <span className="flex min-w-0 items-center gap-1.5 text-[0.8rem] font-semibold">
                      <BoxesIcon
                        width={13}
                        height={13}
                        className="text-accent shrink-0"
                      />
                      <span className="truncate">{name}</span>
                    </span>
                    {status && (
                      <Badge tone={statusTone(status)}>{humanize(status)}</Badge>
                    )}
                  </div>
                  <Rows>
                    <Row label="Carrier">{carrier}</Row>
                    {parcels.length === 0 && <Row label="Tracking number">{null}</Row>}
                    {parcels.map((parcel) => {
                      const link = safeUrl(parcel.url)
                      return (
                        <Fragment key={parcel.key}>
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
                          <Row label="Tracking URL">
                            {link && (
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent break-all hover:underline"
                              >
                                {link}
                              </a>
                            )}
                          </Row>
                        </Fragment>
                      )
                    })}
                    <Row label="Fulfillment date">
                      {date ? formatDateTime(date) : null}
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
    </div>
  )
}
