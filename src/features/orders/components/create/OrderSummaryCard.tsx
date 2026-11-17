import { formatPrice } from '../../../../lib/format.ts'
import { orderTotals, PAYMENT_LABELS, type OrderDraft } from '../../utils/orderDraft.ts'
import { CARD, CHIP, Thumb } from './formParts.tsx'

/**
 * "Order Summary", beside the first three steps and in view while the form scrolls: the chosen
 * items with their quantity, unit price and line total, then shipping, the discount codes and the
 * estimated total — all of it follows what is typed. Discount codes and tax are worked out by the
 * store, so the total is an estimate (before them).
 */
export function OrderSummaryCard({
  draft,
  currency,
}: {
  draft: OrderDraft
  currency: string | null
}) {
  const totals = orderTotals(draft)
  const muted = 'text-text-muted m-0 text-[0.8rem]'
  return (
    <aside
      aria-label="Order Summary"
      className={`${CARD} flex flex-col gap-4 p-4 lg:sticky lg:top-0`}
    >
      <h3 className="text-[1rem] font-bold">Order Summary</h3>

      {draft.lines.length === 0 ? (
        <p className={muted}>No items yet.</p>
      ) : (
        <ul className="m-0 flex max-h-72 list-none flex-col gap-3 overflow-y-auto p-0">
          {draft.lines.map((line) => {
            const quantity = Number.parseInt(line.quantity, 10)
            const price = Number.parseFloat(line.price)
            const lineTotal =
              Number.isFinite(quantity) && Number.isFinite(price)
                ? price * quantity
                : null
            return (
              <li key={line.key} className="flex items-start gap-3">
                <Thumb url={line.imageUrl} alt="" />
                <div className="flex min-w-0 flex-1 flex-col text-[0.82rem]">
                  <span className="font-semibold break-words">{line.productTitle}</span>
                  {line.variantTitle && (
                    <span className="text-text-muted break-words">
                      {line.variantTitle}
                    </span>
                  )}
                  <span className="text-text-muted tabular-nums">
                    {line.quantity || '—'} × {formatPrice(line.price, currency)}
                  </span>
                </div>
                <span className="shrink-0 text-[0.82rem] font-semibold tabular-nums">
                  {lineTotal === null ? '—' : formatPrice(lineTotal, currency)}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <dl className="border-border m-0 flex flex-col gap-2 border-t pt-3 text-[0.83rem]">
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Subtotal ({totals.items})</dt>
          <dd className="m-0 tabular-nums">{formatPrice(totals.subtotal, currency)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">
            Shipping{draft.shippingTitle.trim() ? ` · ${draft.shippingTitle.trim()}` : ''}
          </dt>
          <dd className="m-0 tabular-nums">{formatPrice(totals.shipping, currency)}</dd>
        </div>
        {draft.discountCodes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Discount</dt>
              <dd className="text-text-muted m-0">Worked out by the store</dd>
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {draft.discountCodes.map((code) => (
                <li key={code} className={`${CHIP} pr-2.5`}>
                  {code}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Payment</dt>
          <dd className="m-0">{PAYMENT_LABELS[draft.paymentStatus]}</dd>
        </div>
      </dl>

      <div className="bg-accent-tint flex items-center justify-between gap-3 rounded-lg px-4 py-3">
        <span className="text-[0.92rem] font-semibold">Estimated total</span>
        <span className="text-accent text-[1.25rem] font-bold tabular-nums">
          {formatPrice(totals.total, currency)}
        </span>
      </div>
      <p className={`${muted} text-[0.75rem]`}>
        {totals.complete
          ? 'Before discounts and tax, which the store works out when the order is made.'
          : 'A line has no usable quantity yet, so it is left out of the total.'}
      </p>
    </aside>
  )
}
