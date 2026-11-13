import { useState, type ComponentType, type ReactNode } from 'react'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  BulletListIcon,
  CheckCircleIcon,
  ClockIcon,
  CodeIcon,
  EyeIcon,
  GlobeIcon,
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
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { PillSelect, type PillOption } from '../../../components/ui/PillSelect.tsx'
import { ariaSort, SortButton } from '../../../components/ui/SortButton.tsx'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import type {
  AccessLock,
  LockCustomer,
  LockCustomerTag,
  ProductDetail,
} from '../../../lib/api/endpoints.ts'
import { formatDateTimeAmPm, initials } from '../../../lib/format.ts'
import {
  customerRefOf,
  type LockAccessChange,
  type LockSwitch,
  useProductLock,
  useProductLockCustomers,
  useProductLockWrites,
} from '../hooks/useProductLockAccess.ts'
import { LockCustomerSearch, type ChosenCustomer } from './LockCustomerSearch.tsx'
import { LockKeysCard } from './LockKeysCard.tsx'
import {
  CARD,
  CHECKBOX,
  CHIP,
  COUNT_BADGE,
  DANGER_OUTLINE,
  lowerSet,
  MAX_KEYS,
  OUTLINE,
  PRIMARY,
  STAT_TONES,
  TILE,
} from './lockAccessStyles.ts'

const TH = 'px-3 py-2 text-left text-[0.68rem] font-bold tracking-wide uppercase'
const TD = 'px-3 py-2 align-middle'
const NOTE = 'bg-warning-bg text-warning mt-3 rounded-lg px-3 py-2 text-[0.82rem]'
const INPUT =
  'border-border bg-surface text-text focus:border-accent h-9 w-full rounded-lg border px-3 text-[0.83rem] outline-none'

interface SettingDef {
  name: Exclude<LockSwitch, 'enabled'>
  label: string
  hint: string
  icon: ComponentType<IconProps>
  /** An "expert" setting that changes how the lock works: shown in amber while on. */
  caution?: boolean
}

/** The lock's settings, in plain words, grouped as the Visibility settings card shows them. */
const SETTING_GROUPS: { title: string; items: SettingDef[] }[] = [
  {
    title: 'Hide from customers without access',
    items: [
      {
        name: 'hide_from_nav',
        label: 'Hide from navigation menus',
        hint: 'They don’t see it in the store’s menus.',
        icon: EyeIcon,
      },
      {
        name: 'hide_from_lists',
        label: 'Hide from lists',
        hint: 'Left out of collections, search results and related products.',
        icon: BulletListIcon,
      },
    ],
  },
  {
    title: 'Search engines',
    items: [
      {
        name: 'hide_from_sitemap',
        label: 'Hide from sitemaps',
        hint: 'Left out of the sitemap search engines read.',
        icon: GlobeIcon,
      },
      {
        name: 'noindex',
        label: 'Tell search engines not to index',
        hint: 'The page asks Google and others not to show it in results.',
        icon: SearchIcon,
      },
    ],
  },
  {
    title: 'Advanced',
    items: [
      {
        name: 'manual_locking',
        label: 'Manual locking',
        hint: 'The website shows it to everyone and leaves the lock to custom theme code. Keep off unless a theme developer asks.',
        icon: CodeIcon,
        caution: true,
      },
    ],
  },
]

const SETTINGS: SettingDef[] = SETTING_GROUPS.flatMap((group) => group.items)

const SETTING_LABELS: Record<LockSwitch, string> = {
  enabled: 'Lock',
  ...Object.fromEntries(SETTINGS.map((item) => [item.name, item.label])),
} as Record<LockSwitch, string>

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
  | { kind: 'addKeys'; tags: string[] }
  | { kind: 'removeKey'; tag: string }

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
  // The customers picked in the search box, waiting for "Yes" (and the box is emptied after it).
  const [giving, setGiving] = useState<ChosenCustomer[] | null>(null)
  const [pickerKey, setPickerKey] = useState(0)
  const [taggingFor, setTaggingFor] = useState<LockCustomer | null>(null)
  const [asked, setAsked] = useState<Asked | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

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
    <div className="flex flex-col gap-3">
      <LockHeader
        lock={lock}
        busy={writes.isWriting}
        onToggle={(value) => ask({ kind: 'switch', name: 'enabled', value })}
      />

      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          tone="green"
          icon={UsersIcon}
          value={total.toLocaleString('en-GB')}
          label="Customers with access"
          hint={loginOnly ? 'Any signed-in customer' : 'Hold one of the product’s keys'}
        />
        <Stat
          tone="blue"
          icon={TagIcon}
          value={lock.tags.length.toLocaleString('en-GB')}
          label={lock.tags.length === 1 ? 'Key (tag)' : 'Keys (tags)'}
          hint={lock.tags.length > 0 ? lock.tags.join(', ') : 'No keys: login only'}
        />
        <Stat
          tone="violet"
          icon={SlidersIcon}
          value={tagsShown.toLocaleString('en-GB')}
          label="Tags assigned"
          hint={morePages ? 'To the customers on this page' : 'To these customers in all'}
        />
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <LockKeysCard
            lock={lock}
            shop={shop}
            busy={writes.isWriting}
            onAdd={(tags) => ask({ kind: 'addKeys', tags })}
            onRemove={(tag) => ask({ kind: 'removeKey', tag })}
          />

          <section className={CARD} aria-label="Customer Access">
            <div className="flex items-center gap-3 p-3 sm:p-4">
              <span aria-hidden="true" className={TILE}>
                <UsersIcon width={17} height={17} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-[0.92rem] font-bold">Customer Access</h2>
                <p className="text-text-muted m-0 truncate text-[0.76rem]">
                  {loginOnly
                    ? 'This lock has no keys: every customer with an account can open the product.'
                    : 'Customers who can open this product, and the tags that give them access.'}
                </p>
              </div>
              <span className={COUNT_BADGE}>{total.toLocaleString('en-GB')}</span>
            </div>

            {!loginOnly && (
              <div className="px-3 pb-3 sm:px-4">
                <LockCustomerSearch
                  key={pickerKey}
                  lock={lock}
                  shop={shop}
                  busy={writes.isWriting}
                  onAdd={(customers) => {
                    setNotice(null)
                    setGiving(customers)
                  }}
                />
              </div>
            )}

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

            <div className="relative max-h-[22rem] overflow-auto">
              <div
                aria-hidden="true"
                className={`bg-accent absolute inset-x-0 top-0 z-[1] h-0.5 transition-opacity ${
                  list.isFetching && !list.isPending
                    ? 'animate-pulse opacity-100'
                    : 'opacity-0'
                }`}
              />
              <table className="w-full min-w-[760px] border-collapse text-[0.82rem]">
                <thead className="bg-table-head border-border-strong sticky top-0 z-[2] border-b">
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
                      No customer has access yet. Search above to add some.
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
                                className="bg-accent-tint text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.72rem] font-bold"
                              >
                                {initials(name)}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-semibold">
                                  {name}
                                </span>
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
                                        onClick={() =>
                                          ask({ kind: 'untag', customer, tag })
                                        }
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
              <PaginationFooter
                page={data.page}
                pageSize={list.pageSize}
                total={data.total}
                totalPages={data.total_pages}
                onPageChange={(page) => {
                  setSelected(new Set())
                  list.setPage(page)
                }}
                onPageSizeChange={(size) => {
                  setSelected(new Set())
                  list.setPageSize(size)
                }}
              />
            )}
          </section>
        </div>

        <SettingsCard
          lock={lock}
          busy={writes.isWriting}
          onToggle={(name, value) => ask({ kind: 'switch', name, value })}
        />
      </div>

      <section
        className={`${CARD} border-danger/40 bg-danger-bg/40 flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:px-4`}
      >
        <span
          aria-hidden="true"
          className="bg-danger-bg text-danger border-danger/20 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:flex"
        >
          <TrashIcon width={17} height={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-danger m-0 text-[0.88rem] font-bold">Remove the lock</h2>
          <p className="text-text-muted m-0 text-[0.76rem]">
            The product becomes visible to everyone again. Customers keep their tags.
          </p>
        </div>
        <button
          type="button"
          onClick={() => ask({ kind: 'unlock' })}
          className={`${DANGER_OUTLINE} bg-bg h-9 px-3.5 text-[0.82rem]`}
        >
          <TrashIcon width={15} height={15} />
          Remove lock
        </button>
      </section>

      {giving && (
        <GiveAccessDialog
          lock={lock}
          customers={giving}
          sharedTags={list.tags}
          onClose={() => setGiving(null)}
          onConfirm={async (tag) => {
            await run({ kind: 'give', refs: giving.map((item) => item.ref), tag })
            setGiving(null)
            // Empties the search box and its chosen customers.
            setPickerKey((key) => key + 1)
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
    case 'addKeys': {
      const quoted = asked.tags.map((tag) => `“${tag}”`).join(', ')
      return (
        <AccessQuestion
          title={
            asked.tags.length === 1
              ? `Add the key ${quoted}?`
              : `Add ${asked.tags.length} keys?`
          }
          confirmLabel={asked.tags.length === 1 ? 'Add key' : 'Add keys'}
          onClose={onClose}
          onConfirm={onConfirm}
        >
          <p className="m-0 text-[0.85rem]">
            Customers with {asked.tags.length === 1 ? 'the tag' : 'one of the tags'}{' '}
            {quoted} will be able to open “{lock.title}”. {footer}
          </p>
          <SharedNote note={sharedNote(sharedTags, asked.tags)} />
        </AccessQuestion>
      )
    }
    case 'removeKey': {
      const last = lock.tags.length <= 1
      return (
        <AccessQuestion
          title={`Remove the key “${asked.tag}”?`}
          confirmLabel="Remove key"
          danger
          onClose={onClose}
          onConfirm={onConfirm}
        >
          <p className="m-0 text-[0.85rem]">
            {last
              ? 'It is the only key of this product, so it becomes login-only: any customer who is signed in will be able to open it.'
              : 'Customers who only have this tag will no longer be able to open the product.'}{' '}
            {footer}
          </p>
          <SharedNote note={sharedNote(sharedTags, [asked.tag])} />
        </AccessQuestion>
      )
    }
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

const LOCK_STATUS: PillOption[] = [
  { value: 'on', label: 'Enabled', tone: 'success' },
  { value: 'off', label: 'Disabled', tone: 'neutral' },
]

/**
 * "Lock Access" bar: a slim row with a small Enabled / Disabled dropdown (picking the other one
 * asks first), the lock's Shopify state and its last change.
 */
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
    <section className={`${CARD} flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2`}>
      <LockIcon width={18} height={18} className="text-accent shrink-0" />
      <h2 className="m-0 text-[0.95rem] font-bold">Lock Access</h2>
      <PillSelect
        label={`Lock status: ${lock.enabled ? 'Enabled' : 'Disabled'}`}
        menuLabel="Lock status"
        options={LOCK_STATUS}
        widthClass="w-28"
        value={lock.enabled ? 'on' : 'off'}
        saving={busy}
        onChange={(next) => onToggle(next === 'on')}
      />
      <span
        title={lock.sync_error ?? undefined}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.7rem] font-semibold ${tone}`}
      >
        {state === 'synced' ? (
          <CheckCircleIcon width={12} height={12} />
        ) : state === 'error' ? (
          <AlertTriangleIcon width={12} height={12} />
        ) : (
          <ClockIcon width={12} height={12} />
        )}
        {label}
      </span>
      <p className="text-text-muted m-0 ml-auto text-[0.74rem]">
        {lock.enabled
          ? 'Only customers with access can open this product.'
          : 'Everyone can see this product.'}
        {lock.updated_at && ` Updated ${formatDateTimeAmPm(lock.updated_at)}.`}
      </p>
    </section>
  )
}

/** The lock's other settings as switches, grouped by what they do. */
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
    <section
      className={`${CARD} flex flex-col gap-3 p-3 sm:p-4`}
      aria-label="Lock settings"
    >
      <h2 className="m-0 flex items-center gap-2.5 text-[0.95rem] font-bold">
        <EyeIcon width={19} height={19} className="text-accent" />
        Visibility Settings
      </h2>

      {SETTING_GROUPS.map((group) => (
        <div
          key={group.title}
          role="group"
          aria-label={group.title}
          className="flex flex-col gap-2"
        >
          <p className="text-accent m-0 flex items-center gap-3 text-[0.7rem] font-bold tracking-wide uppercase">
            {group.title}
            <span aria-hidden="true" className="bg-accent/25 h-px flex-1" />
          </p>
          {group.items.map((setting) => {
            const checked = lock[setting.name]
            const Icon = setting.icon
            const warn = setting.caution === true && checked
            return (
              <div
                key={setting.name}
                title={setting.hint}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                  warn
                    ? 'border-warning/50 bg-warning-bg'
                    : checked
                      ? 'border-accent/50 bg-accent-tint/50'
                      : 'border-border bg-surface'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    warn ? 'bg-warning-bg text-warning' : 'bg-accent-tint text-accent'
                  }`}
                >
                  <Icon width={18} height={18} />
                </span>
                <p className="m-0 min-w-0 flex-1 text-[0.88rem] leading-snug font-semibold">
                  {setting.label}
                </p>
                <ToggleSwitch
                  label={setting.label}
                  checked={checked}
                  disabled={busy}
                  onChange={(value) => onToggle(setting.name, value)}
                />
              </div>
            )
          })}
        </div>
      ))}

      {lock.manual_locking && (
        <p role="note" className={`${NOTE} mt-0 flex items-start gap-2 text-[0.78rem]`}>
          <AlertTriangleIcon width={14} height={14} className="mt-0.5 shrink-0" />
          Manual locking is on, so the website shows this product to everyone. Switch it
          off to enforce the lock.
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
  tone,
}: {
  icon: ComponentType<IconProps>
  value: string
  label: string
  hint?: string
  tone: keyof typeof STAT_TONES
}) {
  const colours = STAT_TONES[tone]
  return (
    <div
      className={`${CARD} flex items-center gap-3 bg-linear-to-br p-3 ${colours.card}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colours.tile}`}
      >
        <Icon width={20} height={20} />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[1.35rem] leading-tight font-bold">{value}</p>
        <p className="m-0 text-[0.82rem] leading-snug font-semibold">{label}</p>
        {hint && (
          <p className="text-text-muted m-0 truncate text-[0.72rem]" title={hint}>
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

/**
 * "Give access": the question after Add customer. It names the customers picked in the search box;
 * when the product has several keys it asks which tag they get (or a new one, which also becomes a
 * key of the product), and with one key it just says which one. Nothing is sent before the button.
 */
function GiveAccessDialog({
  lock,
  customers,
  sharedTags,
  onClose,
  onConfirm,
}: {
  lock: AccessLock
  customers: ChosenCustomer[]
  sharedTags: readonly LockCustomerTag[]
  onClose: () => void
  onConfirm: (tag: string) => Promise<void>
}) {
  const [tag, setTag] = useState(lock.tags[0] ?? '')
  const several = lock.tags.length > 1
  const clean = (several ? tag : (lock.tags[0] ?? tag)).trim()
  const many = customers.length > 1
  return (
    <AccessQuestion
      title={many ? `Give access to ${customers.length} customers?` : 'Give access?'}
      confirmLabel={many ? `Give access (${customers.length})` : 'Give access'}
      disabled={!clean}
      onClose={onClose}
      onConfirm={() => onConfirm(clean)}
    >
      <ul
        aria-label="Customers getting access"
        className="m-0 flex max-h-32 list-none flex-wrap gap-1.5 overflow-auto p-0"
      >
        {customers.map((item) => (
          <li key={item.ref} className={CHIP} title={item.ref}>
            {item.label}
          </li>
        ))}
      </ul>
      {several ? (
        <TagChoice keys={lock.tags} value={tag} onChange={setTag} />
      ) : (
        <p className="mt-3 mb-0 text-[0.85rem]">
          They will get the key <strong>“{lock.tags[0]}”</strong> and be able to open “
          {lock.title}”.
        </p>
      )}
      <SharedNote note={sharedNote(sharedTags, clean ? [clean] : [])} />
      <p className="text-text-muted mt-3 mb-0 text-[0.8rem]">
        These changes will also be updated in Shopify.
      </p>
    </AccessQuestion>
  )
}
