import { Link } from 'react-router-dom'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import { BoxesIcon } from '../../../components/ui/icons.tsx'
import type { OrderDetail, OrderListItem } from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { hasRefund } from '../utils/format.ts'
import {
  EmptyNote,
  FoldCard,
  MINI_ROW,
  MINI_TD,
  MINI_TH,
  MiniTable,
  Row,
  Rows,
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
 * What the order comes to, in a box at the right under its lines: subtotal, shipping, tax, discount
 * and the total — then the tip, what was refunded and what is left to pay, when there are any.
 * The figures are the backend's; nothing is worked out here.
 */
function OrderTotals({
  totals,
  taxesIncluded,
  tip,
  outstanding,
}: {
  totals: OrderListItem
  taxesIncluded?: boolean | null
  tip?: string | null
  outstanding?: string | null
}) {
  const money = (value: string | null | undefined) =>
    value === null || value === undefined || value === ''
      ? null
      : formatPrice(value, totals.currency)
  const isAbove0 = (value: string | null | undefined) =>
    Number.parseFloat(value ?? '0') > 0
  const discount = money(totals.total_discounts)

  return (
    <div className="flex justify-end">
      <div className="border-border bg-surface/40 w-full rounded-lg border px-3 py-1 sm:w-80">
        <Rows>
          <Row label="Subtotal">{money(totals.subtotal_price)}</Row>
          <Row label="Shipping">{money(totals.total_shipping)}</Row>
          <Row label={taxesIncluded ? 'Tax (included)' : 'Tax'}>
            {money(totals.total_tax)}
          </Row>
          <Row label="Discount">
            {discount && isAbove0(totals.total_discounts) ? `−${discount}` : discount}
          </Row>
          {isAbove0(tip) && <Row label="Tip">{money(tip)}</Row>}
          <Row label="Total price" strong>
            {money(totals.total_price)}
          </Row>
          {hasRefund(totals) && (
            <>
              <Row label="Refunded">{money(totals.total_refunded)}</Row>
              <Row label="Net payment">{money(totals.net_payment)}</Row>
            </>
          )}
          {isAbove0(outstanding) && <Row label="Outstanding">{money(outstanding)}</Row>}
        </Rows>
      </div>
    </div>
  )
}

/**
 * The Overview's **Items** card, closed to begin with: a table — product (picture, name, variant and SKU), price,
 * quantity and the line's total — with the order's totals under it. The totals draw from the list
 * row while the lines load (`items` is null then).
 */
export function OrderItemsSummary({
  items,
  totals,
  taxesIncluded,
  tip,
  outstanding,
}: {
  items: OrderDetail['line_items'] | null
  totals: OrderListItem
  taxesIncluded?: boolean | null
  tip?: string | null
  outstanding?: string | null
}) {
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? '—' : formatPrice(value, totals.currency)

  return (
    <FoldCard title="Items" icon={BoxesIcon} count={items?.length} defaultOpen={false}>
      <div className="flex flex-col gap-3 py-1.5">
        {items === null && <DetailSkeleton />}
        {items?.length === 0 && <EmptyNote>No items on this order.</EmptyNote>}
        {items && items.length > 0 && (
          <MiniTable>
            <thead>
              <tr>
                <th className={MINI_TH}>Product</th>
                <th className={`${MINI_TH} w-28 text-right`}>Price</th>
                <th className={`${MINI_TH} w-24 text-right`}>Quantity</th>
                <th className={`${MINI_TH} w-32 text-right`}>Total price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={MINI_ROW}>
                  <td className={MINI_TD}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Thumb item={item} />
                      <span className="flex min-w-0 flex-col">
                        <ItemName item={item} />
                        <span className="text-text-muted truncate text-[0.7rem]">
                          {[item.variant_title, item.sku].filter(Boolean).join(' · ') ||
                            '—'}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className={`${MINI_TD} text-right tabular-nums`}>
                    {money(item.price)}
                  </td>
                  <td className={`${MINI_TD} text-right tabular-nums`}>
                    {item.quantity ?? '—'}
                  </td>
                  <td className={`${MINI_TD} text-right font-semibold tabular-nums`}>
                    {money(lineTotal(item))}
                  </td>
                </tr>
              ))}
            </tbody>
          </MiniTable>
        )}
        <OrderTotals
          totals={totals}
          taxesIncluded={taxesIncluded}
          tip={tip}
          outstanding={outstanding}
        />
      </div>
    </FoldCard>
  )
}
