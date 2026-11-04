import { SelectField, type SelectOption } from '../../../../components/ui/SelectField.tsx'
import { SuggestInput } from '../../../../components/ui/SuggestInput.tsx'
import { formatPrice } from '../../../../lib/format.ts'
import {
  ORDER_PAYMENT_STATUSES,
  type OrderPaymentStatus,
} from '../../../../lib/api/endpoints.ts'
import {
  FIELD,
  ORDER_LIMITS,
  orderTotals,
  type OrderDraft,
  type OrderErrors,
} from '../../utils/orderDraft.ts'
import { CARD, ChipsInput, Field, FIELD_INPUT, FIELD_TEXTAREA } from './formParts.tsx'

const PAYMENT_LABELS: Record<OrderPaymentStatus, string> = {
  paid: 'Paid',
  pending: 'Payment pending',
}

const PAYMENT_OPTIONS: SelectOption[] = ORDER_PAYMENT_STATUSES.map((status) => ({
  value: status,
  label: PAYMENT_LABELS[status],
}))

/** Offered in the payment method box (any other can be typed). */
const PAYMENT_METHODS = ['Bank Transfer', 'Card', 'Cash', 'Cheque', 'Invoice', 'PayPal']

/** A block of the sidebar card: separated from the one above by a thin line. */
const BLOCK = 'border-border flex flex-col gap-3.5 border-t p-4 first:border-t-0'
const BLOCK_TITLE = 'text-[0.95rem] font-semibold'

/**
 * The sidebar card (like Add product's: blocks separated by thin lines): the store, the payment,
 * discount codes, tags and a note.
 */
export function OrderSidebarCard({
  draft,
  errors,
  update,
  shopOptions,
}: {
  draft: OrderDraft
  errors: OrderErrors
  update: (patch: Partial<OrderDraft>) => void
  shopOptions: SelectOption[]
}) {
  return (
    <section aria-label="Order details" className={`${CARD} flex flex-col`}>
      <div className={BLOCK}>
        <div className="flex flex-col gap-1.5">
          <SelectField
            id={FIELD.shop}
            label="Store"
            value={draft.shop}
            options={shopOptions}
            onChange={(shop) => update({ shop })}
          />
          {errors[FIELD.shop] ? (
            <p role="alert" className="text-danger text-[0.78rem]">
              {errors[FIELD.shop]}
            </p>
          ) : (
            <p className="text-text-muted text-[0.76rem]">
              The order is made in this store. Products and customers are found in it too.
            </p>
          )}
        </div>
      </div>

      <div className={BLOCK}>
        <h4 className={BLOCK_TITLE}>Payment</h4>
        <SelectField
          id="order-payment-status"
          label="Payment status"
          value={draft.paymentStatus}
          options={PAYMENT_OPTIONS}
          onChange={(value) => update({ paymentStatus: value as OrderPaymentStatus })}
        />
        <Field
          id={FIELD.paymentMethod}
          label="Payment method"
          error={errors[FIELD.paymentMethod]}
          optional
        >
          <SuggestInput
            id={FIELD.paymentMethod}
            value={draft.paymentMethod}
            suggestions={PAYMENT_METHODS}
            placeholder="Bank Transfer"
            maxLength={ORDER_LIMITS.text}
            invalid={Boolean(errors[FIELD.paymentMethod])}
            onChange={(paymentMethod) => update({ paymentMethod })}
            className={FIELD_INPUT}
          />
        </Field>
      </div>

      <div className={BLOCK}>
        <Field
          id={FIELD.discountCodes}
          label="Discount codes"
          error={errors[FIELD.discountCodes]}
          hint="Codes that already exist in the store. Enter or a comma adds one."
          optional
        >
          <ChipsInput
            id={FIELD.discountCodes}
            values={draft.discountCodes}
            onChange={(discountCodes) => update({ discountCodes })}
            placeholder="WELCOME10"
            error={errors[FIELD.discountCodes]}
            removeLabel="Remove code"
          />
        </Field>
      </div>

      <div className={BLOCK}>
        <Field
          id={FIELD.tags}
          label="Tags"
          error={errors[FIELD.tags]}
          hint="Enter or a comma adds a tag."
          optional
        >
          <ChipsInput
            id={FIELD.tags}
            values={draft.tags}
            onChange={(tags) => update({ tags })}
            placeholder="crm"
            error={errors[FIELD.tags]}
            removeLabel="Remove tag"
          />
        </Field>
        <Field id={FIELD.note} label="Note" error={errors[FIELD.note]} optional>
          <textarea
            id={FIELD.note}
            value={draft.note}
            placeholder="Phone order"
            maxLength={ORDER_LIMITS.note}
            aria-invalid={errors[FIELD.note] ? true : undefined}
            onChange={(event) => update({ note: event.target.value })}
            className={FIELD_TEXTAREA}
          />
        </Field>
      </div>
    </section>
  )
}

/**
 * What the order comes to, worked out from the lines and the delivery as they are typed.
 * Discount codes and tax are worked out by the store, so they are only mentioned.
 */
export function OrderSummaryCard({
  draft,
  currency,
}: {
  draft: OrderDraft
  currency: string | null
}) {
  const totals = orderTotals(draft)
  const row = 'flex items-baseline justify-between gap-3 text-[0.85rem]'
  return (
    <section aria-label="Summary" className={`${CARD} flex flex-col gap-3 p-4`}>
      <h4 className={BLOCK_TITLE}>Summary</h4>
      <div className={row}>
        <span className="text-text-muted">
          Subtotal · {totals.items} {totals.items === 1 ? 'item' : 'items'}
        </span>
        <span className="tabular-nums">{formatPrice(totals.subtotal, currency)}</span>
      </div>
      <div className={row}>
        <span className="text-text-muted">Delivery</span>
        <span className="tabular-nums">
          {draft.shippingTitle.trim() ? formatPrice(totals.shipping, currency) : '—'}
        </span>
      </div>
      {draft.discountCodes.length > 0 && (
        <div className={row}>
          <span className="text-text-muted">Discount</span>
          <span className="text-text-muted truncate text-[0.8rem]">
            {draft.discountCodes.join(', ')}
          </span>
        </div>
      )}
      <div className={`${row} border-border border-t pt-3 font-semibold`}>
        <span>Estimated total</span>
        <span className="tabular-nums">{formatPrice(totals.total, currency)}</span>
      </div>
      <p className="text-text-muted m-0 text-[0.76rem]">
        {totals.complete
          ? 'Before discounts and tax, which the store works out when the order is made.'
          : 'A line has no price or quantity yet, so it is left out of the total.'}
      </p>
    </section>
  )
}
