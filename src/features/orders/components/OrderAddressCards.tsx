import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailSection } from '../../../components/ui/DetailSection.tsx'
import { MapPinIcon } from '../../../components/ui/icons.tsx'
import type { OrderAddress, OrderDetail } from '../../../lib/api/endpoints.ts'
import { formatAddressLines } from '../utils/format.ts'

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
      className="border-border bg-bg flex min-w-0 flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        >
          <MapPinIcon width={18} height={18} />
        </span>
        <h4 className="text-text-muted m-0 min-w-0 flex-1 text-[0.72rem] font-bold tracking-wide uppercase">
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
        <p className="text-text-muted m-0 text-[0.88rem]">No address.</p>
      ) : (
        <address className="m-0 flex flex-col gap-0.5 text-[0.9rem] leading-snug not-italic">
          {name && <span className="text-[0.95rem] font-semibold">{name}</span>}
          {company && <span className="text-text-muted">{company}</span>}
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
          {phone && (
            <span className="border-border text-text-muted mt-2 border-t pt-2 text-[0.84rem]">
              {phone}
            </span>
          )}
        </address>
      )}

      {note && !empty && (
        <p className="text-text-muted m-0 text-[0.76rem] font-medium">{note}</p>
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
    <DetailSection title="Addresses" count={2} icon={MapPinIcon}>
      <div className="grid gap-4 md:grid-cols-2">
        <AddressCard title="Shipping address" address={order.shipping_address} />
        <AddressCard
          title="Billing address"
          address={order.billing_address}
          note={same ? 'Same as the shipping address.' : undefined}
        />
      </div>
    </DetailSection>
  )
}
