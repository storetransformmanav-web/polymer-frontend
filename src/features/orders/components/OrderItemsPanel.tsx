import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { BoxesIcon } from '../../../components/ui/icons.tsx'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { fulfillmentTone, humanize } from '../utils/format.ts'
import {
  EmptyNote,
  MINI_ROW,
  MINI_TD,
  MINI_TH,
  MiniCard,
  MiniTable,
} from './OrderCompact.tsx'

type LineItem = OrderDetail['line_items'][number]

/** A product's picture, small — only an http(s) address is ever used, else a placeholder. */
function Thumb({ item }: { item: LineItem }) {
  const image = safeUrl(item.image_url)
  return (
    <span className="bg-surface border-border flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border">
      {image ? (
        <img
          src={image}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <BoxesIcon width={14} height={14} className="text-text-muted" />
      )}
    </span>
  )
}

/** The product's name, a link to its page in the CRM when the order knows which product it is. */
function ItemName({ item }: { item: LineItem }) {
  const title = item.title || 'Item'
  return item.product_id ? (
    <Link
      to={`/products/${encodeURIComponent(item.product_id)}`}
      className="text-text hover:text-accent block truncate font-semibold hover:underline"
      title={title}
    >
      {title}
    </Link>
  ) : (
    <span className="block truncate font-semibold" title={title}>
      {title}
    </span>
  )
}

const lineTotal = (item: LineItem) => item.discounted_total ?? item.original_total

/**
 * The Overview's **Items** card: every line as one compact row — thumbnail, name, variant and
 * SKU, quantity × price, and the line's total. The full table is on the Items tab.
 */
export function OrderItemsSummary({ order }: { order: OrderDetail }) {
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? '—' : formatPrice(value, order.currency)

  return (
    <MiniCard title="Items" icon={BoxesIcon} count={order.line_items.length}>
      {order.line_items.length === 0 ? (
        <EmptyNote>No items on this order.</EmptyNote>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {order.line_items.map((item) => (
            <li
              key={item.id}
              className="border-border flex items-center gap-2.5 border-b py-1.5 last:border-b-0"
            >
              <Thumb item={item} />
              <span className="flex min-w-0 flex-1 flex-col text-[0.78rem]">
                <ItemName item={item} />
                <span className="text-text-muted truncate text-[0.7rem]">
                  {[item.variant_title, item.sku].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              <span className="text-text-muted shrink-0 text-[0.74rem] tabular-nums">
                {item.quantity ?? '—'} × {money(item.price)}
              </span>
              <span className="w-20 shrink-0 text-right text-[0.8rem] font-semibold tabular-nums">
                {money(lineTotal(item))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </MiniCard>
  )
}

/**
 * The **Items** tab: one compact table — product (picture, name, variant, vendor), SKU, quantity,
 * price, discount, total and fulfillment — with a line under it for the total quantity and the
 * order's value.
 */
export function OrderItemsPanel({ order }: { order: OrderDetail }) {
  if (order.line_items.length === 0) {
    return (
      <MiniCard title="Items" icon={BoxesIcon} count={0}>
        <EmptyNote>No items on this order.</EmptyNote>
      </MiniCard>
    )
  }
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? '—' : formatPrice(value, order.currency)
  const quantity = order.line_items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)

  return (
    <div className="flex flex-col gap-2">
      <MiniTable>
        <thead>
          <tr>
            <th className={MINI_TH}>Product</th>
            <th className={MINI_TH}>SKU</th>
            <th className={`${MINI_TH} text-right`}>Quantity</th>
            <th className={`${MINI_TH} text-right`}>Price</th>
            <th className={`${MINI_TH} text-right`}>Discount</th>
            <th className={`${MINI_TH} text-right`}>Total</th>
            <th className={MINI_TH}>Fulfillment</th>
          </tr>
        </thead>
        <tbody>
          {order.line_items.map((item) => (
            <tr key={item.id} className={`${MINI_ROW} even:bg-surface/50`}>
              <td className={MINI_TD}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Thumb item={item} />
                  <span className="flex min-w-0 flex-col">
                    <ItemName item={item} />
                    {(item.variant_title || item.vendor) && (
                      <span className="text-text-muted truncate text-[0.7rem]">
                        {[item.variant_title, item.vendor].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                </span>
              </td>
              <td className={`${MINI_TD} font-mono text-[0.72rem] break-all`}>
                {item.sku || '—'}
              </td>
              <td className={`${MINI_TD} text-right tabular-nums`}>
                {item.quantity ?? '—'}
              </td>
              <td className={`${MINI_TD} text-right tabular-nums`}>
                {money(item.price)}
              </td>
              <td className={`${MINI_TD} text-right tabular-nums`}>
                {money(item.total_discount)}
              </td>
              <td className={`${MINI_TD} text-right font-semibold tabular-nums`}>
                {money(lineTotal(item))}
              </td>
              <td className={MINI_TD}>
                {item.fulfillment_status ? (
                  <Badge tone={fulfillmentTone(item.fulfillment_status)}>
                    {humanize(item.fulfillment_status)}
                  </Badge>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </MiniTable>

      <p className="text-text-muted m-0 flex flex-wrap justify-end gap-x-4 gap-y-0.5 px-1 text-[0.78rem]">
        <span>
          Total quantity{' '}
          <strong className="text-text font-semibold tabular-nums">{quantity}</strong>
        </span>
        <span>
          Order value{' '}
          <strong className="text-text font-semibold tabular-nums">
            {money(order.total_price)}
          </strong>
        </span>
      </p>
    </div>
  )
}
