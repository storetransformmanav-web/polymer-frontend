import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ConfirmCancelDialog } from '../../../components/ui/ConfirmCancelDialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { Highlight, HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { LockIcon, PlusIcon, RefreshIcon } from '../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ProductDetailsView } from '../../products/index.ts'
import { LockConfirmDialog } from '../components/LockConfirmDialog.tsx'
import { LockCreateView } from '../components/LockCreateView.tsx'
import { LockDetailsView } from '../components/LockDetailsView.tsx'
import { LocksList } from '../components/LocksList.tsx'
import { LocksToolbar } from '../components/LocksToolbar.tsx'
import { useLockShop } from '../hooks/useLockShop.ts'
import { useLockDetails, useLocks } from '../hooks/useLocks.ts'
import { useLockTabs } from '../hooks/useLockTabs.ts'
import { useSetupStore } from '../hooks/useLockWrites.ts'
import { lockPath } from '../utils/format.ts'

// Not a lock's handle: the tab of a product opened from a lock.
const LINKED_ID = '__linked-product__'

/** How long a "saved" confirmation stays on screen. */
const NOTICE_MS = 10_000

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
  const { setup, clearError: clearSetupError } = useSetupStore()
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const location = useLocation()
  const { filters, data } = locks

  // `/locks` → the list; `/locks/new` → the Add lock form; `/locks/<handle>` → that lock.
  const segments = splat ? splat.split('/') : []
  const first = segments[0] ?? ''
  // `/locks/product/<id>`: the protected product's own page, opened from the lock and shown in
  // this same page as a tab of its own.
  const linkedProductId =
    first === 'product' && segments[1] ? decodeURIComponent(segments[1]) || null : null
  const rawName = (location.state as { linkedName?: unknown } | null)?.linkedName
  const linkedName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null
  const creating = first === 'new'
  const activeHandle =
    first && !creating && !linkedProductId ? decodeURIComponent(first) : null
  const activeRow = activeHandle
    ? (locks.items.find((item) => item.handle === activeHandle) ?? null)
    : null
  const details = useLockDetails(shop, activeHandle, activeRow)
  const lockTabs = useLockTabs()
  const { openTab, closeTab } = lockTabs
  const openedTitle = details.lock?.title ?? null

  // An opened lock gets a tab (also one opened from a bare address), named once it is known.
  useEffect(() => {
    if (activeHandle) openTab({ id: activeHandle, title: openedTitle })
  }, [activeHandle, openedTitle, openTab])

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

  // Back from the product goes where the person came from (the lock); opened from a bare
  // address there is nothing behind, so it goes to the list.
  function leaveLinked() {
    if (location.key !== 'default') navigate(-1)
    else navigate(LIST_PATH)
  }

  const tabsBar = (
    <OpenTabsBar
      tabs={[
        ...lockTabs.tabs.map((tab) => ({
          id: tab.id,
          label: tab.title ?? tab.id,
          title: `/products/${tab.id}`,
        })),
        ...(linkedProductId
          ? [
              {
                id: LINKED_ID,
                label: linkedName ?? 'Product',
                kind: 'Product',
                title: linkedName ?? 'Product',
              },
            ]
          : []),
      ]}
      activeId={linkedProductId ? LINKED_ID : activeHandle}
      navLabel="Open locks"
      listLabel="All Locks"
      kind="Lock"
      historyLabel="Opened locks"
      icon={LockIcon}
      onShowList={() => navigate(LIST_PATH)}
      onSelect={(id) => {
        if (id !== LINKED_ID) navigate(lockPath(id))
      }}
      onClose={(id) => (id === LINKED_ID ? leaveLinked() : closeLockTab(id))}
      onClear={() => {
        lockTabs.clearTabs()
        if (activeHandle) navigate(LIST_PATH)
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

  if (linkedProductId) {
    return (
      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
        {tabsBar}
        <div className="relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <ProductDetailsView
            key={`product-${linkedProductId}`}
            id={linkedProductId}
            onBack={leaveLinked}
          />
        </div>
      </div>
    )
  }

  if (activeHandle) {
    return (
      <div
        className={`flex flex-col gap-4 [&>*:not(article)]:shrink-0 ${SCROLL_VIEW} lg:has-[#lock-tab-access[aria-selected=true]]:overflow-y-hidden`}
      >
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
        hasFilters={locks.hasFilters}
        onChange={locks.setFilters}
        onReset={locks.resetFilters}
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
