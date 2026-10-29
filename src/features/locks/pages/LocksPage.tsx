import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmCancelDialog } from '../../../components/ui/ConfirmCancelDialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { Highlight, HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { PlusIcon, RefreshIcon } from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { LockConfirmDialog } from '../components/LockConfirmDialog.tsx'
import { LockCreateView } from '../components/LockCreateView.tsx'
import { LockDetailsView } from '../components/LockDetailsView.tsx'
import { LocksList } from '../components/LocksList.tsx'
import { LocksToolbar } from '../components/LocksToolbar.tsx'
import { useLockShop } from '../hooks/useLockShop.ts'
import { useLockDetails, useLocks } from '../hooks/useLocks.ts'
import { useSetupStore } from '../hooks/useLockWrites.ts'
import { lockPath } from '../utils/format.ts'

/** How long a "saved" confirmation stays on screen. */
const NOTICE_MS = 10_000

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
  const { filters, data } = locks

  // `/locks` → the list; `/locks/new` → the Add lock form; `/locks/<handle>` → that lock.
  const first = splat ? splat.split('/')[0] : ''
  const creating = first === 'new'
  const activeHandle = first && !creating ? decodeURIComponent(first) : null
  const activeRow = activeHandle
    ? (locks.items.find((item) => item.handle === activeHandle) ?? null)
    : null
  const details = useLockDetails(shop, activeHandle, activeRow)

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

  if (activeHandle) {
    return (
      <div className="flex flex-col gap-4">
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
          onNotice={setNotice}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
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
        className="border-border bg-bg relative overflow-hidden rounded-2xl border"
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
