import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ColumnsMenu } from '../../../components/ui/ColumnsMenu.tsx'
import { HeaderRefresh } from '../../../components/ui/HeaderRefresh.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { ShoppingCartIcon } from '../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { SageOrderSort } from '../../../lib/api/sageOrders.ts'
import { InvoiceDetailsView } from '../../invoices/index.ts'
import { SageCustomerDetailsView } from '../../sageCustomers/index.ts'
import { SageOrderDetailsView } from '../components/SageOrderDetailsView.tsx'
import { SageOrdersExport } from '../components/SageOrdersExport.tsx'
import { SageOrdersKpis } from '../components/SageOrdersKpis.tsx'
import { SageOrdersList } from '../components/SageOrdersList.tsx'
import { SageOrdersToolbar } from '../components/SageOrdersToolbar.tsx'
import { useSageOrderColumns } from '../hooks/useSageOrderColumns.ts'
import { useSageOrders } from '../hooks/useSageOrders.ts'
import { SAGE_ORDER_COLUMNS } from '../utils/columns.ts'
import { listCurrency } from '../utils/format.ts'
import { customerPath, invoicePath, LIST_PATH, orderPath } from '../utils/paths.ts'

const MAX_TABS = 10

// From `lg` the page fills the window (`fillHeight` in navigation.ts): the table scrolls in its own
// box, and an opened order's, customer's or invoice's page scrolls inside this one.
const SCROLL_VIEW = 'relative flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto'

/** An opened order, customer or invoice: a tab in the strip above the list. */
interface DetailTab {
  key: string
  kind: 'Order' | 'Customer' | 'Invoice'
  label: string
  /** Where its tab leads (pathname, as in the address bar). */
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
 * Sage 50 → Orders: the sales orders from `GET /api/sage/orders`, laid out like the Invoices, Sage
 * customers and Orders pages — the figures from the answer's `totals` and `status_counts`, the search
 * row, the Columns menu and the filter grid, then the table in its own scrolling box with the
 * pagination under it. Everything — the status, search, filters, sorting, the page and its size — is
 * asked of the API (TanStack Query, see useSageOrders), so it covers all the orders, not just the
 * ones on screen. An order's number or View button opens the order's own page (`/sage/orders/<number>`,
 * `GET /api/sage/orders/{order_number}`), a customer's name that customer's Sage details page
 * (`/sage/orders/customer/<ref>`) and an invoice number the invoice's (`/sage/orders/invoice/<number>`) —
 * each **in this same page, as a tab of its own**, like a product's page; the list stays mounted behind,
 * so Back finds it as it was. The top bar has the page's Refresh and Export (a CSV).
 */
export function SageOrdersPage() {
  const orders = useSageOrders()
  const columnChoice = useSageOrderColumns()
  const { filters, data } = orders
  const navigate = useNavigate()
  const location = useLocation()
  const { '*': splat } = useParams()
  // The API gives no currency for the totals: the first order's is used (pounds otherwise).
  const currency = listCurrency(orders.items)

  // `/sage/orders` → the list; `/sage/orders/<number>` → one order;
  // `/sage/orders/customer/<ref>` → one customer; `/sage/orders/invoice/<number>` → one invoice.
  const segments = splat ? splat.split('/').filter(Boolean).map(decode) : []
  const first = segments[0] ?? ''
  const customerRef = first === 'customer' && segments[1] ? segments[1] : null
  const invoiceNumber = first === 'invoice' && segments[1] ? segments[1] : null
  const orderNumber = first && first !== 'customer' && first !== 'invoice' ? first : null
  const rawName = (location.state as { linkedName?: unknown } | null)?.linkedName
  const linkedName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null

  const activeKey = orderNumber
    ? `order:${orderNumber}`
    : customerRef
      ? `customer:${customerRef}`
      : invoiceNumber
        ? `invoice:${invoiceNumber}`
        : null

  const [tabs, setTabs] = useState<DetailTab[]>([])
  // The address that was on screen before this render (null = the list). A tab is opened **when the
  // address arrives at a record**, not whenever its tab is missing: closing a tab removes it a moment
  // before the address leaves it, and that gap must not open it again; going back to the list forgets
  // the address, so a closed record can be opened again. (React's "adjust state while rendering".)
  const [lastKey, setLastKey] = useState<string | null>(null)
  if (activeKey !== lastKey) {
    setLastKey(activeKey)
    if (activeKey && !tabs.some((tab) => tab.key === activeKey)) {
      const tab: DetailTab = orderNumber
        ? {
            key: activeKey,
            kind: 'Order',
            label: orderNumber,
            path: orderPath(orderNumber),
          }
        : invoiceNumber
          ? {
              key: activeKey,
              kind: 'Invoice',
              label: invoiceNumber,
              path: invoicePath(invoiceNumber),
            }
          : {
              key: activeKey,
              kind: 'Customer',
              label: linkedName ?? customerRef ?? '',
              path: customerPath(customerRef ?? ''),
            }
      // A new tab opens right after the one that was on screen (an invoice or customer opened from an
      // order's page sits to the right of that order's tab); from the list it goes to the end.
      const after = lastKey
      setTabs((current) => {
        if (current.some((candidate) => candidate.key === activeKey)) return current
        const at = after ? current.findIndex((candidate) => candidate.key === after) : -1
        const next =
          at >= 0
            ? [...current.slice(0, at + 1), tab, ...current.slice(at + 1)]
            : [...current, tab]
        return next.slice(-MAX_TABS)
      })
    }
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

  const preview = orderNumber
    ? (orders.items.find((order) => order.order_number === orderNumber) ?? null)
    : null

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <HeaderRefresh
        visible={!activeKey}
        refreshing={orders.isFetching}
        onRefresh={orders.retry}
      />
      <SageOrdersExport
        items={orders.items}
        filters={filters}
        total={data?.total ?? 0}
        visible={!activeKey}
      />

      {/* The figures belong to the list: an opened record's page takes their place (the list stays mounted). */}
      <div className={activeKey ? 'hidden' : undefined}>
        <SageOrdersKpis
          totals={data?.totals ?? null}
          total={data?.total ?? null}
          statusCounts={data?.statusCounts ?? {}}
          currency={currency}
          status={filters.status}
          onStatus={(status) => orders.setFilters({ status })}
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
        navLabel="Open orders, customers and invoices"
        listLabel="All Orders"
        kind="Order"
        historyLabel="Opened orders, customers and invoices"
        icon={ShoppingCartIcon}
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

      {orderNumber && (
        <div className={SCROLL_VIEW}>
          <SageOrderDetailsView
            key={`order-${orderNumber}`}
            orderNumber={orderNumber}
            preview={preview}
            onBack={() => navigate(LIST_PATH)}
            onLoaded={(number) => rename(`order:${orderNumber}`, number)}
          />
        </div>
      )}

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

      {invoiceNumber && (
        <div className={SCROLL_VIEW}>
          <InvoiceDetailsView
            key={`invoice-${invoiceNumber}`}
            reference={invoiceNumber}
            kind={null}
            preview={null}
            onBack={() => navigate(LIST_PATH)}
            onLoaded={(number) => rename(`invoice:${invoiceNumber}`, number)}
            customerPathOf={customerPath}
          />
        </div>
      )}

      {/* Kept mounted but hidden while a record is open (display: none also removes it from tab
          order and screen readers), so Back finds the search, filters and page as they were. */}
      <div className={activeKey ? 'hidden' : 'flex flex-col gap-4 lg:min-h-0 lg:flex-1'}>
        <SageOrdersToolbar
          filters={filters}
          statusCounts={data?.statusCounts ?? {}}
          hasFilters={orders.hasFilters}
          onChange={orders.setFilters}
          onReset={orders.resetFilters}
          actions={
            // Only the table has columns; the cards of a narrow screen do not.
            <div className="hidden lg:block">
              <ColumnsMenu
                config={columnChoice.config}
                labelOf={(id) => SAGE_ORDER_COLUMNS[id].label}
                onToggle={columnChoice.toggle}
                onMove={columnChoice.move}
                onReset={columnChoice.reset}
              />
            </div>
          }
        />

        <section
          aria-label="Orders"
          className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
        >
          {/* Thin activity bar: results stay on screen while a refresh runs. */}
          <div
            aria-hidden="true"
            className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
              orders.isFetching && !orders.isPending
                ? 'animate-pulse opacity-100'
                : 'opacity-0'
            }`}
          />

          <HighlightQuery query={filters.search}>
            <SageOrdersList
              items={orders.items}
              columns={columnChoice.columns}
              isPending={orders.isPending}
              error={orders.error}
              hasFilters={orders.hasFilters}
              isStale={orders.isShowingPrevious}
              sort={filters.sort}
              order={filters.order}
              // A new column starts ascending; the same column flips direction.
              onSort={(sort: SageOrderSort) =>
                orders.setFilters(
                  sort === filters.sort
                    ? { order: filters.order === 'asc' ? 'desc' : 'asc' }
                    : { sort, order: 'asc' },
                )
              }
              onRetry={orders.retry}
              onClearFilters={orders.resetFilters}
            />
          </HighlightQuery>

          {data && data.total > 0 && (
            <PaginationFooter
              page={data.page}
              pageSize={filters.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={(page) => orders.setFilters({ page })}
              onPageSizeChange={(pageSize) => orders.setFilters({ pageSize })}
            />
          )}
        </section>
      </div>
    </div>
  )
}
