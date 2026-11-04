import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DetailSection } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { PlusIcon, SearchIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import type { AccessLock, LockCustomer } from '../../../lib/api/endpoints.ts'
import { useLockCustomers } from '../hooks/useLockCustomers.ts'
import { useAccessCheck } from '../hooks/useLockWrites.ts'
import { canEditCustomer, checkReasonText } from '../utils/format.ts'
import { AddCustomersDialog, RemoveCustomerDialog } from './LockCustomerDialogs.tsx'
import { LockCustomersList } from './LockCustomersList.tsx'

const BUTTON =
  'inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const SECONDARY = `${BUTTON} border-accent/30 bg-bg text-accent hover:bg-accent-tint`
const PRIMARY = `${BUTTON} border-transparent bg-accent text-accent-contrast hover:bg-accent-hover`
const SMALL =
  'inline-flex h-8 cursor-pointer items-center justify-center rounded-md border px-3 text-[0.8rem] font-semibold transition-colors'

const sameCustomer = (customer: LockCustomer, ref: string) => {
  const wanted = ref.trim().toLowerCase()
  return (
    (customer.email ?? '').toLowerCase() === wanted ||
    customer.id.toLowerCase() === wanted
  )
}

/**
 * The **Check access** tab: type a customer's email (or id) and press **Check** — "Would this
 * customer see this product?" (`GET /access/check`; the backend's own `message` is shown as is). The
 * customer is also looked up in the list below (its search is set to what was typed) and
 * **highlighted** there. What follows depends on the answer: a customer who is not in the list gets
 * **Add this customer**; one who is gets **Edit access** (give another of the lock's keys) and
 * **Remove access**. **Add New Customer** (always there, beside Check) adds any customers by email
 * or id. Every write is `PUT /access/locks/{product}/customers`, asks first, and an error from the
 * API — such as a customer who already has the access — shows inside the dialog.
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
  const { check, result, isChecking, error, reset } = useAccessCheck()
  const [who, setWho] = useState('')
  // What was typed when Check was pressed (the box may change afterwards).
  const [checked, setChecked] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ text: string } | null>(null)
  const [editing, setEditing] = useState<LockCustomer | null>(null)
  const [removing, setRemoving] = useState<LockCustomer | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const highlight = result && checked ? checked : null
  // The list has settled on the search for the checked customer.
  const settled = !customers.isPending && !customers.isShowingPrevious
  const found =
    highlight && settled
      ? (customers.customers.find((customer) => sameCustomer(customer, highlight)) ??
        null)
      : null

  function submit() {
    const ref = who.trim()
    if (!ref) return
    setNotice(null)
    setChecked(ref)
    check({ shop, customer: ref, product: lock.product_id })
    // Show the customer in the list below, where the row is highlighted.
    customers.setFilters({ search: ref })
  }

  const dialogProps = {
    lock,
    shop,
    product,
    sharedTags: customers.tags,
    onDone: setNotice,
  }

  return (
    <div className="flex flex-col gap-4">
      <DetailSection title="Check access" icon={SearchIcon}>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-text-muted text-[0.82rem]">
            Would a customer see this product? Type their email address (or id) and press
            Check — or add a new customer.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              aria-label="Customer email or id"
              placeholder="buyer@example.com"
              maxLength={200}
              value={who}
              onChange={(event) => {
                setWho(event.target.value)
                reset()
              }}
              className="border-border bg-surface text-text placeholder:text-text-muted focus:border-accent focus:outline-accent-tint h-11 min-w-56 flex-1 rounded-lg border px-3 text-[0.88rem] outline-none focus:outline-2"
            />
            <button
              type="submit"
              disabled={isChecking || !who.trim()}
              className={SECONDARY}
            >
              {isChecking && (
                <SpinnerIcon width={16} height={16} className="animate-spin" />
              )}
              Check
            </button>
            <button
              type="button"
              onClick={() => {
                setNotice(null)
                setAdding({ text: '' })
              }}
              className={PRIMARY}
            >
              <PlusIcon width={14} height={14} />
              Add New Customer
            </button>
          </div>

          {error && <FormMessage tone="error">{error}</FormMessage>}
          {result && (
            <div
              role="status"
              className={`flex flex-col gap-1 rounded-lg px-3 py-2.5 text-[0.85rem] ${result.allowed ? 'bg-accent-tint text-accent' : 'bg-danger-bg text-danger'}`}
            >
              <strong>{result.allowed ? 'Allowed' : 'Not allowed'}</strong>
              {/* The backend's own explanation; the reason in words only if it sent none. */}
              <span>{result.message.trim() || checkReasonText(result.reason)}</span>
              {result.matched_tags.length > 0 && (
                <span>Matching tags: {result.matched_tags.join(', ')}</span>
              )}
            </div>
          )}
          {result && settled && (
            <div className="flex flex-wrap items-center gap-2">
              {found ? (
                <>
                  <span className="text-text-muted text-[0.82rem]">
                    {found.name ?? found.email} is in the list below.
                  </span>
                  {canEditCustomer(lock, found) && (
                    <button
                      type="button"
                      onClick={() => setEditing(found)}
                      className={`${SMALL} border-border bg-bg text-text hover:border-accent`}
                    >
                      Edit access
                    </button>
                  )}
                  {lock.tags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setRemoving(found)}
                      className={`${SMALL} border-border bg-bg text-danger hover:border-danger`}
                    >
                      Remove access
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span className="text-text-muted text-[0.82rem]">
                    {checked} is not in the list below.
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdding({ text: checked ?? '' })}
                    className={`${SMALL} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
                  >
                    Add this customer
                  </button>
                </>
              )}
            </div>
          )}
          {result?.theme_enforces === false && (
            <div
              role="alert"
              className="bg-warning-bg text-warning flex flex-col items-start gap-2 rounded-lg px-3 py-2.5 text-[0.85rem]"
            >
              <span>
                Manual locking is on for this product, so the website shows it to
                everyone. Switch Manual locking off to enforce the lock.
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
        </form>
      </DetailSection>

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

      {adding &&
        createPortal(
          <AddCustomersDialog
            {...dialogProps}
            initialText={adding.text}
            onClose={() => setAdding(null)}
          />,
          document.body,
        )}
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
