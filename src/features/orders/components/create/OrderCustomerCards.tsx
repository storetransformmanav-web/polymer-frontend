import { useState } from 'react'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import { SearchIcon, SpinnerIcon } from '../../../../components/ui/icons.tsx'
import { countryOptions } from '../../../../lib/countries.ts'
import type { CustomerListItem } from '../../../../lib/api/endpoints.ts'
import { usePickCustomers } from '../../hooks/useOrderPickers.ts'
import {
  FIELD,
  ORDER_LIMITS,
  type OrderDraft,
  type OrderErrors,
} from '../../utils/orderDraft.ts'
import {
  Field,
  FIELD_INPUT,
  FormCard,
  MoneyInput,
  TEXT_BUTTON,
  TextInput,
} from './formParts.tsx'

interface CardProps {
  draft: OrderDraft
  errors: OrderErrors
  update: (patch: Partial<OrderDraft>) => void
}

const customerName = (customer: CustomerListItem) =>
  customer.full_name?.trim() ||
  [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
  customer.email ||
  'Customer'

/**
 * "Customer": find one of the store's customers (nothing is asked until something is typed)
 * to fill in their details, or type a new buyer. The store finds the customer by email, or makes
 * one. Optional — but a customer needs an email.
 */
export function OrderCustomerCard({ draft, errors, update }: CardProps) {
  const [text, setText] = useState('')
  const found = usePickCustomers(draft.shop, text)
  const customers = found.data?.items ?? []
  const customer = draft.customer
  const set = (patch: Partial<OrderDraft['customer']>) =>
    update({ customer: { ...customer, ...patch } })

  function choose(picked: CustomerListItem) {
    update({
      customer: {
        email: picked.email ?? '',
        firstName: picked.first_name ?? '',
        lastName: picked.last_name ?? '',
        phone: picked.phone ?? '',
      },
    })
    setText('')
  }

  return (
    <FormCard title="Customer">
      <div className="flex flex-col gap-2">
        <label htmlFor="order-customer-search" className="sr-only">
          Find a customer
        </label>
        <div className="relative">
          <SearchIcon
            width={16}
            height={16}
            aria-hidden="true"
            className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            id="order-customer-search"
            type="search"
            autoComplete="off"
            value={text}
            placeholder="Find an existing customer by name or email"
            onChange={(event) => setText(event.target.value)}
            className={`${FIELD_INPUT} pl-9`}
          />
        </div>
        {text.trim() && (
          <div className="border-border overflow-hidden rounded-lg border">
            {found.isFetching && customers.length === 0 && (
              <p className="text-text-muted flex items-center gap-2 px-3 py-3 text-[0.8rem]">
                <SpinnerIcon width={14} height={14} className="animate-spin" />
                Searching customers…
              </p>
            )}
            {found.isError && (
              <p role="alert" className="text-danger px-3 py-3 text-[0.8rem]">
                Could not search the customers. Type their details below instead.
              </p>
            )}
            {found.data && customers.length === 0 && !found.isFetching && (
              <p className="text-text-muted px-3 py-3 text-[0.8rem]">
                No customer matches “{text.trim()}”. Type their details below — the store
                will add them.
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
                        {[candidate.email, candidate.phone].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={FIELD.firstName}
          label="First name"
          error={errors[FIELD.firstName]}
          optional
        >
          <TextInput
            id={FIELD.firstName}
            value={customer.firstName}
            error={errors[FIELD.firstName]}
            onChange={(firstName) => set({ firstName })}
          />
        </Field>
        <Field
          id={FIELD.lastName}
          label="Last name"
          error={errors[FIELD.lastName]}
          optional
        >
          <TextInput
            id={FIELD.lastName}
            value={customer.lastName}
            error={errors[FIELD.lastName]}
            onChange={(lastName) => set({ lastName })}
          />
        </Field>
        <Field id={FIELD.email} label="Email" error={errors[FIELD.email]}>
          <TextInput
            id={FIELD.email}
            type="email"
            inputMode="email"
            value={customer.email}
            error={errors[FIELD.email]}
            placeholder="buyer@example.com"
            onChange={(email) => set({ email })}
          />
        </Field>
        <Field id={FIELD.phone} label="Phone" error={errors[FIELD.phone]} optional>
          <TextInput
            id={FIELD.phone}
            type="tel"
            inputMode="tel"
            value={customer.phone}
            error={errors[FIELD.phone]}
            placeholder="+447700900123"
            onChange={(phone) => set({ phone })}
          />
        </Field>
      </div>
    </FormCard>
  )
}

/**
 * "Shipping address": optional; once anything is typed, the street, the town and the country
 * are needed. "Same as customer" copies the customer's name and phone.
 */
export function OrderAddressCard({ draft, errors, update }: CardProps) {
  const address = draft.address
  const set = (patch: Partial<OrderDraft['address']>) =>
    update({ address: { ...address, ...patch } })
  const customer = draft.customer
  const canCopy = Boolean(
    customer.firstName.trim() || customer.lastName.trim() || customer.phone.trim(),
  )

  return (
    <FormCard
      title="Shipping address"
      action={
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={FIELD.addressFirstName} label="First name" optional>
          <TextInput
            id={FIELD.addressFirstName}
            value={address.firstName}
            onChange={(firstName) => set({ firstName })}
          />
        </Field>
        <Field id={FIELD.addressLastName} label="Last name" optional>
          <TextInput
            id={FIELD.addressLastName}
            value={address.lastName}
            onChange={(lastName) => set({ lastName })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field id={FIELD.company} label="Company" optional>
            <TextInput
              id={FIELD.company}
              value={address.company}
              maxLength={ORDER_LIMITS.text}
              onChange={(company) => set({ company })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id={FIELD.address1} label="Address" error={errors[FIELD.address1]}>
            <TextInput
              id={FIELD.address1}
              value={address.address1}
              error={errors[FIELD.address1]}
              placeholder="1 High Street"
              onChange={(address1) => set({ address1 })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id={FIELD.address2} label="Apartment, suite, etc." optional>
            <TextInput
              id={FIELD.address2}
              value={address.address2}
              onChange={(address2) => set({ address2 })}
            />
          </Field>
        </div>
        <Field id={FIELD.city} label="City" error={errors[FIELD.city]}>
          <TextInput
            id={FIELD.city}
            value={address.city}
            error={errors[FIELD.city]}
            onChange={(city) => set({ city })}
          />
        </Field>
        <Field id={FIELD.zip} label="Postcode" optional>
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
        <Field
          id={FIELD.addressPhone}
          label="Phone"
          error={errors[FIELD.addressPhone]}
          optional
        >
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
    </FormCard>
  )
}

/** "Delivery": the shipping line's name and price; leave both empty for none. */
export function OrderDeliveryCard({
  draft,
  errors,
  update,
  symbol,
}: CardProps & { symbol: string }) {
  return (
    <FormCard title="Delivery">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field
          id={FIELD.shippingTitle}
          label="Delivery method"
          error={errors[FIELD.shippingTitle]}
          hint="Leave empty when the order is not delivered."
          optional
        >
          <TextInput
            id={FIELD.shippingTitle}
            value={draft.shippingTitle}
            error={errors[FIELD.shippingTitle]}
            placeholder="Next day delivery"
            onChange={(shippingTitle) => update({ shippingTitle })}
          />
        </Field>
        <Field
          id={FIELD.shippingPrice}
          label="Delivery price"
          error={errors[FIELD.shippingPrice]}
          optional
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
    </FormCard>
  )
}
