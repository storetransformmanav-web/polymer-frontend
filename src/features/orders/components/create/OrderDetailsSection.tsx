import { SelectField, type SelectOption } from '../../../../components/ui/SelectField.tsx'
import { SuggestInput } from '../../../../components/ui/SuggestInput.tsx'
import {
  ORDER_PAYMENT_STATUSES,
  type OrderPaymentStatus,
} from '../../../../lib/api/endpoints.ts'
import {
  FIELD,
  ORDER_LIMITS,
  PAYMENT_LABELS,
  type OrderDraft,
  type OrderErrors,
} from '../../utils/orderDraft.ts'
import { ChipsInput, Field, FIELD_INPUT, FormSection } from './formParts.tsx'

const PAYMENT_OPTIONS: SelectOption[] = ORDER_PAYMENT_STATUSES.map((status) => ({
  value: status,
  label: PAYMENT_LABELS[status],
}))

/** Offered in the payment method box (any other can be typed). */
const PAYMENT_METHODS = ['Bank Transfer', 'Card', 'Cash', 'Cheque', 'Invoice', 'PayPal']

/**
 * "ORDER": the store the order is made in, how it is paid (the status is **Payment pending**
 * unless someone says otherwise, so nothing is marked paid by mistake), and the discount codes
 * and tags. Changing the store drops the store products already picked (they belong to the old
 * one), so the view does that in `update`.
 */
export function OrderDetailsSection({
  draft,
  errors,
  update,
  storeOptions,
}: {
  draft: OrderDraft
  errors: OrderErrors
  update: (patch: Partial<OrderDraft>) => void
  storeOptions: SelectOption[]
}) {
  return (
    <FormSection title="Order">
      <div className="grid items-start gap-4 md:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <SelectField
            id={FIELD.shop}
            label="Store"
            value={draft.shop}
            options={storeOptions}
            onChange={(shop) => update({ shop })}
          />
          {errors[FIELD.shop] && (
            <p role="alert" className="text-danger text-[0.78rem]">
              {errors[FIELD.shop]}
            </p>
          )}
        </div>
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
        >
          <SuggestInput
            id={FIELD.paymentMethod}
            value={draft.paymentMethod}
            suggestions={PAYMENT_METHODS}
            placeholder="e.g. Bank Transfer"
            maxLength={ORDER_LIMITS.text}
            invalid={Boolean(errors[FIELD.paymentMethod])}
            onChange={(paymentMethod) => update({ paymentMethod })}
            className={FIELD_INPUT}
          />
        </Field>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Field
          id={FIELD.discountCodes}
          label="Discount codes"
          error={errors[FIELD.discountCodes]}
          hint="Codes that already exist in the store. Enter or a comma adds one."
        >
          <ChipsInput
            id={FIELD.discountCodes}
            values={draft.discountCodes}
            onChange={(discountCodes) => update({ discountCodes })}
            placeholder="e.g. WELCOME10"
            error={errors[FIELD.discountCodes]}
            removeLabel="Remove code"
          />
        </Field>
        <Field
          id={FIELD.tags}
          label="Tags"
          error={errors[FIELD.tags]}
          hint="Enter or a comma adds a tag."
        >
          <ChipsInput
            id={FIELD.tags}
            values={draft.tags}
            onChange={(tags) => update({ tags })}
            placeholder="e.g. crm"
            error={errors[FIELD.tags]}
            removeLabel="Remove tag"
          />
        </Field>
      </div>
    </FormSection>
  )
}
