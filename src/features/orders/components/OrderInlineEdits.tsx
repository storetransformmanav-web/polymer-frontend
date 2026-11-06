import { useMemo, type KeyboardEvent, type ReactNode } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { DoubleClickEdit } from '../../../components/ui/DoubleClickEdit.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import {
  CheckIcon,
  InfoIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import { countryOptions } from '../../../lib/countries.ts'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'
import {
  useOrderEdit,
  type OrderEdit,
  type OrderSavedHandler,
} from '../hooks/useOrderEdit.ts'
import { EMAIL, MONEY, ORDER_LIMITS, WHOLE, type DraftLine } from '../utils/orderDraft.ts'
import { draftFromOrder, EDIT_FIELD } from '../utils/orderEdit.ts'
import {
  Field,
  FIELD_TEXTAREA,
  ICON_BUTTON,
  PRIMARY_BUTTON,
  QUANTITY_STEP,
  SECONDARY_BUTTON,
  TextInput,
  Thumb,
} from './create/formParts.tsx'
import { ProductSearch } from './create/OrderLinesCard.tsx'
import { MINI_ROW, MINI_TD } from './OrderCompact.tsx'
import { OrderItemsSummary } from './OrderItemsPanel.tsx'

/** What every editable piece of the page needs to know. */
export interface OrderEditContext {
  order: OrderDetail
  reference: string
  shop: string | null
  onSaved: OrderSavedHandler
}

/** Pencil → (✓ Save, ✕ Discard), the same controls as a product's sections. */
export function OrderEditControls({ edit, what }: { edit: OrderEdit; what: string }) {
  if (!edit.editing) {
    return (
      <IconAction
        label="Edit"
        accessibleLabel={`Edit ${what}`}
        icon={PencilIcon}
        onClick={edit.start}
      />
    )
  }
  return (
    <>
      <IconAction
        label="Save"
        accessibleLabel={`Save ${what}`}
        icon={CheckIcon}
        tone="primary"
        disabled={!edit.dirty}
        busy={edit.isUpdating}
        onClick={edit.commit}
      />
      <IconAction
        label="Discard"
        accessibleLabel={`Discard ${what} changes`}
        icon={XIcon}
        tone="danger"
        disabled={edit.isUpdating}
        onClick={edit.discard}
      />
    </>
  )
}

/** Fields being edited: Escape discards them, as on a product's sections. */
export function OrderEditArea({
  edit,
  children,
}: {
  edit: OrderEdit
  children: ReactNode
}) {
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !edit.confirming) {
      event.stopPropagation()
      edit.discard()
    }
  }
  return (
    <div onKeyDown={onKeyDown} className="flex flex-col gap-3 py-1.5">
      {children}
      {Object.keys(edit.errors).length > 0 && (
        <FormMessage tone="error">Fix the highlighted fields to save.</FormMessage>
      )}
    </div>
  )
}

/**
 * "Are you sure?" — asked before any change is sent, because it also goes to Shopify. The same
 * wording and layout as a product's: what changes in a card, Cancel focused. A staff note, for why
 * the order is changing, can go with it. A refusal stays here with the backend's message.
 */
export function OrderUpdateQuestion({
  edit,
  order,
}: {
  edit: OrderEdit
  order: OrderDetail
}) {
  if (!edit.confirming) return null
  return (
    <Dialog
      title={`Update order #${order.order_number ?? order.name}?`}
      role="alertdialog"
      onClose={() => !edit.isUpdating && edit.cancelConfirm()}
      closeDisabled={edit.isUpdating}
      icon={
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        >
          <InfoIcon width={20} height={20} />
        </span>
      }
      footer={
        <>
          <button
            type="button"
            data-autofocus
            disabled={edit.isUpdating}
            onClick={edit.cancelConfirm}
            className={SECONDARY_BUTTON}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={edit.isUpdating}
            onClick={() => void edit.confirmSave()}
            className={PRIMARY_BUTTON}
          >
            {edit.isUpdating && (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            )}
            {edit.isUpdating ? 'Updating…' : 'Yes, update'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-text m-0 text-[0.95rem] font-semibold">
          Are you sure you want to update this?
        </p>
        <p className="m-0">These changes will also be updated in Shopify.</p>
      </div>
      <ul className="border-border-strong border-l-accent bg-accent-tint/40 m-0 flex min-w-0 list-none flex-col gap-1 border border-l-4 p-3 text-[0.85rem] break-words">
        {edit.changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
      <Field id={EDIT_FIELD.staffNote} label="Staff note" optional>
        <textarea
          id={EDIT_FIELD.staffNote}
          value={edit.staffNote}
          placeholder="Customer asked for one more box"
          onChange={(event) => edit.setStaffNote(event.target.value)}
          className={FIELD_TEXTAREA}
        />
      </Field>
      {edit.error && <FormMessage tone="error">{edit.error}</FormMessage>}
    </Dialog>
  )
}

/** One value changed where it is shown: double-click it, or its small pencil. */
function OrderValueCell({
  context,
  value,
  display,
  label,
  validate,
  toDraft,
  inputMode,
}: {
  context: OrderEditContext
  value: string
  display: ReactNode
  label: string
  validate: (next: string) => string | null
  toDraft: (next: string) => Parameters<OrderEdit['ask']>[0]
  inputMode?: 'decimal'
}) {
  const { order, reference, shop, onSaved } = context
  const edit = useOrderEdit(order, reference, shop, onSaved)
  return (
    <>
      <DoubleClickEdit
        value={value}
        display={display}
        label={label}
        align="right"
        showIcon
        inputMode={inputMode}
        busy={edit.confirming}
        validate={validate}
        onCommit={(next) => edit.ask(toDraft(next))}
      />
      <OrderUpdateQuestion edit={edit} order={order} />
    </>
  )
}

/** The order's email (`email`). */
export function OrderEmailCell({
  context,
  display,
}: {
  context: OrderEditContext
  display: ReactNode
}) {
  return (
    <OrderValueCell
      context={context}
      value={context.order.email ?? ''}
      display={display}
      label="Order email"
      validate={(next) =>
        EMAIL.test(next) ? null : 'Enter an email address such as name@example.com.'
      }
      toDraft={(email) => ({ email })}
    />
  )
}

/** The delivery's name (`shipping.title`; an order with several delivery lines: the first). */
export function OrderDeliveryMethodCell({
  context,
  display,
}: {
  context: OrderEditContext
  display: ReactNode
}) {
  return (
    <OrderValueCell
      context={context}
      value={context.order.shipping_lines[0]?.title ?? ''}
      display={display}
      label="Delivery method"
      validate={(next) => (next ? null : 'Name the delivery, e.g. Standard delivery.')}
      toDraft={(shippingTitle) => ({ shippingTitle })}
    />
  )
}

/** What the delivery costs (`shipping.price`). It needs a delivery to belong to. */
export function OrderDeliveryCostCell({
  context,
  display,
}: {
  context: OrderEditContext
  display: ReactNode
}) {
  const line = context.order.shipping_lines[0]
  return (
    <OrderValueCell
      context={context}
      value={line?.price ?? ''}
      display={display}
      label="Shipping charged"
      inputMode="decimal"
      validate={(next) => {
        if (!line?.title) return 'Add the delivery method first.'
        return MONEY.test(next) ? null : 'A price such as 4.95.'
      }}
      toDraft={(shippingPrice) => ({ shippingPrice })}
    />
  )
}

/** The shipping address's fields (`shipping_address`), in place of the address. */
export function ShippingAddressEditor({ edit }: { edit: OrderEdit }) {
  const a = edit.draft?.address
  if (!a) return null
  const { errors } = edit
  const set = (patch: Partial<typeof a>) => edit.change({ address: { ...a, ...patch } })
  return (
    <OrderEditArea edit={edit}>
      <div className="grid gap-3 text-[0.8rem] [&_input]:h-9 [&_input]:text-[0.82rem] [&_label]:text-[0.75rem]">
        <Field id={EDIT_FIELD.firstName} label="First name" optional>
          <TextInput
            id={EDIT_FIELD.firstName}
            value={a.firstName}
            onChange={(firstName) => set({ firstName })}
          />
        </Field>
        <Field id={EDIT_FIELD.lastName} label="Last name" optional>
          <TextInput
            id={EDIT_FIELD.lastName}
            value={a.lastName}
            onChange={(lastName) => set({ lastName })}
          />
        </Field>
        <Field id={EDIT_FIELD.company} label="Company" optional>
          <TextInput
            id={EDIT_FIELD.company}
            value={a.company}
            onChange={(company) => set({ company })}
          />
        </Field>
        <Field
          id={EDIT_FIELD.address1}
          label="Address"
          error={errors[EDIT_FIELD.address1]}
        >
          <TextInput
            id={EDIT_FIELD.address1}
            value={a.address1}
            error={errors[EDIT_FIELD.address1]}
            onChange={(address1) => set({ address1 })}
          />
        </Field>
        <Field id={EDIT_FIELD.address2} label="Apartment, suite, etc." optional>
          <TextInput
            id={EDIT_FIELD.address2}
            value={a.address2}
            onChange={(address2) => set({ address2 })}
          />
        </Field>
        <Field id={EDIT_FIELD.city} label="City" error={errors[EDIT_FIELD.city]}>
          <TextInput
            id={EDIT_FIELD.city}
            value={a.city}
            error={errors[EDIT_FIELD.city]}
            onChange={(city) => set({ city })}
          />
        </Field>
        <Field id={EDIT_FIELD.zip} label="Postcode" optional>
          <TextInput id={EDIT_FIELD.zip} value={a.zip} onChange={(zip) => set({ zip })} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <SelectField
            id={EDIT_FIELD.country}
            label="Country"
            value={a.countryCode}
            options={countryOptions()}
            onChange={(countryCode) => set({ countryCode })}
          />
          {errors[EDIT_FIELD.country] && (
            <p role="alert" className="text-danger text-[0.78rem]">
              {errors[EDIT_FIELD.country]}
            </p>
          )}
        </div>
        <Field
          id={EDIT_FIELD.phone}
          label="Phone"
          error={errors[EDIT_FIELD.phone]}
          optional
        >
          <TextInput
            id={EDIT_FIELD.phone}
            type="tel"
            inputMode="tel"
            value={a.phone}
            error={errors[EDIT_FIELD.phone]}
            onChange={(phone) => set({ phone })}
          />
        </Field>
      </div>
    </OrderEditArea>
  )
}

/**
 * A quantity with − and + beside it: a click changes it by one, and a double-click on the number
 * lets it be typed. Nothing is sent from here.
 */
function QuantityCell({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (quantity: string) => void
}) {
  const current = Number.parseInt(value, 10)
  const known = Number.isFinite(current)
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <button
        type="button"
        aria-label={`One fewer of ${name}`}
        disabled={known && current <= 1}
        onClick={() => onChange(String(known ? current - 1 : 1))}
        className={QUANTITY_STEP}
      >
        <MinusIcon width={13} height={13} />
      </button>
      <DoubleClickEdit
        value={value}
        display={value}
        label={`Quantity of ${name}`}
        align="center"
        autoWidth
        inputMode="numeric"
        validate={(next) => {
          if (!WHOLE.test(next) || Number(next) < 1) return 'A whole number, 1 or more.'
          return Number(next) > ORDER_LIMITS.quantity
            ? `At most ${ORDER_LIMITS.quantity}.`
            : null
        }}
        onCommit={onChange}
      />
      <button
        type="button"
        aria-label={`One more of ${name}`}
        onClick={() => onChange(String(known ? current + 1 : 1))}
        className={QUANTITY_STEP}
      >
        <PlusIcon width={13} height={13} />
      </button>
    </span>
  )
}

/**
 * The Overview's Items card, ready to change at any time: − and + on each quantity (a double-click
 * types it), and a search to add a product. Changes wait here, and ✓ Save and ✕ Discard appear in
 * the title row as soon as there are any; nothing is sent before ✓ and "Yes, update". Until the
 * order has been read again, the Total column and the totals are still the API's own figures.
 */
export function EditableOrderItems({ context }: { context: OrderEditContext }) {
  const { order, reference, shop, onSaved } = context
  const edit = useOrderEdit(order, reference, shop, onSaved)
  const base = useMemo(() => draftFromOrder(order), [order])
  const quantities = edit.draft?.quantities ?? base.quantities
  const added = edit.draft?.added ?? []

  const changeAdded = (update: (current: DraftLine[]) => DraftLine[]) =>
    edit.draft
      ? edit.change({ added: update(added) })
      : edit.begin({ added: update(added) })
  const setQuantity = (id: string, quantity: string) => {
    const next = { ...quantities, [id]: quantity }
    if (edit.draft) edit.change({ quantities: next })
    else edit.begin({ quantities: next })
  }

  return (
    <>
      <OrderItemsSummary
        items={order.line_items}
        totals={order}
        taxesIncluded={order.taxes_included}
        tip={order.total_tip}
        outstanding={order.total_outstanding}
        forceOpen={edit.dirty}
        actions={edit.dirty ? <OrderEditControls edit={edit} what="items" /> : undefined}
        above={
          <ProductSearch
            id="order-edit-product-search"
            shop={order.shop?.key ?? shop ?? ''}
            noMatchHint="Try another name or SKU."
            onAdd={changeAdded}
          />
        }
        quantityOf={(item) => {
          const quantity = quantities[item.id]
          // A line already removed from the order has nothing left to change.
          if (quantity === undefined) return item.quantity ?? '—'
          return (
            <QuantityCell
              name={item.title || 'Item'}
              value={quantity}
              onChange={(next) => setQuantity(item.id, next)}
            />
          )
        }}
        extraRows={
          added.length > 0
            ? added.map((line) => {
                if (line.kind !== 'variant') return null
                const quantity = Number.parseInt(line.quantity, 10)
                return (
                  <tr key={line.key} className={`${MINI_ROW} bg-accent-tint/50`}>
                    <td className={MINI_TD}>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Thumb url={line.imageUrl} alt="" />
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold break-words">
                            {line.productTitle}
                          </span>
                          <span className="text-text-muted truncate text-[0.7rem]">
                            {['New', line.variantTitle, line.sku]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={`${MINI_TD} text-right tabular-nums`}>
                      {formatPrice(line.price, order.currency)}
                    </td>
                    <td className={`${MINI_TD} text-center tabular-nums`}>
                      <QuantityCell
                        name={line.productTitle}
                        value={line.quantity}
                        onChange={(next) =>
                          changeAdded((current) =>
                            current.map((candidate) =>
                              candidate.key === line.key
                                ? { ...candidate, quantity: next }
                                : candidate,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className={`${MINI_TD} text-right font-semibold tabular-nums`}>
                      <span className="inline-flex items-center justify-end gap-1.5">
                        {Number.isFinite(quantity)
                          ? formatPrice(Number(line.price) * quantity, order.currency)
                          : '—'}
                        <button
                          type="button"
                          aria-label={`Remove ${line.productTitle}`}
                          onClick={() =>
                            changeAdded((current) =>
                              current.filter((candidate) => candidate.key !== line.key),
                            )
                          }
                          className={ICON_BUTTON}
                        >
                          <TrashIcon width={15} height={15} />
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              })
            : undefined
        }
      />
      <OrderUpdateQuestion edit={edit} order={order} />
    </>
  )
}
