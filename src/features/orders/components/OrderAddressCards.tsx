import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { MapPinIcon } from '../../../components/ui/icons.tsx'
import type { OrderAddress, OrderDetail } from '../../../lib/api/endpoints.ts'
import { formatAddressLines } from '../utils/format.ts'
import { FoldCard } from './OrderCompact.tsx'

/** The pieces of an address, in reading order. */
function addressParts(address: OrderAddress | null | undefined) {
  const name =
    address?.name || [address?.first_name, address?.last_name].filter(Boolean).join(' ')
  return {
    name: name.trim(),
    company: address?.company?.trim() ?? '',
    lines: formatAddressLines(address),
    phone: address?.phone?.trim() ?? '',
  }
}

/** The address as plain text, for the copy button and for telling two addresses apart. */
function addressText(address: OrderAddress | null | undefined): string {
  const { name, company, lines } = addressParts(address)
  return [name, company, ...lines].filter(Boolean).join('\n')
}

/**
 * One address as a card that folds: its title row, then the name, company, street, town and
 * postcode, region and country as they would be written on a parcel, the phone number under them,
 * and a copy button.
 */
function AddressCard({
  title,
  address,
  note,
}: {
  title: string
  address: OrderAddress | null | undefined
  /** A line under the address (the billing address says when it is the shipping one). */
  note?: string
}) {
  const { name, company, lines, phone } = addressParts(address)
  const empty = !name && !company && lines.length === 0 && !phone

  return (
    <FoldCard title={title} icon={MapPinIcon} shrinkWhenFolded>
      {empty ? (
        <p className="text-text-muted m-0 py-1 text-[0.78rem]">No address.</p>
      ) : (
        <div className="flex flex-col gap-1.5 py-1">
          <div className="flex items-start justify-between gap-2">
            <address className="m-0 flex min-w-0 flex-col text-[0.78rem] leading-snug break-words not-italic">
              {name && <span className="text-[0.82rem] font-semibold">{name}</span>}
              {company && <span className="text-text-muted">{company}</span>}
              {lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
              {phone && <span className="text-text-muted mt-1">{phone}</span>}
            </address>
            <CopyButton
              value={addressText(address)}
              label={`Copy ${title.toLowerCase()}`}
            />
          </div>
          {note && (
            <p className="text-text-muted m-0 text-[0.7rem] font-medium">{note}</p>
          )}
        </div>
      )}
    </FoldCard>
  )
}

/**
 * The Overview's **Shipping address** and **Billing address** cards, which fold. They sit straight
 * in the row beside the Customer card, so all three are one size. When both are the same place
 * the billing card says so.
 */
export function OrderAddresses({
  order,
}: {
  order: Pick<OrderDetail, 'shipping_address' | 'billing_address'>
}) {
  const shipping = addressText(order.shipping_address)
  const same = shipping !== '' && shipping === addressText(order.billing_address)

  return (
    <>
      <AddressCard title="Shipping address" address={order.shipping_address} />
      <AddressCard
        title="Billing address"
        address={order.billing_address}
        note={same ? 'Same as the shipping address.' : undefined}
      />
    </>
  )
}
