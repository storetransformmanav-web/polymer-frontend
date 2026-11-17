import { useState } from 'react'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import { PlusIcon, SpinnerIcon, XIcon } from '../../../../components/ui/icons.tsx'
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
  FIELD_TEXTAREA,
  FormSection,
  MoneyInput,
  SECONDARY_BUTTON,
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
 * "CUSTOMER" and "NOTES" of the first step. **Existing customer** searches the store's customers
 * (nothing is asked until something is typed); choosing one fills the boxes below and shows
 * "Linked to …" with **Unlink** (keeps what was filled in). **Add Customer** empties the boxes for
 * a new buyer — the store links an email that matches a customer it already has. Optional, but a
 * customer needs an email.
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
  const set = (patch: Partial<OrderDraft['customer']>) =>
    update({ customer: { ...customer, ...patch } })
  const anyCustomer = Object.values(customer).some((value) => value.trim())
  // The link ends when the email is changed to another one.
  const active =
    linked && linked.email.trim().toLowerCase() === customer.email.trim().toLowerCase()
      ? linked
      : null

  function choose(picked: CustomerListItem) {
    update({
      customer: {
        email: picked.email ?? '',
        firstName: picked.first_name ?? '',
        lastName: picked.last_name ?? '',
        phone: picked.phone ?? '',
      },
    })
    onLink({ name: customerName(picked), email: picked.email ?? '' })
    setText('')
  }

  function addNew() {
    update({ customer: BLANK_CUSTOMER })
    onLink(null)
    setText('')
    window.setTimeout(() => document.getElementById(FIELD.email)?.focus(), 0)
  }

  return (
    <>
      <FormSection title="Customer">
        <div className="flex flex-col gap-1.5">
          <span className="text-text text-[0.82rem] font-semibold">
            Existing customer
          </span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {active ? (
              <div
                className={`${FIELD_INPUT} flex items-center justify-between gap-2 sm:flex-1`}
              >
                <span className="truncate">{active.name}</span>
                <button
                  type="button"
                  aria-label="Clear customer"
                  onClick={addNew}
                  className="text-text-muted hover:text-text inline-flex cursor-pointer border-none bg-transparent p-0.5"
                >
                  <XIcon width={16} height={16} />
                </button>
              </div>
            ) : (
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
                    Could not search the customers. Use Add Customer to type their
                    details.
                  </p>
                )}
                {found.data && customers.length === 0 && !found.isFetching && (
                  <p className="text-text-muted px-3 py-3 text-[0.8rem]">
                    No customer matches “{text.trim()}”. Use Add Customer — the store will
                    add them.
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
            )}
            <button type="button" onClick={addNew} className={SECONDARY_BUTTON}>
              <PlusIcon width={16} height={16} />
              Add Customer
            </button>
          </div>
          {active ? (
            <div className="border-border-strong bg-accent-tint/50 flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-[0.82rem]">
              <span>
                Linked to <strong>{active.name}</strong>
              </span>
              <button type="button" onClick={() => onLink(null)} className={TEXT_BUTTON}>
                Unlink
              </button>
            </div>
          ) : (
            <p className="text-text-muted m-0 text-[0.76rem]">
              Or enter a new customer below. An email that matches an existing customer is
              linked to them. Leave everything empty for an order with no customer.
            </p>
          )}
        </div>

        <div className="grid items-start gap-4 md:grid-cols-2">
          <Field
            id={FIELD.email}
            label="Email"
            error={errors[FIELD.email]}
            required={anyCustomer}
          >
            <TextInput
              id={FIELD.email}
              type="email"
              inputMode="email"
              value={customer.email}
              error={errors[FIELD.email]}
              placeholder="e.g. buyer@company.com"
              onChange={(email) => set({ email })}
            />
          </Field>
          <Field id={FIELD.phone} label="Phone" error={errors[FIELD.phone]}>
            <TextInput
              id={FIELD.phone}
              type="tel"
              inputMode="tel"
              value={customer.phone}
              error={errors[FIELD.phone]}
              placeholder="e.g. +447700900123"
              onChange={(phone) => set({ phone })}
            />
          </Field>
          <Field id={FIELD.firstName} label="First Name" error={errors[FIELD.firstName]}>
            <TextInput
              id={FIELD.firstName}
              value={customer.firstName}
              error={errors[FIELD.firstName]}
              placeholder="e.g. John"
              onChange={(firstName) => set({ firstName })}
            />
          </Field>
          <Field id={FIELD.lastName} label="Last Name" error={errors[FIELD.lastName]}>
            <TextInput
              id={FIELD.lastName}
              value={customer.lastName}
              error={errors[FIELD.lastName]}
              placeholder="e.g. Smith"
              onChange={(lastName) => set({ lastName })}
            />
          </Field>
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
