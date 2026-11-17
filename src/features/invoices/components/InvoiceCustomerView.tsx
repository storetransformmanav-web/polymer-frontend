import { useEffect, useMemo, useState } from 'react'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { HeaderChip, StatusPill } from '../../../components/ui/DetailsHeader.tsx'
import { DetailSection, Field, FieldGrid } from '../../../components/ui/DetailSection.tsx'
import {
  FileTextIcon,
  GridIcon,
  PoundIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { initials } from '../../../lib/format.ts'
import type { InvoiceSort } from '../../../lib/api/invoices.ts'
import { useInvoices } from '../hooks/useInvoices.ts'
import type { InvoiceColumnDef } from '../utils/columns.ts'
import { count, kindCountsText, money } from '../utils/format.ts'
import { DetailPage } from './DetailPage.tsx'
import { InvoicesKpis } from './InvoicesKpis.tsx'
import { InvoicesList } from './InvoicesList.tsx'

interface InvoiceCustomerViewProps {
  /** The Sage account reference, as in the address. */
  accountRef: string
  /** The name the link carried, shown until the customer's own invoices say it. */
  linkedName: string | null
  /** The table's columns as the invoices page has them chosen. */
  columns: readonly InvoiceColumnDef[]
  onBack: () => void
  /** Told the customer's name once it is known, so the page can name its tab. */
  onLoaded?: (name: string) => void
}

/** A customer's own invoices don't repeat who the customer is on every row. */
const HIDDEN_HERE = new Set(['customer', 'account'])

/**
 * One customer's page, in place of the list and laid out like a product's: the shared header (their
 * initials, the name, whether anything is outstanding, the account reference and how many invoices
 * as chips, **Back to list**), and two tabs — **Overview** (the same figure cards as the list, for
 * this customer alone, and their details) and **Invoices** (their invoices, with the table's own
 * sorting and paging). Everything comes from the invoices API filtered by the customer's account
 * reference, so the figures are the server's.
 */
export function InvoiceCustomerView({
  accountRef,
  linkedName,
  columns,
  onBack,
  onLoaded,
}: InvoiceCustomerViewProps) {
  const [tab, setTab] = useState('overview')
  // Newest first, pinned to this customer.
  const invoices = useInvoices({ accountRef, sort: 'date', order: 'desc' })
  const { data, filters } = invoices

  const name =
    data?.items.find((invoice) => invoice.customerName)?.customerName ??
    linkedName ??
    accountRef
  const currency = invoices.items.find((invoice) => invoice.currency)?.currency ?? null
  const totals = data?.totals ?? null
  const outstanding = totals?.outstanding ?? null
  const overdue = totals?.overdue ?? null

  useEffect(() => {
    onLoaded?.(name)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the name changes
  }, [name])

  const shownColumns = useMemo(
    () => columns.filter((column) => !HIDDEN_HERE.has(column.id)),
    [columns],
  )

  return (
    <DetailPage
      idPrefix="invoice-customer"
      visual={
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
        >
          {initials(name)}
        </span>
      }
      title={name}
      titleHint={name}
      status={
        overdue !== null && overdue > 0 ? (
          <StatusPill label={`${count(overdue)} overdue`} tone="danger" />
        ) : outstanding !== null && outstanding > 0 ? (
          <StatusPill label="Balance outstanding" tone="warning" />
        ) : data ? (
          <StatusPill label="Nothing outstanding" tone="success" />
        ) : undefined
      }
      chips={
        <>
          <HeaderChip icon={UsersIcon} label="Account reference">
            <span aria-hidden="true" className="text-text-muted">
              Account reference:
            </span>{' '}
            <span className="font-semibold">{accountRef}</span>
          </HeaderChip>
          <HeaderChip icon={FileTextIcon} label="Invoices">
            <span className="font-semibold">
              {count(totals?.invoices ?? data?.total)}
            </span>{' '}
            <span className="text-text-muted">invoices</span>
          </HeaderChip>
          <HeaderChip icon={PoundIcon} label="Outstanding">
            <span aria-hidden="true" className="text-text-muted">
              Outstanding:
            </span>{' '}
            {money(outstanding, currency)}
          </HeaderChip>
        </>
      }
      onBack={onBack}
      tabs={[
        { id: 'overview', label: 'Overview', icon: GridIcon },
        { id: 'invoices', label: 'Invoices', icon: FileTextIcon, count: data?.total },
      ]}
      tab={tab}
      onTab={setTab}
    >
      {tab === 'overview' ? (
        <>
          <InvoicesKpis
            totals={totals}
            total={data?.total ?? null}
            kindCounts={data?.kindCounts ?? []}
            currency={currency}
          />
          <DetailSection title="Customer details" icon={UsersIcon}>
            <FieldGrid>
              <Field label="Customer">{name}</Field>
              <Field label="Account reference">
                <span className="flex items-center gap-1.5">
                  <span className="break-all">{accountRef}</span>
                  <CopyButton value={accountRef} label="Copy account reference" />
                </span>
              </Field>
              <Field label="Invoices">
                {data ? count(totals?.invoices ?? data.total) : null}
              </Field>
              <Field label="Documents">{kindCountsText(data?.kindCounts ?? [])}</Field>
            </FieldGrid>
          </DetailSection>
        </>
      ) : (
        <section
          aria-label="Customer invoices"
          className="border-border-strong bg-bg relative flex max-h-[min(72svh,760px)] flex-col overflow-hidden rounded-xl border"
        >
          <HighlightQuery query="">
            <InvoicesList
              items={invoices.items}
              columns={shownColumns}
              isPending={invoices.isPending}
              error={invoices.error}
              hasFilters={false}
              isStale={invoices.isShowingPrevious}
              sort={filters.sort}
              order={filters.order}
              // A new column starts ascending; the same column flips direction.
              onSort={(sort: InvoiceSort) =>
                invoices.setFilters(
                  sort === filters.sort
                    ? { order: filters.order === 'asc' ? 'desc' : 'asc' }
                    : { sort, order: 'asc' },
                )
              }
              onRetry={invoices.retry}
              onClearFilters={invoices.resetFilters}
            />
          </HighlightQuery>
          {data && data.total > 0 && (
            <PaginationFooter
              page={data.page}
              pageSize={filters.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={(page) => invoices.setFilters({ page })}
              onPageSizeChange={(pageSize) => invoices.setFilters({ pageSize })}
            />
          )}
        </section>
      )}
    </DetailPage>
  )
}
