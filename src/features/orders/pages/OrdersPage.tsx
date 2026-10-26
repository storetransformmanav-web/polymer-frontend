import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { OrderDetailsView } from '../components/OrderDetailsView.tsx'
import { OrderTabsBar } from '../components/OrderTabsBar.tsx'
import { OrdersKpis } from '../components/OrdersKpis.tsx'
import { OrdersList } from '../components/OrdersList.tsx'
import { OrdersToolbar } from '../components/OrdersToolbar.tsx'
import { orderDetailsKey } from '../../../app/store/ordersSlice.ts'
import { useOrders } from '../hooks/useOrders.ts'
import { useOrderTabs } from '../hooks/useOrderTabs.ts'
import {
  orderCustomer,
  orderLabel,
  orderPath,
  orderPathFor,
  orderRef,
} from '../utils/format.ts'

const LIST_PATH = '/orders'

/**
 * Orders: the list at `/orders`, and one order's details at `/orders/:number` (with
 * `?shop=<store>` when the store is known) — both rendered here, in the same page. The
 * list stays mounted (just hidden) while an order is open, so coming back keeps your
 * filters and page. Data comes from the Redux cache (see ordersSlice.ts), which makes
 * moving between pages, tabs and orders feel instant.
 *
 * Like the products page, a strip of opened orders sits on top ("All Orders" + one tab per
 * order you opened, with Clear). Laid out like the order-management design: the figures,
 * the search row, then the table. From `lg` up it fills the height of the main area (the page itself does not
 * scroll): the table scrolls inside its own box, under a sticky header, with the paging
 * fixed beneath it; an open order scrolls in the same space.
 */
export function OrdersPage() {
  const orders = useOrders()
  const tabs = useOrderTabs()
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const [search] = useSearchParams()
  const { filters, data } = orders

  // `/orders/<number>[/…]` → the order's number; `/orders` → null (the list).
  const activeRef = splat ? decodeURIComponent(splat.split('/')[0]) || null : null
  const activeShop = search.get('shop')
  const activeId = activeRef ? orderDetailsKey(activeRef, activeShop) : null

  function closeTab(id: string) {
    const index = tabs.tabs.findIndex((tab) => tab.id === id)
    const neighbour = tabs.tabs[index + 1] ?? tabs.tabs[index - 1]
    tabs.closeTab(id)
    if (id === activeId) {
      navigate(neighbour ? orderPathFor(neighbour.ref, neighbour.shop) : LIST_PATH)
    }
  }

  function clearTabs() {
    tabs.clearTabs()
    if (activeId) navigate(LIST_PATH)
  }

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <OrderTabsBar
        tabs={tabs.tabs}
        activeId={activeId}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(id) => {
          const tab = tabs.tabs.find((candidate) => candidate.id === id)
          if (tab) navigate(orderPathFor(tab.ref, tab.shop))
        }}
        onClose={closeTab}
        onClear={clearTabs}
      />

      {activeRef && (
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <OrderDetailsView
            key={`${activeShop ?? ''}|${activeRef}`}
            reference={activeRef}
            shop={activeShop}
            onBack={() => navigate(LIST_PATH)}
          />
        </div>
      )}

      {/* Kept mounted but hidden while an order is open (display: none also removes it
          from tab order and screen readers). */}
      <div className={activeRef ? 'hidden' : 'flex flex-col gap-4 lg:min-h-0 lg:flex-1'}>
        <OrdersKpis data={data} />

        <OrdersToolbar
          filters={filters}
          facets={orders.facets}
          total={data?.total ?? null}
          hasFilters={orders.hasFilters}
          onChange={orders.setFilters}
          onReset={orders.resetFilters}
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

          <OrdersList
            items={orders.items}
            isPending={orders.isPending}
            error={orders.error}
            hasFilters={orders.hasFilters}
            isStale={orders.isShowingPrevious}
            onOpen={(order) => {
              const customer = orderCustomer(order)
              tabs.openTab({
                ref: orderRef(order),
                shop: order.shop?.key,
                label: orderLabel(order),
                title: customer ? customer.name : null,
              })
              navigate(orderPath(order))
            }}
            onPrefetch={(order) =>
              orders.prefetchDetails(orderRef(order), order.shop?.key)
            }
            onRetry={orders.retry}
            onClearFilters={orders.resetFilters}
          />

          {data && data.total > 0 && (
            <PaginationFooter
              page={data.page}
              pageSize={filters.pageSize}
              total={data.total}
              totalPages={data.total_pages}
              onPageChange={(page) => orders.setFilters({ page })}
              onPageSizeChange={(pageSize) => orders.setFilters({ pageSize })}
            />
          )}
        </section>
      </div>
    </div>
  )
}
