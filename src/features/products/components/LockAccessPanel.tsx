import { useState, type ComponentType, type ReactNode } from 'react'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  EyeOffIcon,
  type IconProps,
  LockIcon,
  PlusIcon,
  SearchIcon,
  SlidersIcon,
  SpinnerIcon,
  TagIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { ariaSort, SortButton } from '../../../components/ui/SortButton.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import type {
  AccessLock,
  CustomerListItem,
  LockCustomer,
  LockCustomerTag,
  ProductDetail,
} from '../../../lib/api/endpoints.ts'
import { formatDateTimeAmPm, initials } from '../../../lib/format.ts'
import {
  customerRefOf,
  LOCK_ACCESS_PAGE_SIZE,
  type LockAccessChange,
  type LockSwitch,
  usePickStoreCustomers,
  useProductLock,
  useProductLockCustomers,
  useProductLockWrites,
} from '../hooks/useProductLockAccess.ts'

const CARD = 'border-border bg-bg rounded-2xl border'
const TILE =
  'bg-accent-tint text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl'
const PRIMARY =
  'bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border-none px-4 text-[0.85rem] font-semibold shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50'
const OUTLINE =
  'border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const DANGER_OUTLINE =
  'border-danger text-danger hover:bg-danger-bg inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border bg-transparent font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const CHIP =
  'bg-accent-tint text-accent inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-[0.75rem] font-semibold'
const TH = 'px-4 py-3 text-left text-[0.7rem] font-bold tracking-wide uppercase'
const TD = 'px-4 py-3 align-middle'
const NOTE = 'bg-warning-bg text-warning mt-3 rounded-lg px-3 py-2 text-[0.82rem]'
const INPUT =
  'border-border bg-surface text-text focus:border-accent h-10 w-full rounded-lg border px-3 text-[0.85rem] outline-none'
const CHECKBOX = 'accent-accent m-0 h-4 w-4 cursor-pointer'

/** At most this many customers are given access in one go (the API's own limit). */
const MAX_CUSTOMERS = 250
/** At most this many keys (tags) on one lock (the API's own limit). */
const MAX_KEYS = 20

/** The lock's settings, in plain words, as the switches of the Settings card. */
const SETTINGS: { name: Exclude<LockSwitch, 'enabled'>; label: string; hint: string }[] =
  [
    {
      name: 'hide_from_nav',
      label: 'Hide from navigation menus',
      hint: 'Customers without access don’t see it in the store’s menus.',
    },
    {
      name: 'hide_from_lists',
      label: 'Hide from lists',
      hint: 'Left out of collections, search results and related products for them.',
    },
    {
      name: 'hide_from_sitemap',
      label: 'Hide from sitemaps',
      hint: 'Left out of the sitemap search engines read.',
    },
    {
      name: 'noindex',
      label: 'Tell search engines not to index',
      hint: 'The page asks Google and others not to show it in results.',
    },
    {
      name: 'manual_locking',
      label: 'Manual locking',
      hint: 'The website shows it to everyone and leaves the lock to custom theme code. Keep off unless a theme developer asks.',
    },
  ]

const SETTING_LABELS: Record<LockSwitch, string> = {
  enabled: 'Lock',
  ...Object.fromEntries(SETTINGS.map((item) => [item.name, item.label])),
} as Record<LockSwitch, string>

const lowerSet = (tags: readonly string[]) =>
  new Set(tags.map((tag) => tag.toLowerCase()))

/** "Tags are shared: …" when a tag also opens other locked products (from the customers answer). */
function sharedNote(shared: readonly LockCustomerTag[], tags: readonly string[]) {
  const wanted = lowerSet(tags)
  const many = shared.filter(
    (item) => wanted.has(item.tag.toLowerCase()) && (item.locked_products ?? 0) > 1,
  )
  if (many.length === 0) return null
  return `Tags are shared: ${many
    .map((item) => `“${item.tag}” (${item.locked_products} locked products)`)
    .join(', ')}. The change applies to every product that uses them.`
}

/** Emails or ids typed into a box: split on commas, semicolons, spaces or new lines, no repeats. */
function parseRefs(text: string): string[] {
  const seen = new Set<string>()
  const refs: string[] = []
  for (const part of text.split(/[\s,;]+/)) {
    const ref = part.trim()
    if (ref && !seen.has(ref.toLowerCase())) {
      seen.add(ref.toLowerCase())
      refs.push(ref)
    }
  }
  return refs
}

const customerLabel = (customer: LockCustomer) =>
  customer.name ?? customer.email ?? 'this customer'

/**
 * The **Lock Access** tab of a product: is it locked, who can open it and with which tags — all
 * managed here, on the same access API as Lock Management (the same lock, the same customer
 * list, the same cache keys: a change on either page shows on the other). Business users can lock
 * or unlock the product, switch the lock and each of its settings on and off, add keys, add and
 * remove customers (one by one or several at once) and give or take a customer's tags.
 */
export function LockAccessPanel({ product }: { product: ProductDetail }) {
  const shop = product.shop?.key ?? ''
  const handle = product.handle
  const found = useProductLock(shop, handle)

  if (!shop || !handle) {
    return (
      <Empty
        title="Lock access is not available"
        text="This product has no store or web address yet, so it cannot be locked."
      />
    )
  }
  if (found.error) {
    return (
      <Empty
        tone="error"
        title="Couldn't load the lock of this product"
        text={found.error}
        action={
          <button
            type="button"
            onClick={found.retry}
            className={`${OUTLINE} h-9 px-3 text-[0.82rem]`}
          >
            Try again
          </button>
        }
      />
    )
  }
  if (found.isPending) return <LoadingCard />
  if (found.notLocked || !found.lock) {
    return <NotLocked shop={shop} handle={handle} title={product.title} />
  }
  return <LockedProduct lock={found.lock} shop={shop} handle={handle} />
}

/** A product with no lock: say so plainly and lock it here, with optional keys. */
function NotLocked({
  shop,
  handle,
  title,
}: {
  shop: string
  handle: string
  title: string
}) {
  const writes = useProductLockWrites(shop, handle, null)
  const [tags, setTags] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const [asking, setAsking] = useState(false)

  function addTyped() {
    const next = typed
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    if (next.length === 0) return
    const seen = lowerSet(tags)
    setTags(
      [...tags, ...next.filter((tag) => !seen.has(tag.toLowerCase()))].slice(0, MAX_KEYS),
    )
    setTyped('')
  }

  return (
    <section className={`${CARD} flex flex-col gap-5 p-5 sm:p-6`}>
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className={TILE}>
          <LockIcon width={22} height={22} />
        </span>
        <div>
          <h2 className="m-0 text-[1.05rem] font-bold">This product is not locked</h2>
          <p className="text-text-muted m-0 text-[0.85rem]">
            Everyone can see and buy it in the store. Lock it to choose which customers
            can open it.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="lock-new-keys" className="text-[0.85rem] font-semibold">
          Keys (tags) — optional
        </label>
        <p className="text-text-muted m-0 text-[0.78rem]">
          Customers with one of these tags can open the product. With none, any customer
          who is signed in can.
        </p>
        <div className="flex gap-2">
          <input
            id="lock-new-keys"
            type="text"
            value={typed}
            maxLength={255}
            placeholder="e.g. wholesale — press Enter to add"
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addTyped()
              }
            }}
            className={INPUT}
          />
          <button
            type="button"
            onClick={addTyped}
            disabled={!typed.trim() || tags.length >= MAX_KEYS}
            className={`${OUTLINE} h-10 px-3 text-[0.82rem]`}
          >
            <PlusIcon width={14} height={14} />
            Add
          </button>
        </div>
        {tags.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {tags.map((tag) => (
              <li key={tag} className={CHIP}>
                {tag}
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  onClick={() => setTags(tags.filter((item) => item !== tag))}
                  className="hover:bg-accent hover:text-accent-contrast flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current"
                >
                  <XIcon width={10} height={10} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <button type="button" className={PRIMARY} onClick={() => setAsking(true)}>
          <LockIcon width={16} height={16} />
          Lock this product
        </button>
      </div>

      {asking && (
        <AccessQuestion
          title={`Lock “${title}”?`}
          confirmLabel="Yes, lock it"
          onClose={() => setAsking(false)}
          onConfirm={async () => {
            await writes.write({ kind: 'lock', tags })
            setAsking(false)
          }}
        >
          <p className="m-0 text-[0.85rem]">
            {tags.length > 0
              ? `Only customers with ${tags.map((tag) => `“${tag}”`).join(' or ')} will be able to open it.`
              : 'Only customers who are signed in will be able to open it.'}{' '}
            These changes will also be updated in Shopify.
          </p>
        </AccessQuestion>
      )}
    </section>
  )
}

/** What the person asked to do, waiting for "Yes" in a question. */
type Asked =
  | { kind: 'switch'; name: LockSwitch; value: boolean }
  | { kind: 'untag'; customer: LockCustomer; tag: string }
  | { kind: 'remove'; customers: LockCustomer[] }
  | { kind: 'unlock' }
  | { kind: 'addKey'; tag: string }

function LockedProduct({
  lock,
  shop,
  handle,
}: {
  lock: AccessLock
  shop: string
  handle: string
}) {
  const product = lock.handle ?? lock.product_id
  const list = useProductLockCustomers(shop, product)
  const writes = useProductLockWrites(shop, handle, lock)
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [taggingFor, setTaggingFor] = useState<LockCustomer | null>(null)
  const [asked, setAsked] = useState<Asked | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useDebouncedField(list.search, list.setSearch)

  const data = list.data
  const total = data?.total ?? lock.customers_with_access ?? 0
  // Tags held by the customers on this page (the API counts customers, not their tags).
  const tagsShown = list.customers.reduce(
    (sum, customer) => sum + customer.tags.length,
    0,
  )
  const morePages = (data?.total_pages ?? 1) > 1
  const loginOnly = data?.login_only ?? lock.tags.length === 0
  const picked = list.customers.filter((customer) => selected.has(customer.id))
  const allPicked = list.customers.length > 0 && picked.length === list.customers.length

  async function run(change: LockAccessChange) {
    setNotice(await writes.write(change))
  }

  function ask(next: Asked) {
    setNotice(null)
    setAsked(next)
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <LockHeader
        lock={lock}
        busy={writes.isWriting}
        onToggle={(value) => ask({ kind: 'switch', name: 'enabled', value })}
      />

      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          icon={UsersIcon}
          value={total.toLocaleString('en-GB')}
          label="Customers with access"
          hint={loginOnly ? 'Any signed-in customer' : 'Hold one of the product’s keys'}
        />
        <Stat
          icon={TagIcon}
          value={lock.tags.length.toLocaleString('en-GB')}
          label={lock.tags.length === 1 ? 'Key (tag)' : 'Keys (tags)'}
          hint={lock.tags.length > 0 ? lock.tags.join(', ') : 'No keys: login only'}
        />
        <Stat
          icon={SlidersIcon}
          value={tagsShown.toLocaleString('en-GB')}
          label="Tags assigned"
          hint={morePages ? 'To the customers on this page' : 'To these customers in all'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsCard
          lock={lock}
          busy={writes.isWriting}
          onToggle={(name, value) => ask({ kind: 'switch', name, value })}
        />
        <KeysCard
          lock={lock}
          busy={writes.isWriting}
          onAdd={(tag) => ask({ kind: 'addKey', tag })}
        />
      </div>

      <section className={`${CARD} overflow-hidden`} aria-label="Customer Access">
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[1.05rem] font-bold">
              Customer Access{' '}
              <span className="bg-accent-tint text-accent ml-1 rounded-full px-2 py-0.5 align-middle text-[0.75rem]">
                {total.toLocaleString('en-GB')}
              </span>
            </h2>
            <p className="text-text-muted m-0 text-[0.85rem]">
              {loginOnly
                ? 'This lock has no keys: every customer with an account can open the product.'
                : 'Customers who can open this product, and the tags that give them access.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="border-border bg-surface focus-within:border-accent flex h-10 items-center gap-2 rounded-lg border px-3 sm:w-72">
              <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
              <span className="sr-only">Search customers with access</span>
              <input
                type="search"
                value={search}
                maxLength={200}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email or company…"
                className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
            {!loginOnly && (
              <button
                type="button"
                className={PRIMARY}
                onClick={() => {
                  setNotice(null)
                  setAdding(true)
                }}
              >
                <PlusIcon width={16} height={16} />
                Add customers
              </button>
            )}
          </div>
        </div>

        {picked.length > 0 && (
          <div className="border-border bg-accent-tint/40 flex flex-wrap items-center gap-3 border-t px-4 py-2.5 text-[0.82rem] sm:px-5">
            <span className="font-semibold">{picked.length} selected</span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0 font-semibold underline"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={() => ask({ kind: 'remove', customers: picked })}
              className={`${DANGER_OUTLINE} ml-auto h-8 px-3 text-[0.8rem]`}
            >
              <TrashIcon width={14} height={14} />
              Remove access ({picked.length})
            </button>
          </div>
        )}

        <div className="relative overflow-x-auto">
          <div
            aria-hidden="true"
            className={`bg-accent absolute inset-x-0 top-0 z-[1] h-0.5 transition-opacity ${
              list.isFetching && !list.isPending
                ? 'animate-pulse opacity-100'
                : 'opacity-0'
            }`}
          />
          <table className="w-full min-w-[900px] border-collapse text-[0.85rem]">
            <thead className="bg-table-head border-border-strong border-b">
              <tr>
                <th className={`${TH} w-10`}>
                  {!loginOnly && (
                    <input
                      type="checkbox"
                      aria-label="Select every customer on this page"
                      checked={allPicked}
                      disabled={list.customers.length === 0}
                      onChange={() =>
                        setSelected(
                          allPicked
                            ? new Set()
                            : new Set(list.customers.map((customer) => customer.id)),
                        )
                      }
                      className={CHECKBOX}
                    />
                  )}
                </th>
                <th className={TH} aria-sort={ariaSort(list.sort === 'name', 'asc')}>
                  <SortButton
                    label="Customer"
                    active={list.sort === 'name'}
                    order="asc"
                    onClick={() => list.setSort('name')}
                  />
                </th>
                <th className={TH} aria-sort={ariaSort(list.sort === 'email', 'asc')}>
                  <SortButton
                    label="Email"
                    active={list.sort === 'email'}
                    order="asc"
                    onClick={() => list.setSort('email')}
                  />
                </th>
                <th className={TH}>Assigned tags</th>
                <th className={`${TH} text-center`}>Tag count</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isPending ? (
                <StateRow>
                  <SpinnerIcon width={18} height={18} className="animate-spin" />
                  Loading customers…
                </StateRow>
              ) : list.error ? (
                <StateRow>
                  <span className="text-danger">{list.error}</span>
                  <button
                    type="button"
                    onClick={list.retry}
                    className={`${OUTLINE} h-8 px-3 text-[0.8rem]`}
                  >
                    Try again
                  </button>
                </StateRow>
              ) : list.customers.length === 0 ? (
                <StateRow>
                  {list.search.trim()
                    ? 'No customer with access matches your search.'
                    : 'No customer has access yet. Add some with Add customers.'}
                </StateRow>
              ) : (
                list.customers.map((customer) => {
                  const name = customer.name ?? customer.email ?? 'Unnamed customer'
                  const isPicked = selected.has(customer.id)
                  return (
                    <tr
                      key={customer.id}
                      className={`border-border border-b last:border-b-0 ${
                        isPicked ? 'bg-accent-tint/50' : 'hover:bg-accent-tint/30'
                      }`}
                    >
                      <td className={TD}>
                        {!loginOnly && (
                          <input
                            type="checkbox"
                            aria-label={`Select ${name}`}
                            checked={isPicked}
                            onChange={() => toggleOne(customer.id)}
                            className={CHECKBOX}
                          />
                        )}
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="bg-accent-tint text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold"
                          >
                            {initials(name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{name}</span>
                            {customer.company && (
                              <span className="text-text-muted block truncate text-[0.75rem]">
                                {customer.company}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className={TD}>
                        {customer.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="break-all">{customer.email}</span>
                            <CopyButton
                              value={customer.email}
                              label={`Copy email of ${name}`}
                            />
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className={TD}>
                        {customer.tags.length === 0 ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                            {customer.tags.map((tag) => (
                              <li key={tag} className={CHIP}>
                                {tag}
                                {!loginOnly && (
                                  <button
                                    type="button"
                                    aria-label={`Remove tag ${tag} from ${name}`}
                                    title="Remove this tag"
                                    onClick={() => ask({ kind: 'untag', customer, tag })}
                                    className="hover:bg-accent hover:text-accent-contrast flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current transition-colors"
                                  >
                                    <XIcon width={10} height={10} />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className={`${TD} text-center`}>
                        <span className="bg-accent-tint text-accent inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[0.78rem] font-bold">
                          {customer.tags.length}
                        </span>
                      </td>
                      <td className={TD}>
                        {!loginOnly && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className={`${OUTLINE} h-8 px-2.5 text-[0.8rem]`}
                              onClick={() => {
                                setNotice(null)
                                setTaggingFor(customer)
                              }}
                            >
                              <PlusIcon width={14} height={14} />
                              Add tag
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove access of ${name}`}
                              title="Remove access"
                              onClick={() =>
                                ask({ kind: 'remove', customers: [customer] })
                              }
                              className={`${DANGER_OUTLINE} h-8 w-8 p-0`}
                            >
                              <TrashIcon width={15} height={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <Pager
            page={data.page}
            totalPages={data.total_pages}
            total={data.total}
            shown={list.customers.length}
            onPage={(page) => {
              setSelected(new Set())
              list.setPage(page)
            }}
          />
        )}
      </section>

      <section
        className={`${CARD} border-danger/40 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5`}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-danger m-0 text-[0.95rem] font-bold">Remove the lock</h2>
          <p className="text-text-muted m-0 text-[0.82rem]">
            The product becomes visible to everyone again. Customers keep their tags.
          </p>
        </div>
        <button
          type="button"
          onClick={() => ask({ kind: 'unlock' })}
          className={`${DANGER_OUTLINE} h-10 px-4 text-[0.85rem]`}
        >
          <TrashIcon width={15} height={15} />
          Remove lock
        </button>
      </section>

      {adding && (
        <AddCustomersDialog
          lock={lock}
          shop={shop}
          sharedTags={list.tags}
          onClose={() => setAdding(false)}
          onConfirm={async (refs, tag) => {
            await run({ kind: 'give', refs, tag })
            setAdding(false)
          }}
        />
      )}
      {taggingFor && (
        <AddTagDialog
          lock={lock}
          customer={taggingFor}
          sharedTags={list.tags}
          onClose={() => setTaggingFor(null)}
          onConfirm={async (tag) => {
            await run({ kind: 'give', refs: [customerRefOf(taggingFor)], tag })
            setTaggingFor(null)
          }}
        />
      )}
      {asked && (
        <AskedQuestion
          asked={asked}
          lock={lock}
          sharedTags={list.tags}
          onClose={() => setAsked(null)}
          onConfirm={async () => {
            if (asked.kind === 'remove') {
              await run({ kind: 'remove', refs: asked.customers.map(customerRefOf) })
              setSelected(new Set())
            } else if (asked.kind === 'untag') {
              await run({ kind: 'take', customer: asked.customer, tag: asked.tag })
            } else {
              await run(asked)
            }
            setAsked(null)
          }}
        />
      )}
    </div>
  )
}

/** The "Are you sure?" for a switch, a removal, a new key or taking the lock off. */
function AskedQuestion({
  asked,
  lock,
  sharedTags,
  onClose,
  onConfirm,
}: {
  asked: Asked
  lock: AccessLock
  sharedTags: readonly LockCustomerTag[]
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const footer = 'These changes will also be updated in Shopify.'
  switch (asked.kind) {
    case 'switch': {
      const label = SETTING_LABELS[asked.name]
      const on = asked.value
      const title =
        asked.name === 'enabled'
          ? `${on ? 'Turn on' : 'Turn off'} the lock?`
          : `${on ? 'Turn on' : 'Turn off'} “${label}”?`
      return (
        <AccessQuestion
          title={title}
          confirmLabel={on ? 'Yes, turn on' : 'Yes, turn off'}
          danger={!on && asked.name === 'enabled'}
          onClose={onClose}
          onConfirm={onConfirm}
        >
          <p className="m-0 text-[0.85rem]">
            {asked.name === 'enabled'
              ? on
                ? `Only customers with access will be able to open “${lock.title}”.`
                : `Everyone will be able to see “${lock.title}”. Customers keep their tags, so turning it on again restores access as it was.`
              : `${label}: ${on ? 'Off → On' : 'On → Off'}.`}{' '}
            {footer}
          </p>
        </AccessQuestion>
      )
    }
    case 'untag': {
      const name = customerLabel(asked.customer)
      const held = lowerSet(lock.tags)
      const keysHeld = asked.customer.tags.filter((tag) => held.has(tag.toLowerCase()))
      return (
        <AccessQuestion
          title={`Remove “${asked.tag}” from ${name}?`}
          confirmLabel="Remove tag"
          danger
          onClose={onClose}
          onConfirm={onConfirm}
        >
          <p className="m-0 text-[0.85rem]">
            {keysHeld.length <= 1
              ? 'It is the only key of this product they hold, so they will no longer be able to open it.'
              : 'They keep their other keys, so they can still open the product.'}{' '}
            {footer}
          </p>
          <SharedNote note={sharedNote(sharedTags, [asked.tag])} />
        </AccessQuestion>
      )
    }
    case 'remove': {
      const one = asked.customers.length === 1 ? asked.customers[0] : null
      const tags = [...new Set(asked.customers.flatMap((customer) => customer.tags))]
      return (
        <AccessQuestion
          title={
            one
              ? `Remove access of ${customerLabel(one)}?`
              : `Remove access of ${asked.customers.length} customers?`
          }
          confirmLabel="Remove access"
          danger
          onClose={onClose}
          onConfirm={onConfirm}
        >
          <p className="m-0 text-[0.85rem]">
            {one ? (one.email ?? 'They') : 'They'} will no longer be able to open “
            {lock.title}”. {footer}
          </p>
          {!one && (
            <p className="text-text-muted mt-2 mb-0 text-[0.8rem] break-words">
              {asked.customers.map(customerLabel).join(', ')}
            </p>
          )}
          <SharedNote note={sharedNote(sharedTags, tags)} />
        </AccessQuestion>
      )
    }
    case 'addKey':
      return (
        <AccessQuestion
          title={`Add the key “${asked.tag}”?`}
          confirmLabel="Add key"
          onClose={onClose}
          onConfirm={onConfirm}
        >
          <p className="m-0 text-[0.85rem]">
            Customers with the tag “{asked.tag}” will be able to open “{lock.title}”.{' '}
            {footer}
          </p>
        </AccessQuestion>
      )
    case 'unlock':
      return (
        <AccessQuestion
          title={`Remove the lock of “${lock.title}”?`}
          confirmLabel="Remove lock"
          danger
          onClose={onClose}
          onConfirm={onConfirm}
        >
          <p className="m-0 text-[0.85rem]">
            The product will be visible to everyone. Customers keep their tags, and the
            product can be locked again later. {footer}
          </p>
        </AccessQuestion>
      )
  }
}

/** "Lock Access" title card: the lock's on/off switch, its Shopify state and its last change. */
function LockHeader({
  lock,
  busy,
  onToggle,
}: {
  lock: AccessLock
  busy: boolean
  onToggle: (value: boolean) => void
}) {
  const state = lock.sync_status ?? 'pending'
  const tone =
    state === 'synced'
      ? 'bg-accent-tint text-accent'
      : state === 'error'
        ? 'bg-danger-bg text-danger'
        : 'bg-warning-bg text-warning'
  const label =
    state === 'synced'
      ? 'Synced with Shopify'
      : state === 'error'
        ? 'Needs attention'
        : 'Sending to Shopify…'
  return (
    <section
      className={`${CARD} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5`}
    >
      <span aria-hidden="true" className={TILE}>
        <LockIcon width={22} height={22} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-[1.05rem] font-bold">Lock Access</h2>
          <span
            title={lock.sync_error ?? undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[0.75rem] font-semibold ${tone}`}
          >
            {state === 'synced' ? (
              <CheckCircleIcon width={14} height={14} />
            ) : state === 'error' ? (
              <AlertTriangleIcon width={14} height={14} />
            ) : (
              <ClockIcon width={14} height={14} />
            )}
            {label}
          </span>
        </div>
        <p className="text-text-muted m-0 text-[0.85rem]">
          {lock.enabled
            ? 'The lock is on: only customers with access can open this product.'
            : 'The lock is off: everyone can see this product.'}
          {lock.updated_at && ` Last updated ${formatDateTimeAmPm(lock.updated_at)}.`}
        </p>
      </div>
      <ToggleSwitch
        label="Lock"
        checked={lock.enabled}
        disabled={busy}
        onChange={onToggle}
        large
      />
    </section>
  )
}

/** The lock's other settings as switches, each in plain words. */
function SettingsCard({
  lock,
  busy,
  onToggle,
}: {
  lock: AccessLock
  busy: boolean
  onToggle: (name: Exclude<LockSwitch, 'enabled'>, value: boolean) => void
}) {
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="Lock settings">
      <h2 className="m-0 flex items-center gap-2 text-[0.95rem] font-bold">
        <EyeOffIcon width={17} height={17} className="text-accent" />
        Visibility settings
      </h2>
      <p className="text-text-muted mt-0.5 mb-2 text-[0.8rem]">
        How the product shows to customers without access.
      </p>
      <ul className="m-0 list-none p-0">
        {SETTINGS.map((setting) => (
          <li
            key={setting.name}
            className="border-border flex items-center gap-3 border-t py-2.5 first:border-t-0"
          >
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[0.85rem] font-semibold">{setting.label}</p>
              <p className="text-text-muted m-0 text-[0.75rem]">{setting.hint}</p>
            </div>
            <ToggleSwitch
              label={setting.label}
              checked={lock[setting.name]}
              disabled={busy}
              onChange={(value) => onToggle(setting.name, value)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The product's keys (tags), and a box to add one. */
function KeysCard({
  lock,
  busy,
  onAdd,
}: {
  lock: AccessLock
  busy: boolean
  onAdd: (tag: string) => void
}) {
  const [typed, setTyped] = useState('')
  const clean = typed.trim()
  const exists = lowerSet(lock.tags).has(clean.toLowerCase())
  const full = lock.tags.length >= MAX_KEYS

  function submit() {
    if (!clean || exists || full) return
    onAdd(clean)
    setTyped('')
  }

  return (
    <section className={`${CARD} flex flex-col p-4 sm:p-5`} aria-label="Keys">
      <h2 className="m-0 flex items-center gap-2 text-[0.95rem] font-bold">
        <TagIcon width={17} height={17} className="text-accent" />
        Keys (tags)
      </h2>
      <p className="text-text-muted mt-0.5 mb-3 text-[0.8rem]">
        A customer with any of these tags can open the product.
      </p>
      {lock.tags.length === 0 ? (
        <p className="text-text-muted m-0 text-[0.85rem]">
          No keys: any customer who is signed in can open it.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {lock.tags.map((tag) => (
            <li key={tag} className={`${CHIP} pr-2.5`}>
              {tag}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex gap-2 pt-4">
        <label className="sr-only" htmlFor="lock-add-key">
          New key
        </label>
        <input
          id="lock-add-key"
          type="text"
          value={typed}
          maxLength={255}
          disabled={busy || full}
          placeholder={full ? `At most ${MAX_KEYS} keys` : 'New key, e.g. wholesale'}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          className={INPUT}
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !clean || exists || full}
          className={`${OUTLINE} h-10 px-3 text-[0.82rem]`}
        >
          <PlusIcon width={14} height={14} />
          Add key
        </button>
      </div>
      {exists && (
        <p className="text-text-muted mt-1.5 mb-0 text-[0.75rem]">
          The product already has this key.
        </p>
      )}
    </section>
  )
}

/** An on/off switch in the accent colour, named for screen readers. */
function ToggleSwitch({
  label,
  checked,
  disabled,
  onChange,
  large = false,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
  large?: boolean
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={`text-[0.78rem] font-semibold ${checked ? 'text-accent' : 'text-text-muted'}`}
      >
        {checked ? 'On' : 'Off'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`focus-visible:outline-accent relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-none p-0 transition-colors focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50 ${
          large ? 'h-7 w-12' : 'h-5 w-9'
        } ${checked ? 'bg-accent' : 'bg-border-strong'}`}
      >
        <span
          aria-hidden="true"
          className={`bg-bg absolute top-0.5 left-0.5 rounded-full shadow-sm transition-transform ${
            large ? 'h-6 w-6' : 'h-4 w-4'
          } ${checked ? (large ? 'translate-x-5' : 'translate-x-4') : ''}`}
        />
      </button>
    </span>
  )
}

function Stat({
  icon: Icon,
  value,
  label,
  hint,
}: {
  icon: ComponentType<IconProps>
  value: string
  label: string
  hint?: string
}) {
  return (
    <div className={`${CARD} flex items-center gap-4 p-4 sm:p-5`}>
      <span aria-hidden="true" className={TILE}>
        <Icon width={22} height={22} />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[1.5rem] leading-tight font-bold">{value}</p>
        <p className="m-0 text-[0.85rem] font-semibold">{label}</p>
        {hint && (
          <p className="text-text-muted m-0 truncate text-[0.75rem]" title={hint}>
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}

function StateRow({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={6} className="text-text-muted px-4 py-10 text-center">
        <span className="inline-flex flex-wrap items-center justify-center gap-2">
          {children}
        </span>
      </td>
    </tr>
  )
}

function Pager({
  page,
  totalPages,
  total,
  shown,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  shown: number
  onPage: (page: number) => void
}) {
  const first = (page - 1) * LOCK_ACCESS_PAGE_SIZE + 1
  const last = first + shown - 1
  const step = `${OUTLINE} h-8 w-8 p-0`
  return (
    <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-3 text-[0.82rem] sm:px-5">
      <span className="text-text-muted">
        Showing {first.toLocaleString('en-GB')}–{last.toLocaleString('en-GB')} of{' '}
        {total.toLocaleString('en-GB')} customer{total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={step}
        >
          <ChevronRightIcon width={14} height={14} className="rotate-180" />
        </button>
        <span
          aria-current="page"
          className="border-accent text-accent flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 font-semibold"
        >
          {page}
        </span>
        <span className="text-text-muted">of {totalPages}</span>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className={step}
        >
          <ChevronRightIcon width={14} height={14} />
        </button>
      </div>
    </div>
  )
}

function Empty({
  title,
  text,
  action,
  tone = 'info',
}: {
  title: string
  text: string
  action?: ReactNode
  tone?: 'info' | 'error'
}) {
  return (
    <section
      className={`${CARD} flex flex-col items-center gap-3 px-4 py-14 text-center`}
    >
      <span
        aria-hidden="true"
        className={tone === 'error' ? `${TILE} bg-danger-bg text-danger` : TILE}
      >
        {tone === 'error' ? (
          <AlertTriangleIcon width={22} height={22} />
        ) : (
          <LockIcon width={22} height={22} />
        )}
      </span>
      <div>
        <p className="m-0 font-semibold">{title}</p>
        <p className="text-text-muted m-0 max-w-md text-[0.85rem]">{text}</p>
      </div>
      {action}
    </section>
  )
}

function LoadingCard() {
  return (
    <section
      className={`${CARD} text-text-muted flex items-center justify-center gap-2 py-14`}
    >
      <SpinnerIcon width={18} height={18} className="animate-spin" />
      Loading lock access…
    </section>
  )
}

function SharedNote({ note }: { note: string | null }) {
  if (!note) return null
  return (
    <p role="note" className={NOTE}>
      {note}
    </p>
  )
}

/**
 * "Are you sure?" before an access change (it is also pushed to the store). Cancel is focused;
 * nothing is sent until the confirm button, and a refusal shows the backend's message inside.
 */
function AccessQuestion({
  title,
  confirmLabel,
  danger = false,
  disabled = false,
  wide = false,
  onConfirm,
  onClose,
  children,
}: {
  title: string
  confirmLabel: string
  danger?: boolean
  disabled?: boolean
  wide?: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const button =
    'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (caught) {
      setError(toUserMessage(caught))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={title}
      onClose={onClose}
      closeDisabled={busy}
      wide={wide}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            disabled={busy}
            onClick={onClose}
            className={`${button} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => void confirm()}
            className={`${button} border-transparent text-white hover:opacity-90 ${danger ? 'bg-danger' : 'bg-accent'}`}
          >
            {busy && <SpinnerIcon width={16} height={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}

/**
 * Choose one tag: a key of the product (as pills) or a new one typed in. A new tag also becomes a
 * key of this product, since a customer's tag only opens the product when the product has it too.
 */
function TagChoice({
  keys,
  value,
  onChange,
}: {
  keys: readonly string[]
  value: string
  onChange: (tag: string) => void
}) {
  const [typed, setTyped] = useState('')
  const fromKeys = lowerSet(keys).has(value.toLowerCase())
  return (
    <div className="mt-4 flex flex-col gap-3">
      {keys.length > 0 && (
        <fieldset className="m-0 border-none p-0">
          <legend className="mb-2 text-[0.85rem] font-semibold">Tag to give</legend>
          <div className="flex flex-wrap gap-2">
            {keys.map((key) => {
              const on = value.toLowerCase() === key.toLowerCase()
              return (
                <label
                  key={key}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[0.8rem] font-semibold transition-colors ${
                    on
                      ? 'border-accent bg-accent-tint text-accent'
                      : 'border-border bg-bg text-text-muted hover:border-accent'
                  }`}
                >
                  <input
                    type="radio"
                    name="lock-access-tag"
                    checked={on}
                    onChange={() => {
                      setTyped('')
                      onChange(key)
                    }}
                    className="accent-accent m-0 h-3.5 w-3.5"
                  />
                  {key}
                </label>
              )
            })}
          </div>
        </fieldset>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-text-muted text-[0.78rem] font-semibold">
          {keys.length > 0 ? 'Or a new tag' : 'Tag to give'}
        </span>
        <input
          type="text"
          value={typed}
          maxLength={255}
          placeholder="e.g. wholesale"
          onChange={(event) => {
            setTyped(event.target.value)
            onChange(event.target.value)
          }}
          className={INPUT}
        />
      </label>
      {value.trim() && !fromKeys && (
        <p className="text-text-muted m-0 text-[0.78rem]">
          “{value.trim()}” is new: it will also be added to this product as a key.
        </p>
      )}
    </div>
  )
}

function AddTagDialog({
  lock,
  customer,
  sharedTags,
  onClose,
  onConfirm,
}: {
  lock: AccessLock
  customer: LockCustomer
  sharedTags: readonly LockCustomerTag[]
  onClose: () => void
  onConfirm: (tag: string) => Promise<void>
}) {
  const held = lowerSet(customer.tags)
  const keys = lock.tags.filter((tag) => !held.has(tag.toLowerCase()))
  const [tag, setTag] = useState(keys[0] ?? '')
  const clean = tag.trim()
  const alreadyHeld = held.has(clean.toLowerCase())
  const name = customerLabel(customer)
  return (
    <AccessQuestion
      title={`Add a tag to ${name}`}
      confirmLabel="Add tag"
      disabled={!clean || alreadyHeld}
      onClose={onClose}
      onConfirm={() => onConfirm(clean)}
    >
      <p className="m-0 text-[0.85rem]">
        <span className="text-text-muted">Customer: </span>
        <strong>{customer.email ?? customer.id}</strong>
        {customer.tags.length > 0 && (
          <span className="text-text-muted"> · holds {customer.tags.join(', ')}</span>
        )}
      </p>
      <TagChoice keys={keys} value={tag} onChange={setTag} />
      {alreadyHeld && (
        <p className="text-danger mt-2 mb-0 text-[0.8rem]">
          {name} already has this tag.
        </p>
      )}
      <SharedNote note={sharedNote(sharedTags, clean ? [clean] : [])} />
      <p className="text-text-muted mt-3 mb-0 text-[0.8rem]">
        These changes will also be updated in Shopify.
      </p>
    </AccessQuestion>
  )
}

/** A store customer in the search: does one of their tags already open the product? */
function holdsKey(customer: CustomerListItem, keys: Set<string>) {
  return (customer.tags ?? []).some((tag) => keys.has(String(tag).trim().toLowerCase()))
}

/**
 * Add customers: search the store's customers and tick them (they stay ticked through searches),
 * or paste emails; then choose the tag they get. A customer who already holds a key is shown as
 * "Has access" and can't be ticked.
 */
function AddCustomersDialog({
  lock,
  shop,
  sharedTags,
  onClose,
  onConfirm,
}: {
  lock: AccessLock
  shop: string
  sharedTags: readonly LockCustomerTag[]
  onClose: () => void
  onConfirm: (refs: string[], tag: string) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const store = usePickStoreCustomers(shop, search, page)
  const [chosen, setChosen] = useState<{ ref: string; label: string }[]>([])
  const [pasted, setPasted] = useState('')
  const [tag, setTag] = useState(lock.tags[0] ?? '')
  const keys = lowerSet(lock.tags)
  const chosenRefs = lowerSet(chosen.map((item) => item.ref))
  const refs = [
    ...chosen.map((item) => item.ref),
    ...parseRefs(pasted).filter((ref) => !chosenRefs.has(ref.toLowerCase())),
  ]
  const tooMany = refs.length > MAX_CUSTOMERS
  const clean = tag.trim()

  function toggle(customer: CustomerListItem) {
    const ref = customer.email ?? customer.id
    setChosen(
      chosenRefs.has(ref.toLowerCase())
        ? chosen.filter((item) => item.ref.toLowerCase() !== ref.toLowerCase())
        : [...chosen, { ref, label: customer.full_name?.trim() || ref }],
    )
  }

  return (
    <AccessQuestion
      title={`Add customers to “${lock.title}”`}
      confirmLabel={refs.length > 0 ? `Give access (${refs.length})` : 'Give access'}
      disabled={refs.length === 0 || tooMany || !clean}
      wide
      onClose={onClose}
      onConfirm={() => onConfirm(refs, clean)}
    >
      <label className="border-border bg-surface focus-within:border-accent flex h-10 items-center gap-2 rounded-lg border px-3">
        <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
        <span className="sr-only">Search the store’s customers</span>
        <input
          type="search"
          value={search}
          maxLength={200}
          autoFocus
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Search the store’s customers by name, email or company…"
          className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none"
        />
        {store.isFetching && (
          <SpinnerIcon width={14} height={14} className="text-text-muted animate-spin" />
        )}
      </label>

      {search.trim() && (
        <div className="border-border mt-2 max-h-60 overflow-y-auto rounded-lg border">
          {store.error ? (
            <p className="text-danger m-0 px-3 py-3 text-[0.82rem]">{store.error}</p>
          ) : store.items.length === 0 ? (
            <p className="text-text-muted m-0 px-3 py-3 text-[0.82rem]">
              {store.isFetching ? 'Searching…' : 'No customer matches.'}
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {store.items.map((customer) => {
                const ref = customer.email ?? customer.id
                const has = keys.size > 0 && holdsKey(customer, keys)
                const on = chosenRefs.has(ref.toLowerCase())
                const name =
                  customer.full_name?.trim() || customer.email || 'Unnamed customer'
                return (
                  <li
                    key={customer.id}
                    className="border-border border-b last:border-b-0"
                  >
                    <label
                      className={`flex items-center gap-3 px-3 py-2 ${
                        has ? 'opacity-60' : 'hover:bg-accent-tint/40 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on || has}
                        disabled={has}
                        onChange={() => toggle(customer)}
                        className={CHECKBOX}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.85rem] font-semibold">
                          {name}
                        </span>
                        {customer.email && (
                          <span className="text-text-muted block truncate text-[0.75rem]">
                            {customer.email}
                          </span>
                        )}
                      </span>
                      {has && (
                        <span className="bg-accent-tint text-accent rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
                          Has access
                        </span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          {store.totalPages > 1 && (
            <div className="border-border flex items-center justify-between border-t px-3 py-2 text-[0.78rem]">
              <span className="text-text-muted">
                {store.total.toLocaleString('en-GB')} found
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className={`${OUTLINE} h-7 px-2 text-[0.75rem]`}
                >
                  Previous
                </button>
                <span>
                  {page} / {store.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= store.totalPages}
                  onClick={() => setPage(page + 1)}
                  className={`${OUTLINE} h-7 px-2 text-[0.75rem]`}
                >
                  Next
                </button>
              </span>
            </div>
          )}
        </div>
      )}

      {chosen.length > 0 && (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0" aria-label="Chosen">
          {chosen.map((item) => (
            <li key={item.ref} className={CHIP} title={item.ref}>
              {item.label}
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={() =>
                  setChosen(chosen.filter((other) => other.ref !== item.ref))
                }
                className="hover:bg-accent hover:text-accent-contrast flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current"
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-3">
        <summary className="text-accent cursor-pointer text-[0.82rem] font-semibold">
          Or paste emails
        </summary>
        <textarea
          rows={3}
          value={pasted}
          aria-label="Emails or customer ids"
          onChange={(event) => setPasted(event.target.value)}
          placeholder="john.doe@example.com, sarah@example.com"
          className="border-border bg-surface text-text focus:border-accent mt-2 w-full resize-y rounded-lg border px-3 py-2 text-[0.85rem] outline-none"
        />
      </details>

      {tooMany && (
        <p className="text-danger mt-2 mb-0 text-[0.8rem]">
          Up to {MAX_CUSTOMERS} customers can be added at a time.
        </p>
      )}
      <TagChoice keys={lock.tags} value={tag} onChange={setTag} />
      <SharedNote note={sharedNote(sharedTags, clean ? [clean] : [])} />
      <p className="text-text-muted mt-3 mb-0 text-[0.8rem]">
        These changes will also be updated in Shopify.
      </p>
    </AccessQuestion>
  )
}
