import { findOwnTag } from '../../../lib/lockOwnTag.ts'
import { useId, useState } from 'react'
import {
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { Pagination } from '../../../components/ui/Pagination.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type { AccessLock, CustomerListItem } from '../../../lib/api/endpoints.ts'
import { PICK_PAGE_SIZE, usePickStoreCustomers } from '../hooks/useProductLockAccess.ts'
import {
  CHECKBOX,
  CHIP,
  CHIP_X,
  DROPDOWN,
  lowerSet,
  MAX_CUSTOMERS,
  OUTLINE,
  PRIMARY,
  SEARCH_BOX,
  SEARCH_INPUT,
} from './lockAccessStyles.ts'

/** A customer picked to be given access: what is sent (the email, else the id) and what is shown. */
export interface ChosenCustomer {
  ref: string
  label: string
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

const refOf = (customer: CustomerListItem) => customer.email ?? customer.id
const nameOf = (customer: CustomerListItem) =>
  customer.full_name?.trim() || customer.email || 'Unnamed customer'

/** A store customer who already holds one of the product's keys (so already has access). */
function hasAccess(customer: CustomerListItem, keys: Set<string>) {
  return (
    keys.size > 0 &&
    (customer.tags ?? []).some((tag) => keys.has(String(tag).trim().toLowerCase()))
  )
}

/**
 * Adding customers to a locked product, in one line: a search box and the **Add customer** button.
 * Typing suggests the store's customers (`GET /customers`, a dropdown laid out like the Add lock
 * form's customer list: Select all shown, the count found, a row per customer, paging); tick one or
 * more — they stay ticked through searches and pages as chips — and press **Add customer**. A
 * customer who already has access is marked and can't be ticked; an email that is not in the list
 * can be added by itself. Nothing is sent from here: `onAdd` asks the person first.
 */
export function LockCustomerSearch({
  lock,
  shop,
  busy,
  onAdd,
}: {
  lock: AccessLock
  shop: string
  busy: boolean
  onAdd: (customers: ChosenCustomer[]) => void
}) {
  const [query, setQuery] = useState('')
  const [paging, setPaging] = useState({ query: '', page: 1 })
  const [text, setText] = useDebouncedField(query, setQuery)
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<ChosenCustomer[]>([])
  const headingId = useId()
  const page = paging.query === query ? paging.page : 1
  const store = usePickStoreCustomers(shop, query, page)

  // With the lock's own tag, "has access" means already chosen for this lock (holds that tag).
  const ownTag = findOwnTag(lock.tags, lock.handle)
  const keys = lowerSet(ownTag ? [ownTag] : lock.tags)
  const chosenRefs = lowerSet(chosen.map((item) => item.ref))
  const showList = open && text.trim() !== ''
  const choosable = store.items.filter((customer) => !hasAccess(customer, keys))
  const ticked = choosable.filter((customer) =>
    chosenRefs.has(refOf(customer).toLowerCase()),
  )
  const allTicked = choosable.length > 0 && ticked.length === choosable.length
  const full = chosen.length >= MAX_CUSTOMERS
  const typedEmail = text.trim()
  const emailOffer =
    EMAIL.test(typedEmail) &&
    !chosenRefs.has(typedEmail.toLowerCase()) &&
    !store.items.some(
      (customer) => (customer.email ?? '').toLowerCase() === typedEmail.toLowerCase(),
    )

  function toggle(customer: CustomerListItem) {
    const ref = refOf(customer)
    if (chosenRefs.has(ref.toLowerCase())) {
      setChosen(chosen.filter((item) => item.ref.toLowerCase() !== ref.toLowerCase()))
    } else if (!full) {
      setChosen([...chosen, { ref, label: nameOf(customer) }])
    }
  }

  function togglePage() {
    if (allTicked) {
      const drop = lowerSet(choosable.map(refOf))
      setChosen(chosen.filter((item) => !drop.has(item.ref.toLowerCase())))
      return
    }
    const next = [...chosen]
    for (const customer of choosable) {
      if (next.length >= MAX_CUSTOMERS) break
      if (!chosenRefs.has(refOf(customer).toLowerCase())) {
        next.push({ ref: refOf(customer), label: nameOf(customer) })
      }
    }
    setChosen(next)
  }

  function addEmail() {
    if (!emailOffer || full) return
    setChosen([...chosen, { ref: typedEmail, label: typedEmail }])
    setText('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative flex gap-2"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            setOpen(false)
          }
        }}
      >
        <label className={SEARCH_BOX}>
          <SearchIcon width={15} height={15} className="text-text-muted shrink-0" />
          <span className="sr-only">Search the store’s customers to add</span>
          <input
            type="search"
            role="combobox"
            aria-expanded={showList}
            aria-controls="lock-customers-list"
            aria-autocomplete="list"
            value={text}
            maxLength={200}
            disabled={busy}
            placeholder="Search the store’s customers by name, email or tag…"
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setText(event.target.value)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              // A typed email that is not in the list is added with Enter.
              if (event.key === 'Enter') {
                event.preventDefault()
                addEmail()
              }
            }}
            className={SEARCH_INPUT}
          />
          {store.isFetching && showList && (
            <SpinnerIcon
              width={13}
              height={13}
              className="text-text-muted animate-spin"
            />
          )}
          {text && (
            <button
              type="button"
              aria-label="Clear customer search"
              onClick={() => setText('')}
              className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0.5"
            >
              <XIcon width={13} height={13} />
            </button>
          )}
        </label>
        <button
          type="button"
          disabled={busy || chosen.length === 0}
          onClick={() => onAdd(chosen)}
          className={PRIMARY}
        >
          <PlusIcon width={14} height={14} />
          {chosen.length > 1 ? `Add ${chosen.length} customers` : 'Add customer'}
        </button>

        {showList && (
          <div id="lock-customers-list" tabIndex={-1} className={DROPDOWN}>
            <div className="bg-table-head border-border-strong flex items-center gap-3 border-b px-3 py-1.5">
              <input
                type="checkbox"
                id={headingId}
                className={CHECKBOX}
                checked={allTicked}
                disabled={choosable.length === 0 || (full && !allTicked)}
                onChange={togglePage}
              />
              <label
                htmlFor={headingId}
                className="text-text cursor-pointer text-[0.68rem] font-bold tracking-wide uppercase"
              >
                Select all shown ({choosable.length})
              </label>
              <span className="text-text-muted ml-auto text-[0.72rem]" aria-live="polite">
                {store.isPending
                  ? 'Loading…'
                  : `${store.total.toLocaleString('en-GB')} found`}
              </span>
            </div>

            <ul
              aria-label="Customers in the store"
              className="m-0 max-h-60 list-none overflow-auto p-0"
            >
              {emailOffer && (
                <li className="border-border border-b">
                  <button
                    type="button"
                    disabled={full}
                    onClick={addEmail}
                    className="hover:bg-accent-tint/60 text-accent flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-[0.8rem] font-semibold transition-colors disabled:opacity-50"
                  >
                    <PlusIcon width={13} height={13} />
                    Add “{typedEmail}” by email
                  </button>
                </li>
              )}
              {store.error ? (
                <li className="text-danger flex flex-col items-center gap-2 px-4 py-6 text-center text-[0.8rem]">
                  {store.error}
                  <button
                    type="button"
                    onClick={store.retry}
                    className={`${OUTLINE} h-7 px-3 text-[0.78rem]`}
                  >
                    Try again
                  </button>
                </li>
              ) : store.isPending ? (
                <li
                  role="status"
                  className="text-text-muted flex items-center justify-center gap-2 px-4 py-6 text-[0.8rem]"
                >
                  <SpinnerIcon width={13} height={13} className="animate-spin" />
                  Searching customers…
                </li>
              ) : store.items.length === 0 ? (
                !emailOffer && (
                  <li className="text-text-muted px-4 py-6 text-center text-[0.8rem]">
                    No customer matches “{query.trim() || text.trim()}”.
                  </li>
                )
              ) : (
                store.items.map((customer) => {
                  const has = hasAccess(customer, keys)
                  const on = chosenRefs.has(refOf(customer).toLowerCase())
                  const name = nameOf(customer)
                  const tags = (customer.tags ?? []).map(String)
                  return (
                    <li
                      key={customer.id}
                      className="border-border border-b last:border-b-0"
                    >
                      <label
                        className={`flex items-center gap-3 px-3 py-1.5 transition-colors ${
                          has
                            ? 'bg-surface cursor-not-allowed opacity-70'
                            : 'hover:bg-accent-tint/60 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          aria-label={name}
                          checked={has || on}
                          disabled={has || (!on && full)}
                          onChange={() => toggle(customer)}
                          className={CHECKBOX}
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span
                            className="truncate text-[0.82rem] font-semibold"
                            title={name}
                          >
                            {name}
                          </span>
                          {customer.email && customer.email !== name && (
                            <span className="text-text-muted truncate text-[0.72rem]">
                              {customer.email}
                            </span>
                          )}
                        </span>
                        {has ? (
                          <span className="bg-accent-tint text-accent border-accent/30 shrink-0 rounded-full border px-2 py-0.5 text-[0.66rem] font-semibold">
                            Has access
                          </span>
                        ) : (
                          tags.length > 0 && (
                            <span className="hidden shrink-0 items-center gap-1 sm:flex">
                              {tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="bg-surface border-border max-w-24 truncate rounded-full border px-2 py-0.5 text-[0.66rem] font-semibold"
                                >
                                  {tag}
                                </span>
                              ))}
                              {tags.length > 2 && (
                                <span className="text-text-muted text-[0.66rem]">
                                  +{tags.length - 2}
                                </span>
                              )}
                            </span>
                          )
                        )}
                      </label>
                    </li>
                  )
                })
              )}
            </ul>

            {store.totalPages > 1 && !store.error && (
              <div className="border-border-strong bg-accent-tint/40 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t px-3 py-1.5">
                <span className="text-text-muted text-[0.72rem]" aria-live="polite">
                  Showing {((page - 1) * PICK_PAGE_SIZE + 1).toLocaleString('en-GB')}–
                  {Math.min(page * PICK_PAGE_SIZE, store.total).toLocaleString('en-GB')}{' '}
                  of {store.total.toLocaleString('en-GB')}
                </span>
                <Pagination
                  compact
                  page={page}
                  totalPages={store.totalPages}
                  onPageChange={(next) => setPaging({ query, page: next })}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {chosen.length > 0 && (
        <ul
          aria-label="Customers to add"
          className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0"
        >
          {chosen.map((item) => (
            <li
              key={item.ref}
              className={`${CHIP} border-accent/40 border border-dashed`}
              title={item.ref}
            >
              {item.label}
              <button
                type="button"
                aria-label={`Don’t add ${item.label}`}
                onClick={() =>
                  setChosen(chosen.filter((other) => other.ref !== item.ref))
                }
                className={CHIP_X}
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setChosen([])}
              className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0 text-[0.76rem] font-semibold underline"
            >
              Clear
            </button>
          </li>
        </ul>
      )}
      {full && (
        <p className="text-danger m-0 text-[0.76rem]">
          Up to {MAX_CUSTOMERS} customers can be added at a time.
        </p>
      )}
    </div>
  )
}
