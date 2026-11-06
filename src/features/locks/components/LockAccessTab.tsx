import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { PlusIcon, SearchIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import type {
  AccessLock,
  CustomerListItem,
  LockCustomer,
} from '../../../lib/api/endpoints.ts'
import { useLockCustomers } from '../hooks/useLockCustomers.ts'
import {
  useAccessChecks,
  useSetLockCustomers,
  type AccessCheckOutcome,
} from '../hooks/useLockWrites.ts'
import { usePickCustomers } from '../hooks/usePickers.ts'
import { canEditCustomer, checkReasonText } from '../utils/format.ts'
import { MAX_ITEMS, type PickedItem } from '../utils/lockDraft.ts'
import { AddCustomersDialog, RemoveCustomerDialog } from './LockCustomerDialogs.tsx'
import { LockCustomersList } from './LockCustomersList.tsx'
import { PickList, type PickRow } from './PickList.tsx'
import { PickedChips } from './PickedChips.tsx'

const BUTTON =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const SECONDARY = `${BUTTON} border-accent/30 bg-bg text-accent hover:bg-accent-tint`
const PRIMARY = `${BUTTON} border-transparent bg-accent text-accent-contrast hover:bg-accent-hover`
const SMALL =
  'inline-flex h-8 cursor-pointer items-center justify-center rounded-md border px-3 text-[0.8rem] font-semibold transition-colors'

/**
 * A customer in the search list. One who already carries one of the lock's tags can already open
 * the product (that is what the access check looks at), so the row is shown ticked and locked —
 * there is nothing to add. A lock with no tags is login-only: no row is marked.
 */
const customerRow = (
  customer: CustomerListItem,
  lockTags: readonly string[],
): PickRow => {
  const keys = new Set(lockTags.map((tag) => tag.trim().toLowerCase()))
  const hasAccess =
    keys.size > 0 &&
    (customer.tags ?? []).some((tag) => keys.has(String(tag).trim().toLowerCase()))
  return {
    id: customer.id,
    label: customer.full_name?.trim() || customer.email || 'Unnamed customer',
    sub: customer.email,
    chips: customer.tags,
    ...(hasAccess ? { locked: 'Already has access' } : {}),
  }
}

/** What is sent to `GET /access/check` (and to the dialogs) for a picked customer. */
const refOf = (item: PickedItem) => item.sub?.trim() || item.id

/** A checked customer as the dialogs know one — the lock tags they hold are the matched ones. */
const asLockCustomer = (item: PickedItem, outcome: AccessCheckOutcome): LockCustomer => ({
  id: item.id,
  name: item.label,
  email: item.sub ?? null,
  phone: null,
  company: null,
  tags: outcome.check?.matched_tags ?? [],
  created_at: null,
})

/**
 * The **Customer Access** tab. At the top, the store's customers to check, chosen like the Add lock
 * form's Customers card (`PickList`): nothing is listed until something is typed, then every
 * customer of the store that matches (name, email or tag — `GET /customers?role=all`, the backend
 * searches) with a checkbox each; several can be ticked, and they stay ticked through searches as
 * removable chips. **Check** asks `GET /access/check` for each ticked customer — "would they see
 * this product?" — and lists the answers (the backend's own `message`, Allowed / Not allowed); the
 * checked customers are highlighted in the list of who has access below. Under an answer: **Give
 * access** for one who is not allowed (the Add dialog, prefilled), **Edit access** and **Remove
 * access** for one who is. **Add New Customer** adds any customers by email or id. Every write is
 * `PUT /access/locks/{product}/customers`, asks first, and an error from the API — such as a
 * customer who already has the access — shows inside the dialog.
 *
 * When the website does not enforce the lock (`theme_enforces: false`: manual locking is on) an
 * amber warning follows, with a button to the lock's settings.
 */
export function LockAccessTab({
  lock,
  shop,
  onOpenSettings,
}: {
  lock: AccessLock
  shop: string
  onOpenSettings: () => void
}) {
  const product = lock.handle ?? lock.product_id
  const customers = useLockCustomers(shop, product)
  const [search, setSearch] = useState('')
  // Asked for only once something is typed.
  const store = usePickCustomers(shop, search, search.trim() !== '')
  const [picked, setPicked] = useState<PickedItem[]>([])
  const { check, results, isChecking, reset } = useAccessChecks()
  const { set, isSetting, error: addError } = useSetLockCustomers()
  const [editing, setEditing] = useState<LockCustomer | null>(null)
  const [removing, setRemoving] = useState<LockCustomer | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [limitHit, setLimitHit] = useState(false)

  const pickedIds = new Set(picked.map((item) => item.id))

  function choose(next: PickedItem[]) {
    setLimitHit(next.length > MAX_ITEMS)
    setPicked(next.slice(0, MAX_ITEMS))
    // The answers were for the old choice.
    reset()
  }

  function toggle(row: PickRow) {
    choose(
      pickedIds.has(row.id)
        ? picked.filter((item) => item.id !== row.id)
        : [...picked, { id: row.id, label: row.label, sub: row.sub }],
    )
  }

  function togglePage(rows: PickRow[], select: boolean) {
    const ids = new Set(rows.map((row) => row.id))
    choose(
      select
        ? [
            ...picked,
            ...rows
              .filter((row) => !pickedIds.has(row.id))
              .map((row) => ({ id: row.id, label: row.label, sub: row.sub })),
          ]
        : picked.filter((item) => !ids.has(item.id)),
    )
  }

  /**
   * Gives access straight away — no window: the customers are the ones ticked above (or the
   * ones an answer is for). A lock with several tags gives its first; the API refuses a customer
   * who already has the access and its message shows under the buttons.
   */
  async function addNow(refs: string[]) {
    if (refs.length === 0 || isSetting) return
    setNotice(null)
    try {
      const result = await set({
        product,
        body: {
          shop,
          add: refs,
          ...(lock.tags.length > 1 ? { tag: lock.tags[0] } : {}),
        },
      })
      setNotice(result.message)
      choose([])
    } catch {
      // The message is shown from `addError`; the choice stays so it can be tried again.
    }
  }

  function runCheck() {
    if (picked.length === 0) return
    setNotice(null)
    check({ shop, product: lock.product_id, customers: picked.map(refOf) })
  }

  // Each answer beside the customer it is for (the choice can't change while it runs).
  const answers = (results ?? []).flatMap((outcome, index) => {
    const item = picked[index]
    return item ? [{ item, outcome }] : []
  })
  const notAllowed = answers.filter(({ outcome }) => outcome.check?.allowed === false)
  const unenforced = answers.some(
    ({ outcome }) => outcome.check?.theme_enforces === false,
  )
  const highlight = answers.flatMap(({ item }) => [
    item.id,
    ...(item.sub ? [item.sub] : []),
  ])

  const dialogProps = {
    lock,
    shop,
    product,
    sharedTags: customers.tags,
    onDone: setNotice,
  }

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <section className={`${DETAIL_CARD} flex shrink-0 flex-col gap-4 p-4`}>
        <PickedChips
          noun="customer"
          items={picked}
          onRemove={(id) => choose(picked.filter((item) => item.id !== id))}
          onClear={() => choose([])}
        />
        <PickList
          listHeight="max-h-56"
          label="Customers to check"
          noun="customer"
          rows={store.items.map((customer) => customerRow(customer, lock.tags))}
          selectedIds={pickedIds}
          onToggle={toggle}
          onTogglePage={togglePage}
          search={search}
          onSearch={setSearch}
          searchLabel="Search customers to check"
          searchPlaceholder="Search customers by name, email or tag…"
          listOnlyWhenSearching
          total={store.total}
          isPending={store.isPending}
          isFetching={store.isFetching}
          isLoadingMore={store.isLoadingMore}
          hasMore={store.hasMore}
          onLoadMore={store.loadMore}
          error={store.error}
          onRetry={store.retry}
        />
        {limitHit && (
          <FormMessage tone="error">
            {`Up to ${MAX_ITEMS} customers can be checked at a time.`}
          </FormMessage>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runCheck}
            disabled={isChecking || picked.length === 0}
            className={SECONDARY}
          >
            {isChecking ? (
              <SpinnerIcon width={16} height={16} className="animate-spin" />
            ) : (
              <SearchIcon width={16} height={16} />
            )}
            Check
          </button>
          <button
            type="button"
            onClick={() => void addNow(picked.map(refOf))}
            disabled={isSetting || picked.length === 0}
            title={
              picked.length === 0
                ? 'Tick the customers to add in the list above'
                : undefined
            }
            className={PRIMARY}
          >
            {isSetting ? (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            ) : (
              <PlusIcon width={14} height={14} />
            )}
            Add New Customer
          </button>
          {notAllowed.length > 1 && (
            <button
              type="button"
              onClick={() => void addNow(notAllowed.map(({ item }) => refOf(item)))}
              disabled={isSetting}
              className={`${SMALL} border-border bg-bg text-text hover:border-accent ml-auto`}
            >
              Give access to all not allowed ({notAllowed.length})
            </button>
          )}
        </div>

        {addError && <FormMessage tone="error">{addError}</FormMessage>}

        {answers.length > 0 && (
          <ul aria-label="Access check results" className="flex flex-col gap-2">
            {answers.map(({ item, outcome }) => {
              const result = outcome.check
              const asCustomer = asLockCustomer(item, outcome)
              return (
                <li
                  key={item.id}
                  className={`flex flex-col gap-2 rounded-lg px-3 py-2.5 text-[0.85rem] sm:flex-row sm:items-center ${
                    result?.allowed
                      ? 'bg-accent-tint text-accent'
                      : 'bg-danger-bg text-danger'
                  }`}
                >
                  <div role="status" className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <strong>
                        {!result
                          ? 'Not checked'
                          : result.allowed
                            ? 'Allowed'
                            : 'Not allowed'}
                      </strong>
                      <span className="text-text font-semibold">{item.label}</span>
                      {item.sub && item.sub !== item.label && (
                        <span className="text-text-muted text-[0.78rem]">{item.sub}</span>
                      )}
                    </span>
                    {/* The backend's own explanation; the reason in words only if it sent none. */}
                    <span>
                      {result
                        ? result.message.trim() || checkReasonText(result.reason)
                        : outcome.error}
                    </span>
                    {result && result.matched_tags.length > 0 && (
                      <span>Matching tags: {result.matched_tags.join(', ')}</span>
                    )}
                  </div>
                  {result && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {!result.allowed ? (
                        <button
                          type="button"
                          aria-label={`Give access to ${item.label}`}
                          onClick={() => void addNow([refOf(item)])}
                          disabled={isSetting}
                          className={`${SMALL} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
                        >
                          Give access
                        </button>
                      ) : (
                        <>
                          {canEditCustomer(lock, asCustomer) && (
                            <button
                              type="button"
                              aria-label={`Edit access of ${item.label}`}
                              onClick={() => setEditing(asCustomer)}
                              className={`${SMALL} border-border bg-bg text-text hover:border-accent`}
                            >
                              Edit access
                            </button>
                          )}
                          {lock.tags.length > 0 && (
                            <button
                              type="button"
                              aria-label={`Remove access of ${item.label}`}
                              onClick={() => setRemoving(asCustomer)}
                              className={`${SMALL} border-border bg-bg text-danger hover:border-danger`}
                            >
                              Remove access
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {unenforced && (
          <div
            role="alert"
            className="bg-warning-bg text-warning flex flex-col items-start gap-2 rounded-lg px-3 py-2.5 text-[0.85rem]"
          >
            <span>
              Manual locking is on for this product, so the website shows it to everyone.
              Switch Manual locking off to enforce the lock.
            </span>
            <button
              type="button"
              onClick={onOpenSettings}
              className="border-warning/40 bg-bg text-text hover:border-warning cursor-pointer rounded-md border px-2.5 py-1 text-[0.8rem] font-semibold transition-colors"
            >
              Open lock settings
            </button>
          </div>
        )}
      </section>

      <LockCustomersList
        lock={lock}
        customers={customers}
        highlight={highlight}
        notice={notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
        onEdit={(customer) => {
          setNotice(null)
          setEditing(customer)
        }}
        onRemove={(customer) => {
          setNotice(null)
          setRemoving(customer)
        }}
      />

      {editing &&
        createPortal(
          <AddCustomersDialog
            {...dialogProps}
            editing={editing}
            onClose={() => setEditing(null)}
          />,
          document.body,
        )}
      {removing &&
        createPortal(
          <RemoveCustomerDialog
            {...dialogProps}
            customer={removing}
            onClose={() => setRemoving(null)}
          />,
          document.body,
        )}
    </div>
  )
}
