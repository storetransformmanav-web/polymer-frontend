import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { PlusIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import type {
  AccessLock,
  CustomerListItem,
  LockCustomer,
} from '../../../lib/api/endpoints.ts'
import { useLockCustomers } from '../hooks/useLockCustomers.ts'
import { useSetLockCustomers } from '../hooks/useLockWrites.ts'
import { usePickCustomers } from '../hooks/usePickers.ts'
import { MAX_ITEMS, type PickedItem } from '../utils/lockDraft.ts'
import { AddCustomersDialog, RemoveCustomerDialog } from './LockCustomerDialogs.tsx'
import { LockCustomersList } from './LockCustomersList.tsx'
import { PickList, type PickRow } from './PickList.tsx'
import { PickedChips } from './PickedChips.tsx'

const PRIMARY =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent bg-accent px-4 text-[0.85rem] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-50'

/**
 * A customer in the search list. One who already carries one of the lock's tags can already open
 * the product, so the row is shown ticked and locked — there is nothing to add. A lock with no
 * tags is login-only: no row is marked.
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

/** What is sent to the API for a picked customer: the email, else the id. */
const refOf = (item: PickedItem) => item.sub?.trim() || item.id

/**
 * The **Customer Access** tab, one card. At the top, a search over the store's customers, chosen
 * like the Add lock form's Customers card (`PickList`): nothing is listed until something is typed,
 * then every customer of the store that matches (name, email or tag — `GET /customers?role=all`,
 * the backend searches) with a checkbox each; several can be ticked, and they stay ticked through
 * searches as removable chips. A customer who already has the access is shown ticked and locked.
 * **Add New Customer** gives access to the ticked customers at once (no window). Under it, the
 * table of who can already open the product, with **Edit access** and **Remove access** on each
 * row. Every write is `PUT /access/locks/{product}/customers`; an error from the API — such as a
 * customer who already has the access — shows under the search.
 */
export function LockAccessTab({ lock, shop }: { lock: AccessLock; shop: string }) {
  const product = lock.handle ?? lock.product_id
  const customers = useLockCustomers(shop, product)
  const [search, setSearch] = useState('')
  // Asked for only once something is typed.
  const store = usePickCustomers(shop, search, search.trim() !== '')
  const [picked, setPicked] = useState<PickedItem[]>([])
  const { set, isSetting, error: addError } = useSetLockCustomers()
  const [editing, setEditing] = useState<LockCustomer | null>(null)
  const [removing, setRemoving] = useState<LockCustomer | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [limitHit, setLimitHit] = useState(false)

  const pickedIds = new Set(picked.map((item) => item.id))

  function choose(next: PickedItem[]) {
    setLimitHit(next.length > MAX_ITEMS)
    setPicked(next.slice(0, MAX_ITEMS))
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
   * Gives access straight away — no window — to the customers ticked above. A lock with several
   * tags gives its first; the API refuses a customer who already has the access and its message
   * shows under the search.
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

  const dialogProps = {
    lock,
    shop,
    product,
    sharedTags: customers.tags,
    onDone: setNotice,
  }

  return (
    <section className={`${DETAIL_CARD} flex flex-col lg:min-h-0 lg:flex-1`}>
      <div className="flex shrink-0 flex-col gap-4 p-4 sm:p-5">
        <PickedChips
          noun="customer"
          items={picked}
          onRemove={(id) => choose(picked.filter((item) => item.id !== id))}
          onClear={() => choose([])}
        />
        <PickList
          listHeight="max-h-44"
          label="Customers to add"
          noun="customer"
          rows={store.items.map((customer) => customerRow(customer, lock.tags))}
          selectedIds={pickedIds}
          onToggle={toggle}
          onTogglePage={togglePage}
          search={search}
          onSearch={setSearch}
          searchLabel="Search customers to add"
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
          actions={
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
          }
        />
        {limitHit && (
          <FormMessage tone="error">
            {`Up to ${MAX_ITEMS} customers can be added at a time.`}
          </FormMessage>
        )}
        {addError && <FormMessage tone="error">{addError}</FormMessage>}
      </div>

      <LockCustomersList
        lock={lock}
        customers={customers}
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
    </section>
  )
}
