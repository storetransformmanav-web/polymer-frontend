import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import { TagIcon } from '../../../components/ui/icons.tsx'
import type { OrderDetail, OrderListItem } from '../../../lib/api/endpoints.ts'
import type { OrderSavedHandler } from '../hooks/useOrderEdit.ts'
import { BillingAddressCard, ShippingAddressCard } from './OrderAddressCards.tsx'
import { Chips, MiniCard } from './OrderCompact.tsx'
import { FulfillmentsCard, ShippingMethodCard } from './OrderDeliveryCards.tsx'
import type { OrderEditContext } from './OrderInlineEdits.tsx'

interface DetailsPanelProps {
  order: OrderDetail | null
  /** The matching list row, so the cards can draw before the details arrive. */
  preview: OrderListItem | null
  /** The order number from the address, what the update is sent to. */
  reference: string
  shop: string | null
  /** A change was accepted (the order is read again from the API). */
  onSaved: OrderSavedHandler
}

/**
 * The **Overview** tab, in the same cards as a product's page. The **Shipping address** and the
 * **Billing address** side by side (they stay separate — they can differ); the **Shipping method**
 * (delivery method and cost, edited in place) beside the **Fulfillments**; then the **Tags**. The
 * order's number, date, customer, store, email and Shopify ID are in the page's header and the lines
 * and totals are on the **Items** tab, so none of them is repeated here. The shipping address is
 * edited with the card's pencil, then ✓ Save or ✕ Discard.
 */
export function OrderDetailsPanel({
  order,
  preview,
  reference,
  shop,
  onSaved,
}: DetailsPanelProps) {
  const source = order ?? preview
  const context: OrderEditContext | null = order
    ? { order, reference, shop, onSaved }
    : null

  // Nothing known yet (opened from a bare address): a placeholder, not cards of dashes.
  if (!source) return <DetailSkeleton />

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-stretch gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
        {context ? (
          <>
            <ShippingAddressCard context={context} />
            <BillingAddressCard context={context} />
          </>
        ) : (
          <>
            <DetailSkeleton />
            <DetailSkeleton />
          </>
        )}
      </div>

      {context && order && (
        <div className="grid items-stretch gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
          <ShippingMethodCard context={context} />
          <FulfillmentsCard order={order} />
        </div>
      )}

      {order && order.tags.length > 0 && (
        <MiniCard title="Tags" icon={TagIcon} count={order.tags.length}>
          <Chips items={order.tags} />
        </MiniCard>
      )}
    </div>
  )
}
