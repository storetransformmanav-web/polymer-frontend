import type { ReactNode } from 'react'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { MapPinIcon, PhoneIcon } from '../../../components/ui/icons.tsx'
import type { OrderAddress } from '../../../lib/api/endpoints.ts'
import { useOrderEdit } from '../hooks/useOrderEdit.ts'
import { formatAddressLines } from '../utils/format.ts'
import { FoldCard } from './OrderCompact.tsx'
import {
  OrderEditControls,
  OrderUpdateQuestion,
  ShippingAddressEditor,
  type OrderEditContext,
} from './OrderInlineEdits.tsx'

/** The pieces of an address, in reading order. */
function addressParts(address: OrderAddress | null | undefined) {
  const name =
    address?.name || [address?.first_name, address?.last_name].filter(Boolean).join(' ')
  return {
    name: name.trim(),
    company: address?.company?.trim() ?? '',
    lines: formatAddressLines(address),
    // The same parts on one line, as they would be said: "331 Kenton Road, Harrow, London, England,
    // United Kingdom" — so the card needs a line or two, not one for every part.
    summary: [
      address?.address1,
      address?.address2,
      address?.city,
      address?.province,
      address?.zip,
      address?.country,
    ]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(', '),
    phone: address?.phone?.trim() ?? '',
  }
}

/** The address as plain text, for the copy button and for telling two addresses apart. */
function addressText(address: OrderAddress | null | undefined): string {
  const { name, company, lines } = addressParts(address)
  return [name, company, ...lines].filter(Boolean).join('\n')
}

/**
 * One address as a card that folds: its title row, then the name and company on one line, the
 * street, town, region, postcode and country together on the next (a description, not a line per
 * part), the phone number under them and a copy button.
 */
function AddressCard({
  title,
  address,
  note,
  actions,
  editor = null,
}: {
  title: string
  address: OrderAddress | null | undefined
  /** A line under the address (the billing address says when it is the shipping one). */
  note?: string
  /** The pencil, or ✓ and ✕. */
  actions?: ReactNode
  /** The fields, in place of the address, while it is being edited. */
  editor?: ReactNode
}) {
  const { name, company, lines, summary, phone } = addressParts(address)
  const empty = !name && !company && lines.length === 0 && !phone

  return (
    <FoldCard
      title={title}
      icon={MapPinIcon}
      actions={actions}
      forceOpen={editor !== null}
    >
      {editor ??
        (empty ? (
          <p className="text-text-muted m-0 py-1 text-[0.78rem]">No address.</p>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <address className="m-0 flex min-w-0 flex-col gap-0.5 text-[0.85rem] leading-snug break-words not-italic">
              {(name || company) && (
                <span>
                  {name && <span className="font-semibold">{name}</span>}
                  {name && company && <span className="text-text-muted"> · </span>}
                  {company && <span className="text-text-muted">{company}</span>}
                </span>
              )}
              {summary && <span>{summary}</span>}
              {phone && (
                <span className="text-text-muted flex items-center gap-1.5">
                  <PhoneIcon width={14} height={14} className="shrink-0" />
                  {phone}
                </span>
              )}
            </address>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <CopyButton
                value={addressText(address)}
                label={`Copy ${title.toLowerCase()}`}
              />
              {note && (
                <span className="bg-accent-tint text-accent rounded-full px-3 py-1 text-[0.75rem] font-semibold">
                  {note}
                </span>
              )}
            </div>
          </div>
        ))}
    </FoldCard>
  )
}

/** The shipping address's card, with its pencil (`PATCH`'s `shipping_address`). */
export function ShippingAddressCard({ context }: { context: OrderEditContext }) {
  const { order, reference, shop, onSaved } = context
  const edit = useOrderEdit(order, reference, shop, onSaved)
  return (
    <>
      <AddressCard
        title="Shipping address"
        address={order.shipping_address}
        actions={<OrderEditControls edit={edit} what="shipping address" />}
        editor={edit.editing ? <ShippingAddressEditor edit={edit} /> : null}
      />
      <OrderUpdateQuestion edit={edit} order={order} />
    </>
  )
}

/**
 * The **Billing address** card, which folds. Only the shipping address can be edited: the update
 * API has no billing address. When both are the same place the card says so.
 */
export function BillingAddressCard({ context }: { context: OrderEditContext }) {
  const { order } = context
  const shipping = addressText(order.shipping_address)
  const same = shipping !== '' && shipping === addressText(order.billing_address)
  return (
    <AddressCard
      title="Billing address"
      address={order.billing_address}
      note={same ? 'Same as shipping' : undefined}
    />
  )
}

/** Both cards one after the other (the shipping address first). */
export function OrderAddresses({ context }: { context: OrderEditContext }) {
  return (
    <>
      <ShippingAddressCard context={context} />
      <BillingAddressCard context={context} />
    </>
  )
}
