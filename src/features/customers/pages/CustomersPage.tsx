import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { ConfirmCancelDialog } from '../../../components/ui/ConfirmCancelDialog.tsx'
import { PlusIcon } from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import {
  CustomerDeleteDialog,
  type CustomerToDelete,
} from '../components/CustomerDeleteDialog.tsx'
import { CustomerCreateView } from '../components/CustomerCreateView.tsx'
import { CustomerTabsBar } from '../components/CustomerTabsBar.tsx'
import { CustomerDetailsView } from '../components/CustomerDetailsView.tsx'
import { ColumnsMenu } from '../../../components/ui/ColumnsMenu.tsx'
import { CustomersExport } from '../components/CustomersExport.tsx'
import { CustomersImport } from '../components/CustomersImport.tsx'
import { CustomersKpis } from '../components/CustomersKpis.tsx'
import { CustomersList } from '../components/CustomersList.tsx'
import { CustomersToolbar } from '../components/CustomersToolbar.tsx'
import { useAccess } from '../../../hooks/useAccess.ts'
import { useCustomerColumns } from '../hooks/useCustomerColumns.ts'
import { useCustomerFigures } from '../hooks/useCustomerFigures.ts'
import { useCustomers } from '../hooks/useCustomers.ts'
import { useCustomerTabs } from '../hooks/useCustomerTabs.ts'
import type {
  CustomerCreateResult,
  CustomerListItem,
} from '../../../lib/api/endpoints.ts'
import { CUSTOMER_COLUMNS } from '../utils/columns.ts'
import { DRAFT_TAB } from '../utils/customerDraft.ts'
import { customerName } from '../utils/format.ts'

const LIST_PATH = '/customers'
const NEW_PATH = '/customers/new'
const detailsPath = (id: string) => `${LIST_PATH}/${encodeURIComponent(id)}`

/**
 * Customers: the list at `/customers`, and one customer's details at
 * `/customers/:id` — both rendered here, in the same page. The list stays
 * mounted (just hidden) while a customer is open, so coming back keeps your
 * scroll, filters and page.
 *
 * Data comes from the Redux cache (see customersSlice.ts), which is what
 * makes moving between pages, filters and customers feel instant.
 */
export function CustomersPage() {
  const customers = useCustomers()
  const { canManage } = useAccess('customers')
  // The CSV export has a permission of its own (`customers_export`).
  const exportAccess = useAccess('customers_export')
  const canExport = exportAccess.canView && exportAccess.canManage
  const tabs = useCustomerTabs()
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const { filters, data } = customers
  const figures = useCustomerFigures(filters, data)
  // Which columns the table shows (the Columns menu), remembered on this browser.
  const columnChoice = useCustomerColumns()

  // `/customers/<id>[/…]` → the customer id; `/customers` and `/customers/new` → null.
  const first = splat ? splat.split('/')[0] : ''
  const activeId = first && first !== 'new' ? first : null

  // The Add customer form is open: it stays mounted, with what was typed, while the list or a
  // customer is shown. It starts open when the page is reached at /customers/new directly.
  const [adding, setAdding] = useState(splat === 'new')
  const [dirty, setDirty] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  // The form is on screen (at /customers/new); anywhere else it is only kept.
  const creatingRoute = splat === 'new'
  // Also drawn while the address is /customers/new, e.g. after the browser's Back button.
  const formOpen = adding || creatingRoute

  // The customer a trash button asked to delete (the dialog confirms), and what to say after.
  const [deleting, setDeleting] = useState<CustomerToDelete | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const closeDelete = useCallback(() => setDeleting(null), [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 8000)
    return () => window.clearTimeout(timer)
  }, [notice])

  function handleDeleted(customer: CustomerToDelete, message: string) {
    setDeleting(null)
    setNotice(
      `Deleted “${customer.name}”. ${message || 'It is also deleted in Shopify.'}`,
    )
    // Deleted from its own page: there is nothing left to show, so go back to the list.
    if (activeId === customer.id) navigate(LIST_PATH)
  }

  const openForm = useCallback(() => {
    setNotice(null)
    setAdding(true)
    navigate(NEW_PATH)
  }, [navigate])

  /** Close the form for good and go back to the list. */
  const closeForm = useCallback(() => {
    setConfirmingClose(false)
    setAdding(false)
    setDirty(false)
    navigate(LIST_PATH)
  }, [navigate])

  /** Back / Cancel / the tab's X: ask first when something was entered. */
  const requestClose = useCallback(() => {
    if (dirty) setConfirmingClose(true)
    else closeForm()
  }, [dirty, closeForm])

  /** The store made the customer: close the form, say so, and open the new customer in a tab. */
  function handleCreated(result: CustomerCreateResult) {
    setConfirmingClose(false)
    setAdding(false)
    setDirty(false)
    const warnings = result.warnings.length > 0 ? ` ${result.warnings.join(' ')}` : ''
    setNotice(
      `${result.message || 'Customer created in Shopify and the CRM.'}${warnings}`,
    )
    if (result.id) {
      tabs.openTab({
        id: result.id,
        name: result.name || result.email,
        email: result.email,
      })
      navigate(detailsPath(result.id))
    } else {
      navigate(LIST_PATH)
    }
  }

  function openCustomer(customer: CustomerListItem) {
    tabs.openTab({ id: customer.id, name: customerName(customer), email: customer.email })
    navigate(detailsPath(customer.id))
  }

  function closeTab(id: string) {
    const index = tabs.tabs.findIndex((tab) => tab.id === id)
    const neighbour = tabs.tabs[index + 1] ?? tabs.tabs[index - 1]
    tabs.closeTab(id)
    if (id === activeId) navigate(neighbour ? detailsPath(neighbour.id) : LIST_PATH)
  }

  function clearTabs() {
    tabs.clearTabs()
    if (activeId) navigate(LIST_PATH)
    if (formOpen) requestClose()
  }

  // From `lg` the page fills the window (see `fillHeight` in navigation.ts): the table scrolls in
  // its own box under a sticky header, with the pagination beneath it, and the page itself does not.
  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      {/* The figures sit above the tabs; they belong to the list, so an open customer takes
          their place (kept mounted, only hidden). */}
      <div className={activeId || creatingRoute ? 'hidden' : undefined}>
        <CustomersKpis
          totals={figures.totals}
          total={figures.total}
          orders={filters.orders}
          marketing={filters.marketing}
          onOrders={(orders) => customers.setFilters({ orders })}
          onMarketing={(marketing) => customers.setFilters({ marketing })}
        />
      </div>

      <CustomerTabsBar
        tabs={tabs.tabs}
        activeId={creatingRoute ? DRAFT_TAB : activeId}
        draft={formOpen}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(id) => navigate(id === DRAFT_TAB ? NEW_PATH : detailsPath(id))}
        onClose={(id) => (id === DRAFT_TAB ? requestClose() : closeTab(id))}
        onClear={clearTabs}
      />

      {activeId && (
        <div className="relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <CustomerDetailsView
            key={activeId}
            id={activeId}
            onBack={() => navigate(LIST_PATH)}
            onDelete={(customer) => {
              setNotice(null)
              setDeleting({ id: activeId, ...customer })
            }}
          />
        </div>
      )}

      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      {/* The form stays mounted (hidden) while the list or a customer is shown. */}
      {formOpen && (
        <div
          className={
            creatingRoute ? 'relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto' : 'hidden'
          }
        >
          <CustomerCreateView
            onCreated={handleCreated}
            onBack={requestClose}
            onDirtyChange={setDirty}
          />
        </div>
      )}

      {/* Kept mounted but hidden while a customer is open (display: none also
          removes it from tab order and screen readers). */}
      <div
        className={
          activeId || creatingRoute
            ? 'hidden'
            : 'flex flex-col gap-4 lg:min-h-0 lg:flex-1'
        }
      >
        <CustomersToolbar
          filters={filters}
          // Clear All also puts the columns back to the default, so a changed choice counts
          // as something to clear.
          hasFilters={customers.hasFilters || !columnChoice.isDefault}
          onChange={customers.setFilters}
          onReset={() => {
            customers.resetFilters()
            columnChoice.reset()
          }}
          // Add customer and then the Columns menu sit in the search row, to the right of Filters
          // and Clear All. The cards of a narrow screen have no columns, so the menu is for the table.
          actions={
            <>
              {canManage && (
                <button
                  type="button"
                  onClick={openForm}
                  className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border-none px-4 text-[0.85rem] font-semibold shadow-sm transition-colors"
                >
                  <PlusIcon width={16} height={16} />
                  Add customer
                </button>
              )}
              <div className="hidden md:block">
                <ColumnsMenu
                  config={columnChoice.config}
                  labelOf={(id) => CUSTOMER_COLUMNS[id].label}
                  onToggle={columnChoice.toggle}
                  onMove={columnChoice.move}
                  onReset={columnChoice.reset}
                />
              </div>
            </>
          }
        />

        {/* The Import and Export buttons sit in the top bar; they only show while the list is. */}
        <CustomersImport visible={!activeId && !creatingRoute} />

        <CustomersExport
          items={customers.items}
          filters={filters}
          total={data?.total ?? 0}
          // The whole list of people's details: only for those who may export customers.
          visible={!activeId && !creatingRoute && canExport}
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
            <CustomersList
              items={customers.items}
              isPending={customers.isPending}
              error={customers.error}
              hasFilters={customers.hasFilters}
              isStale={customers.isShowingPrevious}
              onOpen={openCustomer}
              onPrefetch={customers.prefetchDetails}
              onDelete={(customer) => {
                setNotice(null)
                setDeleting({
                  id: customer.id,
                  name: customerName(customer),
                  shop: customer.shop?.key ?? null,
                  ordersCount: customer.orders_count,
                })
              }}
              onRetry={customers.retry}
              onClearFilters={customers.resetFilters}
              columns={columnChoice.columns}
              sort={filters.sort}
              order={filters.order}
              // A new column starts ascending; the same column flips direction.
              onSort={(sort) =>
                customers.setFilters(
                  sort === filters.sort
                    ? { order: filters.order === 'asc' ? 'desc' : 'asc' }
                    : { sort, order: 'asc' },
                )
              }
            />
          </HighlightQuery>

          {data && data.total > 0 && (
            <PaginationFooter
              page={data.page}
              pageSize={filters.pageSize}
              total={data.total}
              totalPages={data.total_pages}
              onPageChange={(page) => customers.setFilters({ page })}
              onPageSizeChange={(pageSize) => customers.setFilters({ pageSize })}
            />
          )}
        </section>
      </div>

      {confirmingClose && (
        <ConfirmCancelDialog
          lose="what you entered for the new customer"
          onConfirm={closeForm}
          onKeep={() => setConfirmingClose(false)}
        />
      )}

      {deleting && (
        <CustomerDeleteDialog
          key={`delete-${deleting.id}`}
          customer={deleting}
          onClose={closeDelete}
          onDone={(message) => handleDeleted(deleting, message)}
        />
      )}
    </div>
  )
}
