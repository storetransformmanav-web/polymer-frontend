import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ColumnsMenu } from '../../../components/ui/ColumnsMenu.tsx'
import { ConfirmCancelDialog } from '../../../components/ui/ConfirmCancelDialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { Highlight, HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { LockIcon, PlusIcon, RefreshIcon } from '../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { CustomerDetailsView } from '../../customers/index.ts'
import { ProductDetailsView } from '../../products/index.ts'
import { LockConfirmDialog } from '../components/LockConfirmDialog.tsx'
import { LockCreateView } from '../components/LockCreateView.tsx'
import { LockDetailsView } from '../components/LockDetailsView.tsx'
import { LocksList } from '../components/LocksList.tsx'
import { LocksToolbar } from '../components/LocksToolbar.tsx'
import { readLinkedFrom } from '../../../hooks/useLinkedState.ts'
import { useLockColumns } from '../hooks/useLockColumns.ts'
import { useLockShop } from '../hooks/useLockShop.ts'
import { useLockDetails, useLocks } from '../hooks/useLocks.ts'
import { lockMemory, useLockTabs } from '../hooks/useLockTabs.ts'
import { useSetupStore } from '../hooks/useLockWrites.ts'
import { LOCK_COLUMNS } from '../utils/columns.ts'
import { lockPath } from '../utils/format.ts'

// Not a lock's handle: the tab of a product or customer opened from a lock.
const LINKED_ID = '__linked__'

/** How long a "saved" confirmation stays on screen. */
const NOTICE_MS = 10_000

/** The product or customer opened from a lock, remembered so its tab stays open. */
interface LinkedTab {
  kind: 'product' | 'customer'
  id: string
  name: string | null
  /** The address it was opened from (the lock), where its Back and ✕ return. */
  from: string | null
}

// The page itself does not scroll from `lg` up (`fillHeight` in navigation.ts): the table has
// its own scrollbar, and the Add lock form and a lock's page scroll inside this box.
const SCROLL_VIEW = 'relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto'

const LIST_PATH = '/locks'
const NEW_PATH = '/locks/new'

/**
 * Lock Management: the products hidden from everyone but customers who carry the right tag.
 * The list (search, status / Shopify state / tag filters, paging) is `/locks`; **Add lock**
 * opens in place of it at `/locks/new` (products, tags and customers all picked from what the
 * API has); a lock's own page is `/locks/:handle`. Everything is for one store — the one picked
 * in the top bar, else the first connected one — because every `/access/*` call needs a store.
 * Data comes from TanStack Query, so a page or filter seen before shows at once.
 */
export function LocksPage() {
  const { shop, shopName } = useLockShop()
  const locks = useLocks(shop)
  // Which columns the table shows (the Columns menu), remembered on this browser.
  const columnChoice = useLockColumns()
  const { setup, clearError: clearSetupError } = useSetupStore()
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const location = useLocation()
  const { filters, data } = locks

  // `/locks` → the list; `/locks/new` → the Add lock form; `/locks/<handle>` → that lock.
  const segments = splat ? splat.split('/') : []
  const first = segments[0] ?? ''
  // `/locks/product/<id>` and `/locks/customer/<id>`: the protected product's or a customer's own
  // page, opened from the lock and shown in this same page as a tab of its own.
  const linkedId = segments[1] ? decodeURIComponent(segments[1]) || null : null
  const linked: { kind: 'product' | 'customer'; id: string } | null =
    (first === 'product' || first === 'customer') && linkedId
      ? { kind: first, id: linkedId }
      : null
  const rawName = (location.state as { linkedName?: unknown } | null)?.linkedName
  const linkedName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null
  const creating = first === 'new'
  const activeHandle = first && !creating && !linked ? decodeURIComponent(first) : null
  const activeRow = activeHandle
    ? (locks.items.find((item) => item.handle === activeHandle) ?? null)
    : null
  const details = useLockDetails(shop, activeHandle, activeRow)
  const lockTabs = useLockTabs()

  // The product or customer opened from a lock keeps its tab while the person goes back to the
  // lock (or another lock) — it is only closed by its own ✕ or Clear, not by switching tabs.
  const linkedFrom = readLinkedFrom(location.state, LIST_PATH)
  const [linkedTab, setLinkedTab] = useState<LinkedTab | null>(null)
  // While it is on screen the address is the truth; what it lacks (no router state after a
  // reload) is taken from the remembered tab of the same record.
  const sameAsRemembered =
    !!linked && linkedTab?.kind === linked.kind && linkedTab.id === linked.id
  const shownLinked: LinkedTab | null = linked
    ? {
        kind: linked.kind,
        id: linked.id,
        name: linkedName ?? (sameAsRemembered ? linkedTab.name : null),
        from: linkedFrom ?? (sameAsRemembered ? linkedTab.from : null),
      }
    : linkedTab
  // Remember it (adjusting state while rendering, React's pattern for state derived from props).
  if (
    linked &&
    shownLinked &&
    !(
      sameAsRemembered &&
      linkedTab.name === shownLinked.name &&
      linkedTab.from === shownLinked.from
    )
  ) {
    setLinkedTab(shownLinked)
  }
  const { openTab, closeTab } = lockTabs
  const openedTitle = details.lock?.title ?? null

  // An opened lock gets a tab (also one opened from a bare address), named once it is known.
  useEffect(() => {
    if (activeHandle) openTab({ id: activeHandle, title: openedTitle })
  }, [activeHandle, openedTitle, openTab])

  // Leaving the Locks page for another and coming back must not close the lock that was open: the
  // page remembers which one was on screen (and for which store), and when it is reached at the
  // bare list address — from the sidebar — it reopens that lock. Showing the list *inside* the
  // page (Back to list, All Locks, closing the tab) forgets it, so the list stays the list.
  const arrived = useRef(true)
  useEffect(() => {
    if (arrived.current) {
      arrived.current = false
      const back = lockMemory.open
      if (!splat && back && back.shop === shop) {
        navigate(back.path, { replace: true })
        return
      }
    }
    if (!splat) lockMemory.open = null
    else if (activeHandle) lockMemory.open = { shop, path: location.pathname }
  }, [splat, activeHandle, shop, location.pathname, navigate])

  const [notice, setNotice] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [settingUp, setSettingUp] = useState(false)

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const closeForm = useCallback(() => {
    setConfirmingClose(false)
    setDirty(false)
    navigate(LIST_PATH)
  }, [navigate])

  /** Back / Cancel on the form: ask first when something was entered. */
  const requestClose = useCallback(() => {
    if (dirty) setConfirmingClose(true)
    else closeForm()
  }, [dirty, closeForm])

  /** ✕ on a tab: closing the lock on screen moves to its neighbour, else to the list. */
  function closeLockTab(id: string) {
    const index = lockTabs.tabs.findIndex((tab) => tab.id === id)
    const neighbour = lockTabs.tabs[index + 1] ?? lockTabs.tabs[index - 1]
    closeTab(id)
    if (id === activeHandle) navigate(neighbour ? lockPath(neighbour.id) : LIST_PATH)
  }

  // Closing the product or customer goes to the address it was opened from (the lock, or the
  // list) — never "back in history", which may be another page if the person left and returned.
  function leaveLinked() {
    navigate(shownLinked?.from ?? LIST_PATH, { replace: true })
  }

  /** ✕ on the product's / customer's tab: forget it, and leave it when it is on screen. */
  function closeLinked() {
    setLinkedTab(null)
    if (linked) leaveLinked()
  }

  /** Back to the product / customer opened from a lock, from its tab. */
  function showLinked(tab: LinkedTab) {
    navigate(`${LIST_PATH}/${tab.kind}/${encodeURIComponent(tab.id)}`, {
      state: { linkedName: tab.name ?? undefined, from: tab.from ?? undefined },
    })
  }

  const tabsBar = (
    <OpenTabsBar
      tabs={[
        ...lockTabs.tabs.map((tab) => ({
          id: tab.id,
          label: tab.title ?? tab.id,
          title: `/products/${tab.id}`,
        })),
        ...(shownLinked
          ? [
              {
                id: LINKED_ID,
                label:
                  shownLinked.name ??
                  (shownLinked.kind === 'customer' ? 'Customer' : 'Product'),
                kind: shownLinked.kind === 'customer' ? 'Customer' : 'Product',
                title: shownLinked.name ?? undefined,
              },
            ]
          : []),
      ]}
      activeId={linked ? LINKED_ID : activeHandle}
      navLabel="Open locks"
      listLabel="All Locks"
      kind="Lock"
      historyLabel="Opened locks"
      icon={LockIcon}
      onShowList={() => navigate(LIST_PATH)}
      onSelect={(id) => {
        if (id !== LINKED_ID) navigate(lockPath(id))
        else if (linkedTab && !linked) showLinked(linkedTab)
      }}
      onClose={(id) => (id === LINKED_ID ? closeLinked() : closeLockTab(id))}
      onClear={() => {
        lockTabs.clearTabs()
        setLinkedTab(null)
        if (activeHandle || linked) navigate(LIST_PATH)
      }}
    />
  )

  const addButton = (
    <button
      type="button"
      onClick={() => {
        setNotice(null)
        navigate(NEW_PATH)
      }}
      className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border-none px-4 text-[0.85rem] font-semibold shadow-sm transition-colors"
    >
      <PlusIcon width={16} height={16} />
      Add lock
    </button>
  )

  if (creating) {
    return (
      <>
        <div className={SCROLL_VIEW}>
          <LockCreateView
            shop={shop}
            shopName={shopName}
            onBack={requestClose}
            onDirtyChange={setDirty}
            onDone={(message) => {
              setNotice(message)
              setDirty(false)
              navigate(LIST_PATH)
            }}
          />
        </div>
        {confirmingClose && (
          <ConfirmCancelDialog
            lose="what you entered for the new lock"
            onConfirm={closeForm}
            onKeep={() => setConfirmingClose(false)}
          />
        )}
      </>
    )
  }

  if (linked) {
    return (
      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
        {tabsBar}
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
      </div>
    )
  }

  if (activeHandle) {
    return (
      <div className="relative flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:overflow-hidden [&>*:not(article)]:shrink-0">
        {tabsBar}
        {notice && <FormMessage tone="success">{notice}</FormMessage>}
        <LockDetailsView
          key={activeHandle}
          lock={details.lock}
          notFound={details.notFound}
          error={details.error}
          onRetry={details.retry}
          isFetching={details.isFetching}
          shop={shop}
          shopName={shopName}
          onBack={() => navigate(LIST_PATH)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      {tabsBar}
      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      <LocksToolbar
        shop={shop}
        filters={filters}
        // Clear All also puts the columns back to the default, so a changed choice counts as
        // something to clear.
        hasFilters={locks.hasFilters || !columnChoice.isDefault}
        onChange={locks.setFilters}
        onReset={() => {
          locks.resetFilters()
          columnChoice.reset()
        }}
        actions={
          <>
            <button
              type="button"
              disabled={!shop}
              onClick={() => {
                clearSetupError()
                setSettingUp(true)
              }}
              title="Prepare the store for locks, and send any lock that has not reached it yet"
              className="border-border bg-bg text-text hover:border-accent inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              <RefreshIcon width={16} height={16} />
              Set up store
            </button>
            {addButton}
            {/* Only the table has columns; the cards of a narrow screen do not. */}
            <div className="hidden md:block">
              <ColumnsMenu
                config={columnChoice.config}
                labelOf={(id) => LOCK_COLUMNS[id].label}
                onToggle={columnChoice.toggle}
                onMove={columnChoice.move}
                onReset={columnChoice.reset}
              />
            </div>
          </>
        }
      />

      <section
        aria-label="Locks"
        className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
      >
        {/* Thin activity bar: results stay on screen while a refresh runs. */}
        <div
          aria-hidden="true"
          className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
            locks.isFetching && !locks.isPending
              ? 'animate-pulse opacity-100'
              : 'opacity-0'
          }`}
        />

        <div className="border-border flex items-baseline justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-[0.95rem] font-semibold">Existing locks</h2>
          <span className="text-text-muted text-[0.78rem]">
            {data
              ? `${data.total.toLocaleString('en-GB')} locked product${data.total === 1 ? '' : 's'}`
              : ''}
            {shopName && (
              <>
                {data ? ' · ' : ''}
                <Highlight text={shopName} />
              </>
            )}
          </span>
        </div>

        <HighlightQuery query={filters.search}>
          <LocksList
            items={locks.items}
            shop={shop}
            isPending={locks.isPending}
            error={locks.error}
            hasFilters={locks.hasFilters}
            isStale={locks.isShowingPrevious}
            onOpen={(lock) => {
              setNotice(null)
              navigate(lockPath(lock.handle ?? lock.product_id))
            }}
            onRetry={locks.retry}
            onClearFilters={locks.resetFilters}
            emptyAction={addButton}
            columns={columnChoice.columns}
          />
        </HighlightQuery>

        {data && data.total > 0 && (
          <PaginationFooter
            page={data.page}
            pageSize={filters.pageSize}
            total={data.total}
            totalPages={data.total_pages}
            onPageChange={(page) => locks.setFilters({ page })}
            onPageSizeChange={(pageSize) => locks.setFilters({ pageSize })}
          />
        )}
      </section>

      {settingUp && (
        <LockConfirmDialog
          title={`Set up locks in ${shopName || 'this store'}?`}
          confirmLabel="Yes, set up"
          onClose={() => setSettingUp(false)}
          onConfirm={async () => {
            const message = await setup(shop)
            setSettingUp(false)
            setNotice(message)
          }}
        >
          <p>
            This prepares the store for locks (it is safe to repeat) and sends every lock
            that is still pending or failed to Shopify.
          </p>
        </LockConfirmDialog>
      )}
    </div>
  )
}
