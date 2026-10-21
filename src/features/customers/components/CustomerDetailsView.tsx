import { useEffect, useState } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailSkeleton, RawJsonPanel } from '../../../components/ui/DetailSection.tsx'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  TrashIcon,
} from '../../../components/ui/icons.tsx'
import { initials } from '../../../lib/format.ts'
import { useCustomerDetails } from '../hooks/useCustomerDetails.ts'
import {
  capitalize,
  customerName,
  customerSource,
  roleTone,
  stateTone,
} from '../utils/format.ts'
import {
  CustomerAddressesPanel,
  CustomerMarketingPanel,
  CustomerMetafieldsPanel,
  CustomerOverviewPanel,
} from './CustomerDetailPanels.tsx'

type TabId = 'overview' | 'addresses' | 'marketing' | 'metafields' | 'raw'

interface CustomerDetailsViewProps {
  id: string
  onBack: () => void
  /** Ask to delete this customer (the page shows the confirmation). */
  onDelete: (customer: { name: string; shop: string | null; ordersCount: number }) => void
}

/**
 * A customer's full details, shown in place of the list (same page, no
 * overlay). The header and summary draw straight from the list row while the
 * full record loads, so nothing waits on the network when you come from the
 * list.
 */
export function CustomerDetailsView({ id, onBack, onDelete }: CustomerDetailsViewProps) {
  const details = useCustomerDetails(id)
  const { customer, preview } = details
  const [tab, setTab] = useState<TabId>('overview')
  const { loadRaw } = details

  // The raw Shopify payload is big, so only fetch it when its tab opens.
  useEffect(() => {
    if (tab === 'raw') loadRaw()
  }, [tab, loadRaw])

  const known = customer ?? preview
  const name = known ? customerName(known) : 'Loading customer…'
  const email = known?.email
  const state = known?.shopify_state
  const metafieldCount = customer?.metafields.length ?? 0

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'addresses', label: 'Addresses', count: customer?.addresses.length },
    { id: 'marketing', label: 'Marketing & Tax' },
    ...(metafieldCount > 0
      ? [{ id: 'metafields' as const, label: 'Metafields', count: metafieldCount }]
      : []),
    { id: 'raw', label: 'Raw data' },
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
            Back to list
          </button>
        </div>
      </section>
    )
  }

  return (
    <article className="border-border bg-bg overflow-hidden rounded-2xl border">
      <header className="flex items-start gap-4 p-4 sm:p-6">
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold"
        >
          {initials(name) || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-snug font-bold break-words sm:text-2xl">
            {name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.85rem]">
            {known && (
              <>
                <Badge tone={roleTone(known.role)}>{capitalize(known.role)}</Badge>
                {state ? (
                  <Badge tone={stateTone(state)}>{capitalize(state)}</Badge>
                ) : (
                  <Badge tone="neutral">{customerSource(known)}</Badge>
                )}
              </>
            )}
            {email && (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{email}</span>
                <CopyButton value={email} label="Copy email" />
              </span>
            )}
            {details.isRefreshing && (
              <span className="text-text-muted text-[0.75rem]" role="status">
                Updating…
              </span>
            )}
          </div>
        </div>
        {known && (
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
            className="border-border bg-bg text-text-muted hover:text-danger hover:border-danger flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            <TrashIcon width={16} height={16} />
            <span className="hidden sm:inline" aria-hidden="true">
              Delete
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold transition-colors"
        >
          <ArrowLeftIcon width={16} height={16} />
          <span className="hidden sm:inline" aria-hidden="true">
            Back to list
          </span>
        </button>
      </header>

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
              {item.label}
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
        {tab !== 'overview' && tab !== 'raw' && !customer && <DetailSkeleton />}
        {customer && tab === 'addresses' && (
          <CustomerAddressesPanel customer={customer} />
        )}
        {customer && tab === 'marketing' && (
          <CustomerMarketingPanel customer={customer} />
        )}
        {customer && tab === 'metafields' && (
          <CustomerMetafieldsPanel customer={customer} />
        )}
        {tab === 'raw' && (
          <RawJsonPanel
            raw={details.raw}
            isLoading={details.isRawLoading}
            error={details.rawError}
            onRetry={details.loadRaw}
          />
        )}
      </div>
    </article>
  )
}
