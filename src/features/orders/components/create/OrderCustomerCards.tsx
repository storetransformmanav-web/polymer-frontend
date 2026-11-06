import { useState } from 'react'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import {
  PlusIcon,
  SpinnerIcon,
  TruckIcon,
  UsersIcon,
} from '../../../../components/ui/icons.tsx'
import { SuggestInput } from '../../../../components/ui/SuggestInput.tsx'
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
  FIELD_LABEL,
  FIELD_TEXTAREA,
  MoneyInput,
  OrderSection,
  SECONDARY_BUTTON,
  SearchDropdown,
  TEXT_BUTTON,
  TextInput,
} from './formParts.tsx'

interface CardProps {
  draft: OrderDraft
  errors: OrderErrors
  update: (patch: Partial<OrderDraft>) => void
}

/** Offered in the shipping method box (any other can be typed). */
const SHIPPING_METHODS = ['Standard Shipping', 'Next day delivery', 'Collection']

const BLANK_CUSTOMER: OrderDraft['customer'] = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
}

const customerName = (customer: CustomerListItem) =>
  customer.full_name?.trim() ||
  [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
  customer.email ||
  'Customer'

/**
 * "Customer": find one of the store's customers (nothing is asked until something is typed), or
 * **Add Customer** to type a new buyer. The store finds the customer by email, or makes one.
 * Optional — but a customer needs an email, so a problem in the details always shows them.
 */
export function OrderCustomerCard({ draft, errors, update }: CardProps) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const found = usePickCustomers(draft.shop, text)
  const customers = found.data?.items ?? []
  const customer = draft.customer
  const set = (patch: Partial<OrderDraft['customer']>) =>
    update({ customer: { ...customer, ...patch } })

  const hasProblem = [FIELD.email, FIELD.phone, FIELD.firstName, FIELD.lastName].some(
    (field) => errors[field],
  )
  const formOpen = adding || hasProblem
  const name = [customer.firstName, customer.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')

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
    setAdding(false)
  }

  function toggleForm() {
    if (formOpen) {
      setAdding(false)
      return
    }
    // A chosen customer gives way to the new buyer being typed.
    if (customer.email.trim()) update({ customer: BLANK_CUSTOMER })
    setAdding(true)
  }

  return (
    <OrderSection
      icon={UsersIcon}
      title="Customer"
      subtitle="Select or add a customer"
      action={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <SearchDropdown
            id="order-customer-search"
            label="Find a customer"
            value={text}
            placeholder="Search customer by name or email…"
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
                Could not search the customers. Use Add Customer to type their details.
              </p>
            )}
            {found.data && customers.length === 0 && !found.isFetching && (
              <p className="text-text-muted px-3 py-3 text-[0.8rem]">
                No customer matches “{text.trim()}”. Use Add Customer — the store will add
                them.
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
          </SearchDropdown>
          <button
            type="button"
            aria-expanded={formOpen}
            onClick={toggleForm}
            className={SECONDARY_BUTTON}
          >
            <PlusIcon width={16} height={16} />
            Add Customer
          </button>
        </div>
      }
    >
      {!formOpen && customer.email.trim() && (
        <div className="border-border bg-surface/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div className="flex min-w-0 flex-col text-[0.85rem]">
            {name && <span className="font-semibold">{name}</span>}
            <span className="text-text-muted break-all">{customer.email}</span>
            {customer.phone.trim() && (
              <span className="text-text-muted">{customer.phone}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setAdding(true)} className={TEXT_BUTTON}>
              Edit details
            </button>
            <button
              type="button"
              onClick={() => update({ customer: BLANK_CUSTOMER })}
              className={TEXT_BUTTON}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {formOpen && (
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
      )}
    </OrderSection>
  )
}

/**
 * "Shipping & Delivery": the shipping line's method and cost (leave both empty for none), the
 * delivery address (optional; once anything is typed, the street, the town and the country are
 * needed) and the order's note.
 */
export function OrderShippingCard({
  draft,
  errors,
  update,
  symbol,
}: CardProps & { symbol: string }) {
  const address = draft.address
  const set = (patch: Partial<OrderDraft['address']>) =>
    update({ address: { ...address, ...patch } })
  const customer = draft.customer
  const canCopy = Boolean(
    customer.firstName.trim() || customer.lastName.trim() || customer.phone.trim(),
  )

  return (
    <OrderSection
      icon={TruckIcon}
      title="Shipping & Delivery"
      subtitle="Add shipping and delivery details"
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field
          id={FIELD.shippingTitle}
          label="Shipping method"
          error={errors[FIELD.shippingTitle]}
          hint="Leave empty when the order is not delivered."
          optional
        >
          <SuggestInput
            id={FIELD.shippingTitle}
            value={draft.shippingTitle}
            suggestions={SHIPPING_METHODS}
            placeholder="Standard Shipping"
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

      <div className="border-border flex flex-col gap-4 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[0.9rem] font-semibold">
            Delivery address{' '}
            <span className="text-text-muted text-[0.82rem] font-normal">(optional)</span>
          </h4>
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
        </div>
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
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={FIELD.note} className={FIELD_LABEL}>
          Notes <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <textarea
          id={FIELD.note}
          value={draft.note}
          placeholder="Add any special instructions…"
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
      </div>
    </OrderSection>
  )
}
