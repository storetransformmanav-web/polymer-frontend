import { useEffect, useState, type ReactNode } from 'react'
import { HeaderChip, StatusPill } from '../../../components/ui/DetailsHeader.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import {
  ActivityIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  GridIcon,
  HistoryIcon,
  MapPinIcon,
  PoundIcon,
  ShoppingCartIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { initials } from '../../../lib/format.ts'
import type { SageCustomer } from '../../../lib/api/sageCustomers.ts'
import { useSageCustomerDetail } from '../hooks/useSageCustomerDetail.ts'
import { dateText, dateTimeAmPm, humanize } from '../utils/format.ts'
import { DetailPage } from './DetailPage.tsx'
import { ActivityPanel } from './SageActivity.tsx'
import {
  AddressesPanel,
  ContactHistoryPanel,
  FinancialsPanel,
  OrdersPanel,
  OverviewPanel,
  TransactionsPanel,
} from './SageCustomerPanels.tsx'

interface SageCustomerDetailsViewProps {
  /** The Sage account reference, as in the address — what the details are asked for by. */
  accountRef: string
  /** The list row, when the page was opened from the list: it draws the header while the details load. */
  preview: SageCustomer | null
  /** The name the link carried, shown until the customer's own answer says it. */
  linkedName: string | null
  onBack: () => void
  /** Told the customer's name once it is known, so the page can name its tab. */
  onLoaded?: (name: string) => void
}

/** The page's tabs, in order (after the shared reference design). */
const TABS = [
  { id: 'overview', label: 'Overview', icon: GridIcon },
  { id: 'addresses', label: 'Addresses', icon: MapPinIcon },
  { id: 'financials', label: 'Financials', icon: PoundIcon },
  { id: 'transactions', label: 'Transactions', icon: PoundIcon },
  { id: 'orders', label: 'Orders', icon: ShoppingCartIcon },
  { id: 'history', label: 'Contact History', icon: HistoryIcon },
  { id: 'activity', label: 'Activity', icon: ActivityIcon },
]

/** A header pill with its label in front: "Status: Open". */
const labelled = (label: string, value: string) => `${label}: ${value}`

/**
 * One Sage customer's page, in place of the list and laid out after the shared reference design: the
 * shared header — their initials, the name, **labelled status pills** (the account's Status, whether it
 * is Active or Inactive and whether it is On Hold, and an Over credit limit one when it is), the account
 * reference and the opening date — and the tabs **Overview**, **Contacts**, **Addresses**, **Financials**,
 * **Transactions**, **Orders**, **Contact History** and **Activity**. The customer is **asked for by
 * account reference when the page opens** (`GET /api/sage/customers/{account_ref}`) and the answer is the
 * source of truth; while it loads the header draws from the list row. The Transactions and Contact History
 * tabs ask their own endpoints only when opened. Empty values show a dash, never a broken layout.
 */
export function SageCustomerDetailsView({
  accountRef,
  preview,
  linkedName,
  onBack,
  onLoaded,
}: SageCustomerDetailsViewProps) {
  const state = useSageCustomerDetail(accountRef)
  const detail = state.detail
  const [tab, setTab] = useState('overview')

  const name = detail?.name || preview?.name || linkedName || accountRef
  useEffect(() => {
    onLoaded?.(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the name changes
  }, [name])

  // The answer when it is there, else the list row.
  const currency = detail?.company?.currency || preview?.currency || null
  const source = detail ?? preview
  const overLimit =
    detail?.credit?.over_credit_limit ?? preview?.over_credit_limit ?? false

  // Status as Sage sends it (open when it sends none, as the list's "Open" tab defines it).
  let statusPills: ReactNode = null
  if (source) {
    const text = source.status.trim() || 'Open'
    const isOpen = text.toLowerCase() === 'open'
    const statusTone: BadgeTone = isOpen ? 'success' : 'warning'
    statusPills = (
      <>
        <StatusPill
          label={labelled('Status', humanize(text) || text)}
          tone={statusTone}
        />
      </>
    )
  }

  const opened = detail?.opened_on ?? preview?.opened_on ?? null

  const header = {
    idPrefix: 'sage-customer',
    visual: (
      <span
        aria-hidden="true"
        className="bg-accent-tint text-accent inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
      >
        {initials(name) || '?'}
      </span>
    ),
    title: name,
    titleHint: name,
    status: (
      <>
        {statusPills}
        {overLimit && <StatusPill label="Over credit limit" tone="danger" />}
        {state.isRefreshing && (
          <span className="text-text-muted text-[0.75rem]" role="status">
            Updating…
          </span>
        )}
      </>
    ),
    chips: (
      <>
        <HeaderChip icon={UsersIcon} label="Account reference">
          <span aria-hidden="true" className="text-text-muted">
            Account Ref:
          </span>{' '}
          <span className="font-semibold">{accountRef}</span>
        </HeaderChip>
        {opened && (
          <HeaderChip icon={CalendarIcon} label="Opened">
            <span aria-hidden="true" className="text-text-muted">
              Opened:
            </span>{' '}
            <span className="font-semibold">{dateText(opened)}</span>
          </HeaderChip>
        )}
        {detail?.data_as_of && (
          <HeaderChip icon={ClockIcon} label="Data as of">
            <span aria-hidden="true" className="text-text-muted">
              Data as of:
            </span>{' '}
            {dateTimeAmPm(detail.data_as_of)}
          </HeaderChip>
        )}
      </>
    ),
    onBack,
  }

  // Not there (yet): a quiet frame with the header from the list row, and why.
  if (!detail) {
    return (
      <DetailPage {...header} tabs={[TABS[0]]} tab="overview" onTab={() => {}}>
        {state.isPending ? (
          <>
            <span role="status" className="sr-only">
              Loading customer {accountRef}…
            </span>
            <DetailSkeleton />
          </>
        ) : (
          <div className="text-text-muted flex flex-col items-center gap-3 py-10 text-center text-[0.9rem]">
            <AlertTriangleIcon width={28} height={28} className="text-danger" />
            <p className="text-text m-0 font-semibold">
              {state.notFound ? 'Customer not found' : 'Couldn’t load this customer'}
            </p>
            <p className="m-0">
              {state.notFound
                ? `There is no Sage customer with the account reference “${accountRef}”.`
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
    case 'addresses':
      content = <AddressesPanel detail={detail} currency={currency} />
      break
    case 'financials':
      content = <FinancialsPanel detail={detail} currency={currency} />
      break
    case 'transactions':
      content = <TransactionsPanel detail={detail} currency={currency} />
      break
    case 'orders':
      content = <OrdersPanel detail={detail} currency={currency} />
      break
    case 'history':
      content = <ContactHistoryPanel detail={detail} currency={currency} />
      break
    case 'activity':
      content = <ActivityPanel detail={detail} currency={currency} />
      break
    default:
      content = <OverviewPanel detail={detail} currency={currency} onTab={setTab} />
  }

  return (
    <DetailPage {...header} tabs={TABS} tab={tab} onTab={setTab}>
      {content}
    </DetailPage>
  )
}
