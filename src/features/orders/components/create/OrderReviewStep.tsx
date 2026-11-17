import type { ComponentType, ReactNode } from 'react'
import {
  CreditCardIcon,
  PencilIcon,
  ProductsIcon,
  StoreIcon,
  TruckIcon,
  type IconProps,
} from '../../../../components/ui/icons.tsx'
import { countryOptions } from '../../../../lib/countries.ts'
import { formatPrice } from '../../../../lib/format.ts'
import {
  addressStarted,
  orderTotals,
  PAYMENT_LABELS,
  type OrderDraft,
  type OrderStepId,
} from '../../utils/orderDraft.ts'
import { CARD, CHIP, TEXT_BUTTON, Thumb } from './formParts.tsx'

const TH = 'text-text px-3 py-2.5 text-[0.76rem] font-semibold whitespace-nowrap'
const TD = 'border-border border-t px-3 py-2.5 align-middle text-[0.85rem]'

/** A read-only card of the review, with a button that goes back to the step it comes from. */
function ReviewCard({
  icon: Icon,
  title,
  step,
  onEdit,
  children,
}: {
  icon: ComponentType<IconProps>
  title: string
  step: OrderStepId
  onEdit: (step: OrderStepId) => void
  children: ReactNode
}) {
  return (
    <section aria-label={title} className={`${CARD} flex flex-col gap-3 p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-[1rem] font-semibold">
          <Icon width={18} height={18} className="text-accent" />
          {title}
        </h3>
        <button
          type="button"
          aria-label={`Edit ${title.toLowerCase()}`}
          onClick={() => onEdit(step)}
          className={TEXT_BUTTON}
        >
          <PencilIcon width={14} height={14} />
          Edit
        </button>
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-x-4 text-[0.85rem]">
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  )
}

const NONE = <span className="text-text-muted">Not set</span>

/**
 * The last step: everything that will be sent, laid out to read — store and customer, the items
 * with their totals, delivery, payment and details — each card with an Edit button that goes
 * back to its step. Nothing here can be changed; **Create order** is in the wizard's footer.
 */
export function OrderReviewStep({
  draft,
  storeName,
  currency,
  onEdit,
}: {
  draft: OrderDraft
  storeName: string
  currency: string | null
  onEdit: (step: OrderStepId) => void
}) {
  const totals = orderTotals(draft)
  const { customer, address } = draft
  const customerName = [customer.firstName, customer.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
  const hasAddress = addressStarted(address)
  const country = countryOptions().find(
    (option) => option.value.toLowerCase() === address.countryCode.trim().toLowerCase(),
  )?.label
  const addressName = [address.firstName, address.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <ReviewCard
          icon={StoreIcon}
          title="Store and customer"
          step="order"
          onEdit={onEdit}
        >
          <dl className="m-0 flex flex-col gap-2">
            <Row label="Store">{storeName || NONE}</Row>
            {customerName && <Row label="Customer">{customerName}</Row>}
            {customer.email.trim() && <Row label="Email">{customer.email.trim()}</Row>}
            {customer.phone.trim() && <Row label="Phone">{customer.phone.trim()}</Row>}
            {draft.note.trim() && (
              <Row label="Notes">
                <span className="whitespace-pre-wrap">{draft.note.trim()}</span>
              </Row>
            )}
          </dl>
          {!customerName && !customer.email.trim() && (
            <p className="text-text-muted m-0 text-[0.8rem]">
              No customer — the order will be made without one.
            </p>
          )}
        </ReviewCard>

        <ReviewCard icon={TruckIcon} title="Delivery" step="addresses" onEdit={onEdit}>
          <dl className="m-0 flex flex-col gap-2">
            <Row label="Method">{draft.shippingTitle.trim() || NONE}</Row>
            {draft.shippingTitle.trim() && (
              <Row label="Cost">{formatPrice(totals.shipping, currency)}</Row>
            )}
            <Row label="Address">
              {hasAddress ? (
                <span className="flex flex-col">
                  {addressName && <span className="font-medium">{addressName}</span>}
                  {address.company.trim() && <span>{address.company.trim()}</span>}
                  <span>{address.address1.trim()}</span>
                  <span>
                    {[address.city.trim(), address.zip.trim()].filter(Boolean).join(' ')}
                  </span>
                  <span>{country ?? address.countryCode.trim().toUpperCase()}</span>
                  {address.phone.trim() && (
                    <span className="text-text-muted">{address.phone.trim()}</span>
                  )}
                </span>
              ) : (
                NONE
              )}
            </Row>
          </dl>
        </ReviewCard>
      </div>

      <ReviewCard
        icon={ProductsIcon}
        title={`Items (${draft.lines.length})`}
        step="items"
        onEdit={onEdit}
      >
        <div className="border-border overflow-x-auto rounded-lg border">
          <table
            aria-label="Items to order"
            className="w-full min-w-[540px] border-collapse"
          >
            <thead className="bg-table-head">
              <tr>
                <th className={`${TH} text-left`}>Product</th>
                <th className={`${TH} w-20 text-center`}>Qty</th>
                <th className={`${TH} w-28 text-right`}>Unit price</th>
                <th className={`${TH} w-28 text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line) => {
                const quantity = Number.parseInt(line.quantity, 10)
                const price = Number.parseFloat(line.price)
                const total =
                  Number.isFinite(quantity) && Number.isFinite(price)
                    ? price * quantity
                    : null
                const name = line.productTitle
                return (
                  <tr key={line.key}>
                    <td className={TD}>
                      <div className="flex items-center gap-3">
                        <Thumb url={line.imageUrl} alt="" />
                        <div className="flex min-w-0 flex-col">
                          <span className="font-semibold break-words">{name}</span>
                          <span className="text-text-muted text-[0.76rem]">
                            {[line.variantTitle, line.sku ? `SKU: ${line.sku}` : '']
                              .filter(Boolean)
                              .join(' · ') || 'Default variant'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={`${TD} text-center tabular-nums`}>{line.quantity}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {formatPrice(line.price, currency)}
                    </td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>
                      {total === null ? '—' : formatPrice(total, currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ReviewCard>

      <div className="grid items-start gap-5 md:grid-cols-2">
        <ReviewCard
          icon={CreditCardIcon}
          title="Payment and details"
          step="order"
          onEdit={onEdit}
        >
          <dl className="m-0 flex flex-col gap-2">
            <Row label="Status">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold ${
                  draft.paymentStatus === 'paid'
                    ? 'bg-accent-tint text-accent'
                    : 'bg-warning-bg text-text'
                }`}
              >
                {PAYMENT_LABELS[draft.paymentStatus]}
              </span>
            </Row>
            <Row label="Method">{draft.paymentMethod.trim() || NONE}</Row>
            <Row label="Discount codes">
              {draft.discountCodes.length > 0 ? (
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {draft.discountCodes.map((code) => (
                    <li key={code} className={`${CHIP} pr-2.5`}>
                      {code}
                    </li>
                  ))}
                </ul>
              ) : (
                NONE
              )}
            </Row>
            <Row label="Tags">
              {draft.tags.length > 0 ? (
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {draft.tags.map((tag) => (
                    <li key={tag} className={`${CHIP} pr-2.5`}>
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : (
                NONE
              )}
            </Row>
          </dl>
        </ReviewCard>

        <section
          aria-label="Order total"
          className={`${CARD} flex flex-col gap-3 p-4 sm:p-5`}
        >
          <h3 className="text-[1rem] font-semibold">Order total</h3>
          <dl className="m-0 flex flex-col gap-2 text-[0.85rem]">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Items ({totals.items})</dt>
              <dd className="m-0 tabular-nums">
                {formatPrice(totals.subtotal, currency)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Shipping</dt>
              <dd className="m-0 tabular-nums">
                {formatPrice(totals.shipping, currency)}
              </dd>
            </div>
            {draft.discountCodes.length > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Discount</dt>
                <dd className="text-text-muted m-0">Worked out by the store</dd>
              </div>
            )}
          </dl>
          <div className="bg-accent-tint flex items-center justify-between gap-3 rounded-lg px-4 py-3">
            <span className="text-[0.95rem] font-semibold">Estimated total</span>
            <span className="text-accent text-[1.3rem] font-bold tabular-nums">
              {formatPrice(totals.total, currency)}
            </span>
          </div>
          <p className="text-text-muted m-0 text-[0.76rem]">
            {totals.complete
              ? 'Before discounts and tax, which the store works out when the order is made.'
              : 'A line has no price or quantity yet, so it is left out of the total.'}
          </p>
        </section>
      </div>
    </div>
  )
}
