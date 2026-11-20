import { useEffect, useState, type ReactNode } from 'react'
import {
  HeaderChip,
  HeaderTile,
  StatusPill,
} from '../../../components/ui/DetailsHeader.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import {
  AlertTriangleIcon,
  BoxesIcon,
  CalendarIcon,
  ClockIcon,
  CreditCardIcon,
  FileTextIcon,
  GlobeIcon,
  GridIcon,
  PoundIcon,
  ShoppingCartIcon,
} from '../../../components/ui/icons.tsx'
import type { SageStockItem } from '../../../lib/api/sageStock.ts'
import { useSageStockDetail } from '../hooks/useSageStockDetail.ts'
import { dateTimeText, statusPill } from '../utils/format.ts'
import { DetailPage } from './DetailPage.tsx'
import {
  OpenOrdersPanel,
  OverviewPanel,
  PricingPanel,
  SalesPanel,
  WebPanel,
} from './SageStockPanels.tsx'

interface SageStockDetailsViewProps {
  /** The stock code, as in the address — what the details are asked for by. */
  stockCode: string
  /** The list row, when the page was opened from the list: it draws the header while the details load. */
  preview: SageStockItem | null
  onBack: () => void
  /** Told the stock code once it is known, so the page can name its tab. */
  onLoaded?: (code: string) => void
}

const IDLE_TABS = [{ id: 'overview', label: 'Overview', icon: GridIcon }]

/** A header chip with its label in front: "Created at: 15 Sep 2025, 08:39 PM". */
function LabelledChip({
  icon,
  label,
  children,
}: {
  icon: typeof ClockIcon
  label: string
  children: ReactNode
}) {
  return (
    <HeaderChip icon={icon} label={label}>
      <span aria-hidden="true" className="text-text-muted">
        {label}:
      </span>{' '}
      {children}
    </HeaderChip>
  )
}

/**
 * One Sage stock item's page, in place of the list and laid out like a product's (and an order's): the
 * shared header — a tile, **Stock <code>**, its stock status as a labelled pill ("Status: In stock"),
 * and the description, when it was created and last updated and when the data was last read as labelled
 * chips, **Back to list** — then a tab strip and clearly labelled cards. The item is **asked for by its
 * stock code when the page opens** (`GET /api/sage/stock/{stock_code}`) and the answer is the **only**
 * source of what the page shows; while it loads the header draws from the list row. Tabs: **Overview**
 * (stock levels, item information, supplier and accounts, key dates), **Pricing** (prices, price lists,
 * discount bands), **Sales** (the year to date and each month beside the year before), **Web & Shopify**
 * (the web details and the CRM variants with this SKU) and **Open Orders**. Empty values show a dash.
 */
export function SageStockDetailsView({
  stockCode,
  preview,
  onBack,
  onLoaded,
}: SageStockDetailsViewProps) {
  const state = useSageStockDetail(stockCode)
  const detail = state.detail
  const [tab, setTab] = useState('overview')

  const shownCode = detail?.stock_code || preview?.stock_code || stockCode
  useEffect(() => {
    onLoaded?.(shownCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the code changes
  }, [shownCode])

  // The answer when it is there, else the list row.
  const source = detail ?? preview
  const status = source?.stock_status ?? ''
  const pill = status ? statusPill(status) : null
  const description = source?.description ?? ''

  const header = {
    idPrefix: 'sage-stock',
    visual: (
      <HeaderTile>
        <BoxesIcon width={26} height={26} />
      </HeaderTile>
    ),
    title: `Stock ${shownCode}`,
    titleHint: description || undefined,
    status: (
      <>
        {pill && <StatusPill label={`Status: ${pill.label}`} tone={pill.tone} />}
        {source?.inactive && <StatusPill label="Inactive" tone="neutral" />}
        {state.isRefreshing && (
          <span className="text-text-muted text-[0.75rem]" role="status">
            Updating…
          </span>
        )}
      </>
    ),
    chips: (
      <>
        {description && (
          <LabelledChip icon={FileTextIcon} label="Description">
            {description}
          </LabelledChip>
        )}
        {detail?.created_at && (
          <LabelledChip icon={CalendarIcon} label="Created at">
            {dateTimeText(detail.created_at)}
          </LabelledChip>
        )}
        {detail?.updated_at && (
          <LabelledChip icon={ClockIcon} label="Updated at">
            {dateTimeText(detail.updated_at)}
          </LabelledChip>
        )}
        {detail?.data_as_of && (
          <LabelledChip icon={ClockIcon} label="Data as of">
            {dateTimeText(detail.data_as_of)}
          </LabelledChip>
        )}
      </>
    ),
    onBack,
  }

  // Not there (yet): a quiet frame with the header from the list row, and why.
  if (!detail) {
    return (
      <DetailPage {...header} tabs={IDLE_TABS} tab="overview" onTab={() => {}}>
        {state.isPending ? (
          <>
            <span role="status" className="sr-only">
              Loading stock item {stockCode}…
            </span>
            <DetailSkeleton />
          </>
        ) : (
          <div className="text-text-muted flex flex-col items-center gap-3 py-10 text-center text-[0.9rem]">
            <AlertTriangleIcon width={28} height={28} className="text-danger" />
            <p className="text-text m-0 font-semibold">
              {state.notFound ? 'Stock item not found' : 'Couldn’t load this stock item'}
            </p>
            <p className="m-0">
              {state.notFound
                ? `There is no Sage stock item with the code “${stockCode}”.`
                : (state.error ?? 'Something went wrong.')}
            </p>
            {!state.notFound && (
              <button
                type="button"
                onClick={state.retry}
                className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </DetailPage>
    )
  }

  let content: ReactNode
  switch (tab) {
    case 'pricing':
      content = <PricingPanel detail={detail} />
      break
    case 'sales':
      content = <SalesPanel detail={detail} />
      break
    case 'web':
      content = <WebPanel detail={detail} />
      break
    case 'orders':
      content = <OpenOrdersPanel detail={detail} />
      break
    default:
      content = <OverviewPanel detail={detail} />
  }

  return (
    <DetailPage
      {...header}
      tabs={[
        { id: 'overview', label: 'Overview', icon: GridIcon },
        { id: 'pricing', label: 'Pricing', icon: CreditCardIcon },
        { id: 'sales', label: 'Sales', icon: PoundIcon },
        {
          id: 'web',
          label: 'Web & Shopify',
          icon: GlobeIcon,
          count: detail.shopify.length,
        },
        {
          id: 'orders',
          label: 'Open Orders',
          icon: ShoppingCartIcon,
          count: detail.open_order_lines.length,
        },
      ]}
      tab={tab}
      onTab={setTab}
    >
      {content}
    </DetailPage>
  )
}
