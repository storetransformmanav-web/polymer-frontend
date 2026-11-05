import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { MapPinIcon } from '../../../components/ui/icons.tsx'
import type { OrderAddress, OrderDetail } from '../../../lib/api/endpoints.ts'
import { formatAddressLines } from '../utils/format.ts'
import { MiniCard } from './OrderCompact.tsx'

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
 * One address as a small card: a place icon, what it is, a copy button, then the name, company,
 * street, town and postcode, region and country as they would be written on a parcel, and the
 * phone number under them.
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
    <section
      aria-label={title}
      className="border-border bg-surface/40 flex min-w-0 flex-col gap-2 rounded-lg border px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <MapPinIcon width={14} height={14} className="text-accent shrink-0" />
        <h4 className="text-text-muted m-0 min-w-0 flex-1 text-[0.68rem] font-bold tracking-wide uppercase">
          {title}
        </h4>
        {!empty && (
          <CopyButton
            value={addressText(address)}
            label={`Copy ${title.toLowerCase()}`}
          />
        )}
      </div>

      {empty ? (
        <p className="text-text-muted m-0 text-[0.78rem]">No address.</p>
      ) : (
        <address className="m-0 flex flex-col text-[0.78rem] leading-snug not-italic">
          {name && <span className="text-[0.82rem] font-semibold">{name}</span>}
          {company && <span className="text-text-muted">{company}</span>}
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
          {phone && <span className="text-text-muted mt-1">{phone}</span>}
        </address>
      )}

      {note && !empty && (
        <p className="text-text-muted m-0 text-[0.7rem] font-medium">{note}</p>
      )}
    </section>
  )
}

/**
 * The Overview's **Addresses** card: the shipping address and the billing address side by side
 * (stacked on a phone). When both are the same place the billing card says so.
 */
export function OrderAddresses({
  order,
}: {
  order: Pick<OrderDetail, 'shipping_address' | 'billing_address'>
}) {
  const shipping = addressText(order.shipping_address)
  const same = shipping !== '' && shipping === addressText(order.billing_address)

  return (
    <MiniCard title="Addresses" count={2} icon={MapPinIcon}>
      <div className="grid gap-2.5 py-1 md:grid-cols-2">
        <AddressCard title="Shipping address" address={order.shipping_address} />
        <AddressCard
          title="Billing address"
          address={order.billing_address}
          note={same ? 'Same as the shipping address.' : undefined}
        />
      </div>
    </MiniCard>
  )
}
