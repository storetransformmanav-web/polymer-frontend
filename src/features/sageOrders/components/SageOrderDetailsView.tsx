import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  HeaderChip,
  HeaderTile,
  StatusPill,
} from '../../../components/ui/DetailsHeader.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import {
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  GridIcon,
  ProductsIcon,
  ShoppingCartIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type { SageOrder } from '../../../lib/api/sageOrders.ts'
import { useSageOrderDetail } from '../hooks/useSageOrderDetail.ts'
import { dateText, dateTimeText, statusPill } from '../utils/format.ts'
import { customerPath } from '../utils/paths.ts'
import { DetailPage } from './DetailPage.tsx'
import { InvoicesPanel, ItemsPanel, OverviewPanel } from './SageOrderPanels.tsx'

interface SageOrderDetailsViewProps {
  /** The order's number, as in the address — what the details are asked for by. */
  orderNumber: string
  /** The list row, when the page was opened from the list: it draws the header while the details load. */
  preview: SageOrder | null
  onBack: () => void
  /** Told the order's number once it is known, so the page can name its tab. */
  onLoaded?: (number: string) => void
}

const IDLE_TABS = [{ id: 'overview', label: 'Overview', icon: GridIcon }]

/**
 * One Sage order's page, in place of the list and laid out like a product's (and an invoice's): the
 * shared header — a tile, **Order <number>**, its status as a labelled pill ("Status: Complete"), the
 * order date, when it was created and last updated, the customer (a link to their Sage page) and who
 * took the order as chips, **Back to list** — then a tab strip and clearly labelled cards. The order is **asked for by its number when the page opens**
 * (`GET /api/sage/orders/{order_number}`) and the answer is the source of truth; while it loads the
 * header draws from the list row. Tabs: **Overview** (the customer, the CRM customer, the two
 * addresses, the notes, and the delivery and payment terms, in compact cards), **Items** (the products,
 * their line details, the amount summary and the VAT analysis) and **Invoices** (the invoices raised for
 * it, each opening in this same page). Empty values show a dash.
 */
export function SageOrderDetailsView({
  orderNumber,
  preview,
  onBack,
  onLoaded,
}: SageOrderDetailsViewProps) {
  const state = useSageOrderDetail(orderNumber)
  const detail = state.detail
  const [tab, setTab] = useState('overview')

  const shownNumber = detail?.order_number || preview?.order_number || orderNumber
  useEffect(() => {
    onLoaded?.(shownNumber)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the number changes
  }, [shownNumber])

  // The answer when it is there, else the list row.
  const source = detail ?? preview
  const status = source?.status ?? ''
  const pill = status ? statusPill(status) : null
  const orderDate = source?.order_date ?? null
  const accountRef = source?.customer.account_ref ?? ''
  const customerName = source?.customer.name || accountRef
  const takenBy = source?.taken_by ?? ''

  const header = {
    idPrefix: 'sage-order',
    visual: (
      <HeaderTile>
        <ShoppingCartIcon width={26} height={26} />
      </HeaderTile>
    ),
    title: `Order ${shownNumber}`,
    status: (
      <>
        {pill && <StatusPill label={`Status: ${pill.label}`} tone={pill.tone} />}
        {state.isRefreshing && (
          <span className="text-text-muted text-[0.75rem]" role="status">
            Updating…
          </span>
        )}
      </>
    ),
    chips: (
      <>
        {orderDate && (
          <HeaderChip icon={CalendarIcon} label="Order date">
            <span aria-hidden="true" className="text-text-muted">
              Order date:
            </span>{' '}
            {dateText(orderDate)}
          </HeaderChip>
        )}
        {detail?.created_at && (
          <HeaderChip icon={ClockIcon} label="Created">
            <span aria-hidden="true" className="text-text-muted">
              Created:
            </span>{' '}
            {dateTimeText(detail.created_at)}
          </HeaderChip>
        )}
        {detail?.updated_at && (
          <HeaderChip icon={ClockIcon} label="Updated">
            <span aria-hidden="true" className="text-text-muted">
              Updated:
            </span>{' '}
            {dateTimeText(detail.updated_at)}
          </HeaderChip>
        )}
        {customerName && (
          <HeaderChip icon={UsersIcon} label="Customer">
            {accountRef ? (
              <Link
                to={customerPath(accountRef)}
                state={{ linkedName: customerName }}
                className="text-text hover:text-accent font-semibold no-underline hover:underline"
              >
                {customerName}
              </Link>
            ) : (
              customerName
            )}
          </HeaderChip>
        )}
        {takenBy && (
          <HeaderChip label="Taken by">
            <span aria-hidden="true" className="text-text-muted">
              Taken by:
            </span>{' '}
            {takenBy}
          </HeaderChip>
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
              Loading order {orderNumber}…
            </span>
            <DetailSkeleton />
          </>
        ) : (
          <div className="text-text-muted flex flex-col items-center gap-3 py-10 text-center text-[0.9rem]">
            <AlertTriangleIcon width={28} height={28} className="text-danger" />
            <p className="text-text m-0 font-semibold">
              {state.notFound ? 'Order not found' : 'Couldn’t load this order'}
            </p>
            <p className="m-0">
              {state.notFound
                ? `There is no Sage order numbered “${orderNumber}”.`
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
    case 'items':
      content = <ItemsPanel detail={detail} />
      break
    case 'invoices':
      content = <InvoicesPanel detail={detail} />
      break
    default:
      content = <OverviewPanel detail={detail} />
  }

  return (
    <DetailPage
      {...header}
      tabs={[
        { id: 'overview', label: 'Overview', icon: GridIcon },
        { id: 'items', label: 'Items', icon: ProductsIcon, count: detail.lines.length },
        {
          id: 'invoices',
          label: 'Invoices',
          icon: FileTextIcon,
          count: detail.invoices.length,
        },
      ]}
      tab={tab}
      onTab={setTab}
    >
      {content}
    </DetailPage>
  )
}
