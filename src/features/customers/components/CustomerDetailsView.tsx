import { useState } from 'react'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import {
  DetailsHeader,
  HeaderChip,
  HeaderTile,
  StatusPill,
} from '../../../components/ui/DetailsHeader.tsx'
import {
  AlertTriangleIcon,
  CalendarIcon,
  MailIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { useAccess } from '../../../hooks/useAccess.ts'
import { formatDateTimeAmPm, initials } from '../../../lib/format.ts'
import { useCustomerDetails } from '../hooks/useCustomerDetails.ts'
import { capitalize, customerName, customerSource, stateTone } from '../utils/format.ts'
import {
  CustomerAddressesPanel,
  CustomerMarketingPanel,
  CustomerOverviewPanel,
} from './CustomerDetailPanels.tsx'
import { CustomerLockAccessPanel } from './CustomerLockAccessPanel.tsx'
import { CustomerOrderHistory, type OpenOrderRequest } from './CustomerOrderHistory.tsx'
import { CustomerMetafieldsPanel } from './CustomerMetafieldsPanel.tsx'
import { CustomerTimelinePanel } from './CustomerTimelinePanel.tsx'

type TabId =
  'overview' | 'orders' | 'timeline' | 'addresses' | 'marketing' | 'lock' | 'metafields'

interface CustomerDetailsViewProps {
  id: string
  onBack: () => void
  /**
   * Ask to delete this customer (the page shows the confirmation). Left out where the
   * customer is only being looked at (opened from an order): no Delete button then.
   */
  onDelete?: (customer: {
    name: string
    shop: string | null
    ordersCount: number
  }) => void
  /** What the back button says; "Back to list" by default. */
  backLabel?: string
  /** Opens an order from the Orders tab as a tab of its own (see the Customers page). */
  onOpenOrder?: (order: OpenOrderRequest) => void
}

/**
 * A customer's full details, shown in place of the list (same page, no
 * overlay). The header and summary draw straight from the list row while the
 * full record loads, so nothing waits on the network when you come from the
 * list.
 */
export function CustomerDetailsView({
  id,
  onBack,
  onDelete,
  backLabel = 'Back to list',
  onOpenOrder,
}: CustomerDetailsViewProps) {
  const details = useCustomerDetails(id)
  const { customer, preview } = details
  // Lock Access is for people who may view lock management (the backend still decides).
  const canSeeLocks = useAccess('access').canView
  const [selectedTab, setTab] = useState<TabId>('overview')
  // The Addresses tab is opened by "View more addresses" on the Overview (for this customer) and
  // can be closed with its ✕, which goes back to the Orders tab.
  const [addressesFor, setAddressesFor] = useState<string | null>(null)
  const addressesOpen = addressesFor === id
  const tab: TabId =
    selectedTab === 'addresses' && !addressesOpen ? 'overview' : selectedTab

  const known = customer ?? preview
  const name = known ? customerName(known) : 'Loading customer…'
  const email = known?.email
  const state = known?.shopify_state
  const created = customer
    ? (customer.created_at ?? customer.shopify_created_at)
    : preview?.shopify_created_at
  const metafieldCount = customer?.metafields.length ?? 0

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    ...(addressesOpen
      ? [
          {
            id: 'addresses' as const,
            label: 'Addresses',
            count: customer?.addresses.length ?? 0,
          },
        ]
      : []),
    {
      id: 'orders',
      label: 'Orders',
      count: customer?.order_summary?.orders_in_shopify ?? customer?.orders_count,
    },
    { id: 'marketing', label: 'Marketing & Tax' },
    ...(metafieldCount > 0
      ? [{ id: 'metafields' as const, label: 'Metafields', count: metafieldCount }]
      : []),
    { id: 'timeline', label: 'Timeline' },
    ...(canSeeLocks ? [{ id: 'lock' as const, label: 'Lock Access' }] : []),
  ]

  if (details.error) {
    return (
      <section className="border-border bg-bg flex flex-col items-center gap-3 rounded-2xl border px-4 py-16 text-center">
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="font-semibold">Couldn&apos;t load this customer</p>
          <p className="text-text-muted text-[0.9rem]">{details.error}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={details.retry}
            className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onBack}
            className="border-border bg-bg text-text-muted hover:text-text cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            {backLabel}
          </button>
        </div>
      </section>
    )
  }

  return (
    <article className="border-border bg-bg flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1">
      <DetailsHeader
        visual={<HeaderTile>{initials(name) || '?'}</HeaderTile>}
        title={name}
        status={
          <>
            {known && (
              <StatusPill
                label={state ? capitalize(state) : customerSource(known)}
                tone={state ? stateTone(state) : 'neutral'}
              />
            )}
            {details.isRefreshing && (
              <span className="text-text-muted text-[0.75rem]" role="status">
                Updating…
              </span>
            )}
          </>
        }
        chips={
          known && (
            <>
              <HeaderChip icon={UsersIcon} label="Role">
                {capitalize(known.role)}
              </HeaderChip>
              {email && (
                <HeaderChip icon={MailIcon} label="Email">
                  <span className="flex items-center gap-1.5">
                    <span className="break-all">{email}</span>
                    <CopyButton value={email} label="Copy email" />
                  </span>
                </HeaderChip>
              )}
              {created && (
                <HeaderChip icon={CalendarIcon} label="Created">
                  <span aria-hidden="true" className="text-text-muted">
                    Created{' '}
                  </span>
                  {formatDateTimeAmPm(created)}
                </HeaderChip>
              )}
              {customer?.updated_at && (
                <HeaderChip icon={CalendarIcon} label="Updated">
                  <span aria-hidden="true" className="text-text-muted">
                    Updated{' '}
                  </span>
                  {formatDateTimeAmPm(customer.updated_at)}
                </HeaderChip>
              )}
            </>
          )
        }
        actions={
          known && onDelete ? (
            <button
              type="button"
              onClick={() =>
                onDelete({
                  name,
                  shop: known.shop?.key ?? null,
                  ordersCount: known.orders_count,
                })
              }
              aria-label={`Delete ${name}`}
              className="border-border bg-bg text-text-muted hover:text-danger hover:border-danger flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition-colors"
            >
              <TrashIcon width={16} height={16} />
              <span className="hidden sm:inline" aria-hidden="true">
                Delete
              </span>
            </button>
          ) : null
        }
        onBack={onBack}
        backLabel={backLabel}
      />

      <div
        role="tablist"
        aria-label="Customer sections"
        className="border-border flex [scrollbar-width:none] gap-1 overflow-x-auto border-y px-2 sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((item) => {
          const selected = item.id === tab
          const closable = item.id === 'addresses'
          const label =
            item.id === 'metafields' ? (
              // The same small red note under the label as a product's Metafields tab.
              <span className="flex flex-col items-start leading-tight">
                {item.label}
                <span className="text-danger text-[0.65rem] font-normal">
                  Under Progress
                </span>
              </span>
            ) : (
              item.label
            )
          const count = item.count !== undefined && (
            <span className="bg-surface text-text-muted border-border rounded-full border px-1.5 py-0.5 text-[0.68rem] font-bold">
              {item.count}
            </span>
          )
          const colour = selected
            ? 'border-accent text-text'
            : 'text-text-muted hover:text-text border-transparent'
          if (closable) {
            return (
              <div
                key={item.id}
                className={`-mb-px flex shrink-0 items-center border-0 border-b-2 pr-2 transition-colors ${colour}`}
              >
                <button
                  id={`customer-tab-${item.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls="customer-tabpanel"
                  onClick={() => setTab(item.id)}
                  className="flex cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-3 text-[0.85rem] font-semibold whitespace-nowrap text-current"
                >
                  {label}
                  {count}
                </button>
                <button
                  type="button"
                  aria-label="Close the Addresses tab"
                  title="Close"
                  onClick={() => {
                    setAddressesFor(null)
                    setTab('orders')
                  }}
                  className="text-text-muted hover:bg-surface hover:text-text flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-colors"
                >
                  <XIcon width={12} height={12} />
                </button>
              </div>
            )
          }
          return (
            <button
              key={item.id}
              id={`customer-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="customer-tabpanel"
              onClick={() => setTab(item.id)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-3 text-[0.85rem] font-semibold whitespace-nowrap transition-colors ${colour}`}
            >
              {label}
              {count}
            </button>
          )
        })}
      </div>

      <div
        id="customer-tabpanel"
        role="tabpanel"
        aria-labelledby={`customer-tab-${tab}`}
        // From `lg` the page does not scroll as a whole: the header and tabs stay put and the tab's
        // content scrolls in this box (the Orders table and the Lock Access lists scroll in their own boxes instead).
        className={`bg-surface p-3 sm:p-5 lg:min-h-0 lg:flex-1 ${
          tab === 'orders' || tab === 'lock'
            ? 'lg:flex lg:flex-col lg:overflow-hidden'
            : 'lg:overflow-y-auto'
        }`}
      >
        {tab === 'overview' && (
          <CustomerOverviewPanel
            customer={customer}
            preview={preview}
            onShowAddresses={() => {
              setAddressesFor(id)
              setTab('addresses')
            }}
            onViewOrderHistory={() => setTab('orders')}
          />
        )}
        {customer && tab === 'addresses' && (
          <CustomerAddressesPanel customer={customer} />
        )}
        {customer && tab === 'timeline' && (
          <CustomerTimelinePanel customer={customer} onOpenOrder={onOpenOrder} />
        )}
        {customer && tab === 'orders' && (
          <CustomerOrderHistory customer={customer} onOpenOrder={onOpenOrder} />
        )}
        {tab !== 'overview' && !customer && <DetailSkeleton />}
        {customer && tab === 'marketing' && (
          <CustomerMarketingPanel customer={customer} />
        )}
        {customer && tab === 'lock' && <CustomerLockAccessPanel customer={customer} />}
        {customer && tab === 'metafields' && (
          <CustomerMetafieldsPanel customer={customer} />
        )}
      </div>
    </article>
  )
}
