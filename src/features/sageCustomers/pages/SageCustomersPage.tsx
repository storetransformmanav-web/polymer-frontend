import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ColumnsMenu } from '../../../components/ui/ColumnsMenu.tsx'
import { HeaderRefresh } from '../../../components/ui/HeaderRefresh.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { UsersIcon } from '../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { SageCustomerSort } from '../../../lib/api/sageCustomers.ts'
import { SageCustomerDetailsView } from '../components/SageCustomerDetailsView.tsx'
import { SageCustomersExport } from '../components/SageCustomersExport.tsx'
import { SageCustomersKpis } from '../components/SageCustomersKpis.tsx'
import { SageCustomersList } from '../components/SageCustomersList.tsx'
import { SageCustomersToolbar } from '../components/SageCustomersToolbar.tsx'
import { useSageCustomerColumns } from '../hooks/useSageCustomerColumns.ts'
import { useSageCustomers } from '../hooks/useSageCustomers.ts'
import { SAGE_CUSTOMER_COLUMNS } from '../utils/columns.ts'
import { listCurrency } from '../utils/format.ts'
import { customerPath, LIST_PATH } from '../utils/paths.ts'

const MAX_TABS = 10

// From `lg` the page fills the window (`fillHeight` in navigation.ts): the table scrolls in its own
// box, and a customer's page scrolls inside this one.
const SCROLL_VIEW = 'relative flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto'

/** An opened customer: a tab in the strip above the list. */
interface DetailTab {
  key: string
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
 * Sage 50 → Customers: the customers from `GET /api/sage/customers`, laid out like the Invoices, Orders
 * and Products pages — the figures from the answer's `totals` and `tab_counts`, the search row, the
 * Columns menu and the filter grid, then the table in its own scrolling box with the pagination under
 * it. Everything — the tab, search, filters, sorting, the page and its size — is asked of the API
 * (TanStack Query, see useSageCustomers), so it covers all the customers, not just the ones on
 * screen. A customer's name, account reference or View button opens that customer's page
 * (`/sage/customers/<ref>`) **in this same page, as a tab of its own** like a product's — the list
 * stays mounted behind, so Back finds it as it was. The top bar has the page's Export (a CSV).
 */
export function SageCustomersPage() {
  const customers = useSageCustomers()
  const columnChoice = useSageCustomerColumns()
  const { filters, data } = customers
  const navigate = useNavigate()
  const location = useLocation()
  const { '*': splat } = useParams()
  // The API gives no currency for the totals: the first customer's is used (pounds otherwise).
  const currency = listCurrency(customers.items)

  // `/sage/customers` → the list; `/sage/customers/<ref>` → one customer.
  const segments = splat ? splat.split('/').filter(Boolean).map(decode) : []
  const accountRef = segments[0] ?? null
  const rawName = (location.state as { linkedName?: unknown } | null)?.linkedName
  const linkedName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null

  const activeKey = accountRef ? `customer:${accountRef}` : null

  const [tabs, setTabs] = useState<DetailTab[]>([])
  // Every opened customer gets a tab — also one reached by a bare address. (React's "adjust state
  // while rendering": a new address opens its tab in the same render.)
  if (activeKey && accountRef && !tabs.some((tab) => tab.key === activeKey)) {
    setTabs((current) =>
      current.some((tab) => tab.key === activeKey)
        ? current
        : [
            ...current,
            {
              key: activeKey,
              label: linkedName ?? accountRef,
              path: customerPath(accountRef),
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

  const preview = accountRef
    ? (customers.items.find((customer) => customer.account_ref === accountRef) ?? null)
    : null

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <HeaderRefresh
        visible={!activeKey}
        refreshing={customers.isFetching}
        onRefresh={customers.retry}
      />
      <SageCustomersExport
        items={customers.items}
        filters={filters}
        total={data?.total ?? 0}
        visible={!activeKey}
      />
      {/* The figures belong to the list: a customer's page takes their place (the list stays mounted). */}
      <div className={activeKey ? 'hidden' : undefined}>
        <SageCustomersKpis
          totals={data?.totals ?? null}
          total={data?.total ?? null}
          tabCounts={data?.tabCounts ?? {}}
          currency={currency}
          tab={filters.tab}
          onTab={(tab) => customers.setFilters({ tab })}
        />
      </div>

      <OpenTabsBar
        tabs={tabs.map((tab) => ({
          id: tab.key,
          label: tab.label,
          kind: 'Customer',
          title: tab.label,
        }))}
        activeId={activeKey}
        navLabel="Open customers"
        listLabel="All Customers"
        kind="Customer"
        historyLabel="Opened customers"
        icon={UsersIcon}
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

      {accountRef && (
        <div className={SCROLL_VIEW}>
          <SageCustomerDetailsView
            key={`customer-${accountRef}`}
            accountRef={accountRef}
            preview={preview}
            linkedName={linkedName}
            onBack={() => navigate(LIST_PATH)}
            onLoaded={(name) => rename(`customer:${accountRef}`, name)}
          />
        </div>
      )}

      {/* Kept mounted but hidden while a customer is open (display: none also removes it from tab
          order and screen readers), so Back finds the search, filters and page as they were. */}
      <div className={activeKey ? 'hidden' : 'flex flex-col gap-4 lg:min-h-0 lg:flex-1'}>
        <SageCustomersToolbar
          filters={filters}
          tabCounts={data?.tabCounts ?? {}}
          // Clear All also puts the columns back to the default, so a changed choice counts as
          // something to clear.
          hasFilters={customers.hasFilters || !columnChoice.isDefault}
          onChange={customers.setFilters}
          onReset={() => {
            customers.resetFilters()
            columnChoice.reset()
          }}
          actions={
            // Only the table has columns; the cards of a narrow screen do not.
            <div className="hidden lg:block">
              <ColumnsMenu
                config={columnChoice.config}
                labelOf={(id) => SAGE_CUSTOMER_COLUMNS[id].label}
                onToggle={columnChoice.toggle}
                onMove={columnChoice.move}
                onReset={columnChoice.reset}
              />
            </div>
          }
        />

        <section
          aria-label="Customers"
          className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
        >
          {/* Thin activity bar: results stay on screen while a refresh runs. */}
          <div
            aria-hidden="true"
            className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
              customers.isFetching && !customers.isPending
                ? 'animate-pulse opacity-100'
                : 'opacity-0'
            }`}
          />

          <HighlightQuery query={filters.search}>
            <SageCustomersList
              items={customers.items}
              columns={columnChoice.columns}
              isPending={customers.isPending}
              error={customers.error}
              hasFilters={customers.hasFilters}
              isStale={customers.isShowingPrevious}
              sort={filters.sort}
              order={filters.order}
              // A new column starts ascending; the same column flips direction.
              onSort={(sort: SageCustomerSort) =>
                customers.setFilters(
                  sort === filters.sort
                    ? { order: filters.order === 'asc' ? 'desc' : 'asc' }
                    : { sort, order: 'asc' },
                )
              }
              onRetry={customers.retry}
              onClearFilters={customers.resetFilters}
            />
          </HighlightQuery>

          {data && data.total > 0 && (
            <PaginationFooter
              page={data.page}
              pageSize={filters.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={(page) => customers.setFilters({ page })}
              onPageSizeChange={(pageSize) => customers.setFilters({ pageSize })}
            />
          )}
        </section>
      </div>
    </div>
  )
}
