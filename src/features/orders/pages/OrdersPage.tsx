import { useEffect, useState } from 'react'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CustomerDetailsView } from '../../customers/index.ts'
import { ProductDetailsView } from '../../products/index.ts'
import { ConfirmCancelDialog } from '../../../components/ui/ConfirmCancelDialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { PlusIcon } from '../../../components/ui/icons.tsx'
import type { OrderCreateResult } from '../../../lib/api/endpoints.ts'
import { OrderCreateView } from '../components/create/OrderCreateView.tsx'
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
  type LinkedKind,
  orderCustomer,
  orderLabel,
  orderPath,
  orderPathFor,
  orderRef,
} from '../utils/format.ts'

const LIST_PATH = '/orders'
// The "Add order" form is a tab of its own, at /orders/new (no order is called that).
const CREATE_PATH = `${LIST_PATH}/new`
/** How long the "order created" line stays. */
const NOTICE_MS = 10_000

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
  const location = useLocation()
  const { '*': splat } = useParams()
  const [search] = useSearchParams()
  const { filters, data } = orders

  // `/orders/<number>[/…]` → the order's number; `/orders/new` → the Add order form; `/orders`
  // → null (the list).
  const segments = splat ? splat.split('/') : []
  const first = segments[0] ? decodeURIComponent(segments[0]) || null : null
  // `/orders/customer/<id>` and `/orders/product/<id>`: a customer's or a product's details,
  // opened from an order and shown in this same page, as a tab of their own.
  const linkedId = segments[1] ? decodeURIComponent(segments[1]) || null : null
  const linked: { kind: LinkedKind; id: string } | null =
    (first === 'customer' || first === 'product') && linkedId
      ? { kind: first, id: linkedId }
      : null
  const rawName = (location.state as { linkedName?: unknown } | null)?.linkedName
  const linkedName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null
  const creatingRoute = first === 'new'
  const activeRef = creatingRoute || linked ? null : first
  const activeShop = search.get('shop')
  const activeId = activeRef ? orderDetailsKey(activeRef, activeShop) : null

  // The "Add order" form is open (as a tab), and whether it holds anything typed. It stays
  // mounted, with what was typed, while another tab shows.
  // /orders/new opened directly (a reload, a link) starts the form too.
  const [openedCreate, setCreating] = useState(creatingRoute)
  const creating = openedCreate || creatingRoute
  const [createDirty, setCreateDirty] = useState(false)
  const showCreate = creatingRoute
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Another tab: the form (if open) stays mounted behind it, with what was typed.
  function leaveTo(path: string) {
    if (creating) setCreating(true)
    navigate(path)
  }

  function openCreate() {
    setNotice(null)
    setCreating(true)
    navigate(CREATE_PATH)
  }

  // Closes the form for good (created, backed out of, or its tab closed).
  function closeCreate() {
    setCreating(false)
    setCreateDirty(false)
    if (creatingRoute) navigate(LIST_PATH)
  }

  // Asks before throwing away what was typed; `then` runs once the form is closed.
  const [discardAsk, setDiscardAsk] = useState<{ then?: () => void } | null>(null)
  function discardCreate(then?: () => void) {
    if (createDirty) {
      setDiscardAsk({ then })
      return
    }
    closeCreate()
    then?.()
  }

  // The store made the order: say so, and open it (in its own tab) when the answer names it.
  function handleCreated(result: OrderCreateResult, shop: string) {
    setCreating(false)
    setCreateDirty(false)
    const ref =
      result.order_number != null ? String(result.order_number) : (result.id ?? null)
    const label = result.name ?? (ref ? `#${ref}` : 'The order')
    setNotice(result.message || `Order ${label} was created.`)
    if (!ref) {
      navigate(LIST_PATH)
      return
    }
    const storeKey = result.shop ?? shop
    tabs.openTab({
      ref,
      shop: storeKey,
      label: result.order_number != null ? String(result.order_number) : label,
    })
    navigate(orderPathFor(ref, storeKey))
  }

  // Back from a customer's or product's page goes where the person came from (the order, or the
  // list); opened from a bare address there is nothing behind, so it goes to the list.
  function leaveLinked() {
    if (location.key !== 'default') navigate(-1)
    else navigate(LIST_PATH)
  }

  function closeTab(id: string) {
    const index = tabs.tabs.findIndex((tab) => tab.id === id)
    const neighbour = tabs.tabs[index + 1] ?? tabs.tabs[index - 1]
    tabs.closeTab(id)
    if (id === activeId) {
      navigate(neighbour ? orderPathFor(neighbour.ref, neighbour.shop) : LIST_PATH)
    }
  }

  function clearTabs() {
    const clear = () => {
      tabs.clearTabs()
      if (activeId) navigate(LIST_PATH)
    }
    if (creating) discardCreate(clear)
    else clear()
  }

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <OrderTabsBar
        tabs={tabs.tabs}
        activeId={activeId}
        draft={creating ? { active: creatingRoute } : null}
        onSelectDraft={() => navigate(CREATE_PATH)}
        onCloseDraft={() => discardCreate()}
        linked={
          linked
            ? {
                kind: linked.kind === 'customer' ? 'Customer' : 'Product',
                label:
                  linkedName ?? (linked.kind === 'customer' ? 'Customer' : 'Product'),
              }
            : null
        }
        onCloseLinked={leaveLinked}
        onShowList={() => leaveTo(LIST_PATH)}
        onSelect={(id) => {
          const tab = tabs.tabs.find((candidate) => candidate.id === id)
          if (tab) leaveTo(orderPathFor(tab.ref, tab.shop))
        }}
        onClose={closeTab}
        onClear={clearTabs}
      />

      {notice && !showCreate && <FormMessage tone="success">{notice}</FormMessage>}

      {creating && (
        <div
          className={
            showCreate ? 'relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto' : 'hidden'
          }
        >
          <OrderCreateView
            key="create-order"
            onBack={closeCreate}
            onCreated={handleCreated}
            onDirtyChange={setCreateDirty}
          />
        </div>
      )}

      {discardAsk && (
        <ConfirmCancelDialog
          title="Discard this new order?"
          question=""
          detail="What you entered will be lost."
          keepLabel="Keep editing"
          confirmLabel="Yes, discard"
          onConfirm={() => {
            const { then } = discardAsk
            setDiscardAsk(null)
            closeCreate()
            then?.()
          }}
          onKeep={() => setDiscardAsk(null)}
        />
      )}

      {activeRef && (
        <div className="relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <OrderDetailsView
            key={`${activeShop ?? ''}|${activeRef}`}
            reference={activeRef}
            shop={activeShop}
            onBack={() => navigate(LIST_PATH)}
          />
        </div>
      )}

      {linked && (
        <div className="relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {linked.kind === 'customer' ? (
            <CustomerDetailsView
              key={`customer-${linked.id}`}
              id={linked.id}
              backLabel="Back"
              onBack={leaveLinked}
            />
          ) : (
            <ProductDetailsView
              key={`product-${linked.id}`}
              id={linked.id}
              onBack={leaveLinked}
            />
          )}
        </div>
      )}

      {/* Kept mounted but hidden while an order is open (display: none also removes it
          from tab order and screen readers). */}
      <div
        className={
          activeRef || creatingRoute || linked
            ? 'hidden'
            : 'flex flex-col gap-4 lg:min-h-0 lg:flex-1'
        }
      >
        <OrdersKpis data={data} />

        <OrdersToolbar
          actions={
            <button
              type="button"
              onClick={openCreate}
              className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border-none px-3.5 text-[0.82rem] font-semibold shadow-sm transition-colors"
            >
              <PlusIcon width={16} height={16} />
              Add order
            </button>
          }
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

          <HighlightQuery query={filters.search}>
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
          </HighlightQuery>

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
