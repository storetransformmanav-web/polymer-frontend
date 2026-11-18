import { useState } from 'react'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import { SpinnerIcon, XIcon } from '../../../../components/ui/icons.tsx'
import { SuggestInput } from '../../../../components/ui/SuggestInput.tsx'
import { countryOptions } from '../../../../lib/countries.ts'
import type { CustomerListItem } from '../../../../lib/api/endpoints.ts'
import { usePickCustomers } from '../../hooks/useOrderPickers.ts'
import {
  FIELD,
  ORDER_LIMITS,
  PHONE,
  type OrderDraft,
  type OrderErrors,
} from '../../utils/orderDraft.ts'
import {
  Field,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  FormSection,
  MoneyInput,
  SearchDropdown,
  TEXT_BUTTON,
  TextInput,
} from './formParts.tsx'

interface SectionProps {
  draft: OrderDraft
  errors: OrderErrors
  update: (patch: Partial<OrderDraft>) => void
}

/** The customer chosen from the store's list; the form shows it as "Linked to …". */
export interface LinkedCustomer {
  name: string
  email: string
}

/** Offered in the shipping method box (any other can be typed). */
const SHIPPING_METHODS = ['Standard Shipping', 'Next day delivery', 'Collection']

const customerName = (customer: CustomerListItem) =>
  customer.full_name?.trim() ||
  [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
  customer.email ||
  'Customer'

/** One read-only line of the chosen customer's details. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-text-muted text-[0.7rem] font-bold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="m-0 truncate text-[0.85rem]" title={value || undefined}>
        {value || <span className="text-text-muted">—</span>}
      </dd>
    </div>
  )
}

/**
 * "CUSTOMER" and "NOTES" of the first step. **Only a customer the store already has can be
 * chosen**: the box searches the store's customers (nothing is asked until something is typed) and
 * the one picked from the list fills the order — their email, phone and name are shown as they are
 * and can't be typed over. There is no way to add a new customer here (that is done on the
 * Customers page). The ✕ takes the customer off again; leaving it empty makes an order with no
 * customer.
 */
export function OrderCustomerSection({
  draft,
  errors,
  update,
  linked,
  onLink,
}: SectionProps & {
  linked: LinkedCustomer | null
  onLink: (customer: LinkedCustomer | null) => void
}) {
  const [text, setText] = useState('')
  const found = usePickCustomers(draft.shop, text)
  const customers = found.data?.items ?? []
  const customer = draft.customer
  // A customer is "chosen" only while the order still carries the email that was picked.
  const active =
    linked && linked.email.trim().toLowerCase() === customer.email.trim().toLowerCase()
      ? linked
      : null

  function choose(picked: CustomerListItem) {
    const phone = (picked.phone ?? '').trim()
    update({
      customer: {
        email: (picked.email ?? '').trim(),
        firstName: (picked.first_name ?? '').trim().slice(0, ORDER_LIMITS.text),
        lastName: (picked.last_name ?? '').trim().slice(0, ORDER_LIMITS.text),
        // A phone the store would refuse is left out, so a chosen customer never blocks the order.
        phone: PHONE.test(phone) ? phone : '',
      },
    })
    onLink({ name: customerName(picked), email: (picked.email ?? '').trim() })
    setText('')
  }

  function clear() {
    update({ customer: { email: '', firstName: '', lastName: '', phone: '' } })
    onLink(null)
    setText('')
  }

  const problem = errors[FIELD.email] ?? errors[FIELD.phone]

  return (
    <>
      <FormSection title="Customer">
        <div className="flex flex-col gap-1.5">
          <span className="text-text text-[0.82rem] font-semibold">
            Existing customer
          </span>
          {active ? (
            <>
              <div className={`${FIELD_INPUT} flex items-center justify-between gap-2`}>
                <span className="truncate">{active.name}</span>
                <button
                  type="button"
                  aria-label="Clear customer"
                  onClick={clear}
                  className="text-text-muted hover:text-text inline-flex cursor-pointer border-none bg-transparent p-0.5"
                >
                  <XIcon width={16} height={16} />
                </button>
              </div>
              <dl
                aria-label="Customer details"
                className="border-border-strong bg-accent-tint/50 m-0 grid gap-3 rounded-lg border px-3 py-2.5 sm:grid-cols-2"
              >
                <Detail label="Email" value={customer.email} />
                <Detail label="Phone" value={customer.phone} />
                <Detail label="First name" value={customer.firstName} />
                <Detail label="Last name" value={customer.lastName} />
              </dl>
            </>
          ) : (
            <>
              <SearchDropdown
                id="order-customer-search"
                label="Find a customer"
                value={text}
                placeholder="Select customer — search by name or email"
                onChange={setText}
              >
                {found.isFetching && customers.length === 0 && (
                  <p className="text-text-muted flex items-center gap-2 px-3 py-3 text-[0.8rem]">
                    <SpinnerIcon width={14} height={14} className="animate-spin" />
                    Searching customers…
                  </p>
                )}
                {found.isError && (
                  <p role="alert" className="text-danger px-3 py-3 text-[0.8rem]">
                    Could not search the customers. Try again in a moment.
                  </p>
                )}
                {found.data && customers.length === 0 && !found.isFetching && (
                  <p className="text-text-muted px-3 py-3 text-[0.8rem]">
                    No customer matches “{text.trim()}”.
                  </p>
                )}
                {customers.length > 0 && (
                  <ul aria-label="Customers found" className="m-0 list-none p-0">
                    {customers.map((candidate) => (
                      <li
                        key={candidate.id}
                        className="border-border border-t first:border-t-0"
                      >
                        <button
                          type="button"
                          onClick={() => choose(candidate)}
                          className="hover:bg-accent-tint/60 flex w-full cursor-pointer flex-col items-start border-none bg-transparent px-3 py-2 text-left transition-colors"
                        >
                          <span className="text-[0.85rem] font-semibold">
                            {customerName(candidate)}
                          </span>
                          <span className="text-text-muted text-[0.76rem]">
                            {[candidate.email, candidate.phone]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </SearchDropdown>
              <p className="text-text-muted m-0 text-[0.76rem]">
                Choose a customer that is already in the store. New customers can&apos;t
                be added here. Leave it empty for an order with no customer.
              </p>
            </>
          )}
          {problem && (
            <p role="alert" className="text-danger m-0 text-[0.78rem]">
              {problem}
            </p>
          )}
        </div>
      </FormSection>

      <FormSection title="Notes">
        <label htmlFor={FIELD.note} className="sr-only">
          Notes
        </label>
        <textarea
          id={FIELD.note}
          value={draft.note}
          placeholder="Internal notes for this order"
          maxLength={ORDER_LIMITS.note}
          aria-invalid={errors[FIELD.note] ? true : undefined}
          onChange={(event) => update({ note: event.target.value })}
          className={FIELD_TEXTAREA}
        />
        {errors[FIELD.note] && (
          <p role="alert" className="text-danger text-[0.78rem]">
            {errors[FIELD.note]}
          </p>
        )}
      </FormSection>
    </>
  )
}

/**
 * The second step: the delivery address (optional; once anything is typed the street, the town
 * and the country are needed) and the delivery itself — its method and cost (leave both empty
 * for none).
 */
export function OrderAddressSection({
  draft,
  errors,
  update,
  symbol,
}: SectionProps & { symbol: string }) {
  const address = draft.address
  const set = (patch: Partial<OrderDraft['address']>) =>
    update({ address: { ...address, ...patch } })
  const customer = draft.customer
  const canCopy = Boolean(
    customer.firstName.trim() || customer.lastName.trim() || customer.phone.trim(),
  )

  return (
    <>
      <FormSection
        title="Shipping address"
        aside={
          <button
            type="button"
            disabled={!canCopy}
            onClick={() =>
              set({
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
              })
            }
            className={TEXT_BUTTON}
          >
            Use the customer’s name and phone
          </button>
        }
      >
        <p className="text-text-muted -mt-1 mb-0 text-[0.76rem]">
          Optional. Leave it empty when the order is not delivered; once anything is
          typed, the address, city and country are needed.
        </p>
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Field id={FIELD.addressFirstName} label="First name">
            <TextInput
              id={FIELD.addressFirstName}
              value={address.firstName}
              placeholder="e.g. John"
              onChange={(firstName) => set({ firstName })}
            />
          </Field>
          <Field id={FIELD.addressLastName} label="Last name">
            <TextInput
              id={FIELD.addressLastName}
              value={address.lastName}
              placeholder="e.g. Smith"
              onChange={(lastName) => set({ lastName })}
            />
          </Field>
          <div className="md:col-span-2">
            <Field id={FIELD.company} label="Company">
              <TextInput
                id={FIELD.company}
                value={address.company}
                maxLength={ORDER_LIMITS.text}
                onChange={(company) => set({ company })}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              id={FIELD.address1}
              label="Address"
              error={errors[FIELD.address1]}
              required
            >
              <TextInput
                id={FIELD.address1}
                value={address.address1}
                error={errors[FIELD.address1]}
                placeholder="e.g. 1 High Street"
                onChange={(address1) => set({ address1 })}
              />
            </Field>
          </div>
          <Field id={FIELD.city} label="City" error={errors[FIELD.city]} required>
            <TextInput
              id={FIELD.city}
              value={address.city}
              error={errors[FIELD.city]}
              onChange={(city) => set({ city })}
            />
          </Field>
          <Field id={FIELD.zip} label="Postcode">
            <TextInput
              id={FIELD.zip}
              value={address.zip}
              onChange={(zip) => set({ zip })}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <SelectField
              id={FIELD.country}
              label="Country"
              value={address.countryCode}
              options={countryOptions()}
              onChange={(countryCode) => set({ countryCode })}
            />
            {errors[FIELD.country] && (
              <p
                id={`${FIELD.country}-error`}
                role="alert"
                className="text-danger text-[0.78rem]"
              >
                {errors[FIELD.country]}
              </p>
            )}
          </div>
          <Field id={FIELD.addressPhone} label="Phone" error={errors[FIELD.addressPhone]}>
            <TextInput
              id={FIELD.addressPhone}
              type="tel"
              inputMode="tel"
              value={address.phone}
              error={errors[FIELD.addressPhone]}
              onChange={(phone) => set({ phone })}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Delivery">
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
          <Field
            id={FIELD.shippingTitle}
            label="Shipping method"
            error={errors[FIELD.shippingTitle]}
            hint="Leave empty when the order is not delivered."
          >
            <SuggestInput
              id={FIELD.shippingTitle}
              value={draft.shippingTitle}
              suggestions={SHIPPING_METHODS}
              placeholder="e.g. Standard Shipping"
              maxLength={ORDER_LIMITS.title}
              invalid={Boolean(errors[FIELD.shippingTitle])}
              onChange={(shippingTitle) => update({ shippingTitle })}
              className={FIELD_INPUT}
            />
          </Field>
          <Field
            id={FIELD.shippingPrice}
            label="Shipping cost"
            error={errors[FIELD.shippingPrice]}
          >
            <MoneyInput
              id={FIELD.shippingPrice}
              value={draft.shippingPrice}
              symbol={symbol}
              error={errors[FIELD.shippingPrice]}
              onChange={(shippingPrice) => update({ shippingPrice })}
            />
          </Field>
        </div>
      </FormSection>
    </>
  )
}
