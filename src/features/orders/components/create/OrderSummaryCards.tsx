import type { ComponentType, ReactNode } from 'react'
import {
  CheckCircleIcon,
  PoundIcon,
  ProductsIcon,
  ShoppingCartIcon,
  SpinnerIcon,
  TruckIcon,
  UsersIcon,
  type IconProps,
} from '../../../../components/ui/icons.tsx'
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
import {
  CARD,
  ChipsInput,
  Field,
  FIELD_INPUT,
  OrderSection,
  TEXT_BUTTON,
  Thumb,
} from './formParts.tsx'

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

/** "Payment & Details": the payment, the discount codes and the tags. */
export function OrderPaymentCard({
  draft,
  errors,
  update,
}: {
  draft: OrderDraft
  errors: OrderErrors
  update: (patch: Partial<OrderDraft>) => void
}) {
  return (
    <OrderSection
      icon={PoundIcon}
      title="Payment & Details"
      subtitle="Payment status, discount codes and tags"
    >
      <div className="grid items-start gap-4 sm:grid-cols-2">
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
      </div>
    </OrderSection>
  )
}

function SummaryBlock({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: ComponentType<IconProps>
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="border-border flex flex-col gap-2 border-t py-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-[0.88rem] font-semibold">
          <Icon width={16} height={16} className="text-accent" />
          {title}
        </h4>
        {aside}
      </div>
      {children}
    </div>
  )
}

/**
 * "Order Summary", beside the form and staying in view while it scrolls: who, what and how it is
 * delivered, the total as it is typed, and **Create order**. Discount codes and tax are worked
 * out by the store, so the total is an estimate.
 */
export function OrderSummaryCard({
  draft,
  currency,
  isCreating,
  onChangeCustomer,
  onCreate,
}: {
  draft: OrderDraft
  currency: string | null
  isCreating: boolean
  /** Clears the customer so another can be found. */
  onChangeCustomer: () => void
  onCreate: () => void
}) {
  const totals = orderTotals(draft)
  const { customer } = draft
  const name = [customer.firstName, customer.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
  const hasCustomer = Boolean(name || customer.email.trim() || customer.phone.trim())
  const muted = 'text-text-muted m-0 text-[0.82rem]'

  return (
    <section
      aria-label="Order Summary"
      className={`${CARD} flex flex-col gap-4 p-4 sm:p-5 lg:sticky lg:top-0`}
    >
      <h3 className="flex items-center gap-2.5 text-[1.05rem] font-bold">
        <ShoppingCartIcon width={20} height={20} className="text-accent" />
        Order Summary
      </h3>

      <div className="flex flex-col">
        <SummaryBlock
          icon={UsersIcon}
          title="Customer"
          aside={
            hasCustomer && (
              <button type="button" onClick={onChangeCustomer} className={TEXT_BUTTON}>
                Change
              </button>
            )
          }
        >
          {hasCustomer ? (
            <div className="flex min-w-0 flex-col text-[0.85rem]">
              {name && <span className="font-semibold">{name}</span>}
              {customer.email.trim() && (
                <span className="text-text-muted break-all">{customer.email}</span>
              )}
            </div>
          ) : (
            <p className={muted}>No customer chosen.</p>
          )}
        </SummaryBlock>

        <SummaryBlock icon={ProductsIcon} title={`Products (${draft.lines.length})`}>
          {draft.lines.length === 0 ? (
            <p className={muted}>No items yet.</p>
          ) : (
            <ul className="m-0 flex max-h-64 list-none flex-col gap-3 overflow-y-auto p-0">
              {draft.lines.map((line) => {
                const quantity = Number.parseInt(line.quantity, 10)
                const price = Number.parseFloat(line.price)
                const total =
                  Number.isFinite(quantity) && Number.isFinite(price)
                    ? price * quantity
                    : null
                return (
                  <li key={line.key} className="flex items-start gap-3">
                    <Thumb url={line.kind === 'variant' ? line.imageUrl : null} alt="" />
                    <div className="flex min-w-0 flex-1 flex-col text-[0.82rem]">
                      <span className="font-semibold break-words">
                        {line.kind === 'variant'
                          ? line.productTitle
                          : line.title.trim() || 'Custom item'}
                      </span>
                      <span className="text-text-muted">Qty: {line.quantity || '—'}</span>
                    </div>
                    <span className="shrink-0 text-[0.82rem] font-semibold tabular-nums">
                      {total === null ? '—' : formatPrice(total, currency)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </SummaryBlock>

        <SummaryBlock
          icon={TruckIcon}
          title="Shipping"
          aside={
            draft.shippingTitle.trim() && (
              <span className="text-[0.85rem] font-semibold tabular-nums">
                {formatPrice(totals.shipping, currency)}
              </span>
            )
          }
        >
          <p className={muted}>{draft.shippingTitle.trim() || 'No shipping added.'}</p>
        </SummaryBlock>

        {draft.discountCodes.length > 0 && (
          <div className="border-border flex items-baseline justify-between gap-3 border-t py-3 text-[0.82rem]">
            <span className="text-text-muted">Discount</span>
            <span className="text-text-muted truncate">
              {draft.discountCodes.join(', ')}
            </span>
          </div>
        )}
      </div>

      <div className="bg-accent-tint flex items-center justify-between gap-3 rounded-lg px-4 py-3">
        <span className="text-[0.95rem] font-semibold">Estimated total</span>
        <span className="text-accent text-[1.3rem] font-bold tabular-nums">
          {formatPrice(totals.total, currency)}
        </span>
      </div>
      <p className={`${muted} text-[0.76rem]`}>
        {totals.complete
          ? 'Before discounts and tax, which the store works out when the order is made.'
          : 'A line has no price or quantity yet, so it is left out of the total.'}
      </p>

      <button
        type="button"
        onClick={onCreate}
        disabled={isCreating}
        className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-none text-[0.9rem] font-semibold shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        {isCreating ? (
          <SpinnerIcon width={16} height={16} className="animate-spin" />
        ) : (
          <CheckCircleIcon width={16} height={16} />
        )}
        {isCreating ? 'Creating…' : 'Create order'}
      </button>
    </section>
  )
}
