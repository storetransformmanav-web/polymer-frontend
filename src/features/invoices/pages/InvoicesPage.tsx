import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ColumnsMenu } from '../../../components/ui/ColumnsMenu.tsx'
import { HeaderRefresh } from '../../../components/ui/HeaderRefresh.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { FileTextIcon } from '../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { InvoiceSort } from '../../../lib/api/invoices.ts'
import { SageCustomerDetailsView } from '../../sageCustomers/index.ts'
import { InvoiceDetailsView } from '../components/InvoiceDetailsView.tsx'
import { InvoicesKpis } from '../components/InvoicesKpis.tsx'
import { InvoicesList } from '../components/InvoicesList.tsx'
import { InvoicesToolbar } from '../components/InvoicesToolbar.tsx'
import { isInvoice } from '../hooks/useInvoiceDetails.ts'
import { useInvoiceColumns } from '../hooks/useInvoiceColumns.ts'
import { useInvoices } from '../hooks/useInvoices.ts'
import { INVOICE_COLUMNS } from '../utils/columns.ts'
import { LIST_PATH } from '../utils/paths.ts'

const MAX_TABS = 10

// From `lg` the page fills the window (`fillHeight` in navigation.ts): the table scrolls in its own
// box, and an invoice's or a customer's page scrolls inside this one.
const SCROLL_VIEW = 'relative flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto'

/** An opened invoice or customer: a tab in the strip above the list. */
interface DetailTab {
  key: string
  kind: 'Invoice' | 'Customer'
  label: string
  /** Where its tab leads (pathname and query, as in the address bar). */
  path: string
}

const decode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Sage 50 → Invoices: the invoices from `GET /api/sage/invoices`, laid out like the Orders and
 * Products pages — the figures from the answer's `totals` (with the `kind_counts` as the document
 * counts), the search row, the Columns menu and the filter grid, then the table in its own scrolling
 * box with the pagination under it. Everything — search, filters, sorting, the page and its size — is
 * asked of the API (TanStack Query, see useInvoices), so it covers all the invoices, not just the
 * ones on screen. A customer's name opens that customer's page (`/sage/invoices/customer/<ref>`) and
 * the View button opens the invoice's (`/sage/invoices/<number>`), each **in this same page, as a tab
 * of its own** like a product's — the list stays mounted behind, so Back finds it as it was.
 */
export function InvoicesPage() {
  const invoices = useInvoices()
  const columnChoice = useInvoiceColumns()
  const { filters, data } = invoices
  const navigate = useNavigate()
  const location = useLocation()
  const { '*': splat } = useParams()
  // The API gives no currency for the totals: the first invoice's is used (pounds otherwise).
  const currency = invoices.items.find((invoice) => invoice.currency)?.currency ?? null

  // `/sage/invoices` → the list; `/sage/invoices/customer/<ref>` → a customer;
  // `/sage/invoices/<number>?kind=…` → an invoice.
  const segments = splat ? splat.split('/').filter(Boolean).map(decode) : []
  const first = segments[0] ?? ''
  const customerRef = first === 'customer' && segments[1] ? segments[1] : null
  const invoiceRef = first && first !== 'customer' ? first : null
  const kindParam = new URLSearchParams(location.search).get('kind')
  const rawName = (location.state as { linkedName?: unknown } | null)?.linkedName
  const linkedName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null

  const activeKey = customerRef
    ? `customer:${customerRef}`
    : invoiceRef
      ? `invoice:${invoiceRef}|${kindParam ?? ''}`
      : null

  const [tabs, setTabs] = useState<DetailTab[]>([])
  // Every opened record gets a tab — also one reached by a bare address. (React's "adjust state
  // while rendering": a new address opens its tab in the same render.)
  if (activeKey && !tabs.some((tab) => tab.key === activeKey)) {
    const ref = customerRef ?? invoiceRef ?? ''
    setTabs((current) =>
      current.some((tab) => tab.key === activeKey)
        ? current
        : [
            ...current,
            {
              key: activeKey,
              kind: customerRef ? ('Customer' as const) : ('Invoice' as const),
              label: linkedName ?? ref,
              path: location.pathname + location.search,
            },
          ].slice(-MAX_TABS),
    )
  }

  function rename(key: string, label: string) {
    setTabs((current) =>
      current.map((tab) =>
        tab.key === key && tab.label !== label ? { ...tab, label } : tab,
      ),
    )
  }

  function closeTab(key: string) {
    const index = tabs.findIndex((tab) => tab.key === key)
    const neighbour = tabs[index + 1] ?? tabs[index - 1]
    setTabs((current) => current.filter((tab) => tab.key !== key))
    if (key === activeKey) navigate(neighbour?.path ?? LIST_PATH)
  }

  const preview = invoiceRef
    ? (invoices.items.find((invoice) => isInvoice(invoice, invoiceRef, kindParam)) ??
      null)
    : null

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <HeaderRefresh
        visible={!activeKey}
        refreshing={invoices.isFetching}
        onRefresh={invoices.retry}
      />
      {/* The figures belong to the list: a record's page takes their place (the list stays mounted). */}
      <div className={activeKey ? 'hidden' : undefined}>
        <InvoicesKpis
          totals={data?.totals ?? null}
          total={data?.total ?? null}
          kindCounts={data?.kindCounts ?? []}
          currency={currency}
        />
      </div>

      <OpenTabsBar
        tabs={tabs.map((tab) => ({
          id: tab.key,
          label: tab.label,
          kind: tab.kind,
          title: tab.label,
        }))}
        activeId={activeKey}
        navLabel="Open invoices"
        listLabel="All Invoices"
        kind="Invoice"
        historyLabel="Opened invoices and customers"
        icon={FileTextIcon}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(key) => {
          const tab = tabs.find((candidate) => candidate.key === key)
          if (tab) navigate(tab.path)
        }}
        onClose={closeTab}
        onClear={() => {
          setTabs([])
          if (activeKey) navigate(LIST_PATH)
        }}
      />

      {customerRef && (
        <div className={SCROLL_VIEW}>
          <SageCustomerDetailsView
            key={`customer-${customerRef}`}
            accountRef={customerRef}
            preview={null}
            linkedName={linkedName}
            onBack={() => navigate(LIST_PATH)}
            onLoaded={(name) => rename(`customer:${customerRef}`, name)}
          />
        </div>
      )}

      {invoiceRef && (
        <div className={SCROLL_VIEW}>
          <InvoiceDetailsView
            key={`invoice-${invoiceRef}-${kindParam ?? ''}`}
            reference={invoiceRef}
            kind={kindParam}
            preview={preview}
            onBack={() => navigate(LIST_PATH)}
            onLoaded={(number) =>
              rename(`invoice:${invoiceRef}|${kindParam ?? ''}`, number)
            }
          />
        </div>
      )}

      {/* Kept mounted but hidden while a record is open (display: none also removes it from tab
          order and screen readers), so Back finds the search, filters and page as they were. */}
      <div className={activeKey ? 'hidden' : 'flex flex-col gap-4 lg:min-h-0 lg:flex-1'}>
        <InvoicesToolbar
          filters={filters}
          kindCounts={data?.kindCounts ?? []}
          hasFilters={invoices.hasFilters}
          onChange={invoices.setFilters}
          onReset={invoices.resetFilters}
          actions={
            // Only the table has columns; the cards of a narrow screen do not.
            <div className="hidden lg:block">
              <ColumnsMenu
                config={columnChoice.config}
                labelOf={(id) => INVOICE_COLUMNS[id].label}
                onToggle={columnChoice.toggle}
                onMove={columnChoice.move}
                onReset={columnChoice.reset}
              />
            </div>
          }
        />

        <section
          aria-label="Invoices"
          className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
        >
          {/* Thin activity bar: results stay on screen while a refresh runs. */}
          <div
            aria-hidden="true"
            className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
              invoices.isFetching && !invoices.isPending
                ? 'animate-pulse opacity-100'
                : 'opacity-0'
            }`}
          />

          <HighlightQuery query={filters.search}>
            <InvoicesList
              items={invoices.items}
              columns={columnChoice.columns}
              isPending={invoices.isPending}
              error={invoices.error}
              hasFilters={invoices.hasFilters}
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
      </div>
    </div>
  )
}
