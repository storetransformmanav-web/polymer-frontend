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
} from '../../../components/ui/icons.tsx'
import { formatDate, initials } from '../../../lib/format.ts'
import { useCustomerDetails } from '../hooks/useCustomerDetails.ts'
import { capitalize, customerName, customerSource, stateTone } from '../utils/format.ts'
import { CustomerMarketingPanel, CustomerOverviewPanel } from './CustomerDetailPanels.tsx'
import { CustomerMetafieldsPanel } from './CustomerMetafieldsPanel.tsx'

type TabId = 'overview' | 'marketing' | 'metafields'

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
}: CustomerDetailsViewProps) {
  const details = useCustomerDetails(id)
  const { customer, preview } = details
  const [tab, setTab] = useState<TabId>('overview')

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
    { id: 'marketing', label: 'Marketing & Tax' },
    ...(metafieldCount > 0
      ? [{ id: 'metafields' as const, label: 'Metafields', count: metafieldCount }]
      : []),
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
    <article className="border-border bg-bg overflow-hidden rounded-2xl border">
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
                  {formatDate(created)}
                </HeaderChip>
              )}
              {customer?.updated_at && (
                <HeaderChip icon={CalendarIcon} label="Updated">
                  {formatDate(customer.updated_at)}
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
          return (
            <button
              key={item.id}
              id={`customer-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="customer-tabpanel"
              onClick={() => setTab(item.id)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-3 text-[0.85rem] font-semibold whitespace-nowrap transition-colors ${
                selected
                  ? 'border-accent text-text'
                  : 'text-text-muted hover:text-text border-transparent'
              }`}
            >
              {item.id === 'metafields' ? (
                // The same small red note under the label as a product's Metafields tab.
                <span className="flex flex-col items-start leading-tight">
                  {item.label}
                  <span className="text-danger text-[0.65rem] font-normal">
                    Under Progress
                  </span>
                </span>
              ) : (
                item.label
              )}
              {item.count !== undefined && (
                <span className="bg-surface text-text-muted border-border rounded-full border px-1.5 py-0.5 text-[0.68rem] font-bold">
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        id="customer-tabpanel"
        role="tabpanel"
        aria-labelledby={`customer-tab-${tab}`}
        className="bg-surface p-3 sm:p-5"
      >
        {tab === 'overview' && (
          <CustomerOverviewPanel customer={customer} preview={preview} />
        )}
        {tab !== 'overview' && !customer && <DetailSkeleton />}
        {customer && tab === 'marketing' && (
          <CustomerMarketingPanel customer={customer} />
        )}
        {customer && tab === 'metafields' && (
          <CustomerMetafieldsPanel customer={customer} />
        )}
      </div>
    </article>
  )
}
