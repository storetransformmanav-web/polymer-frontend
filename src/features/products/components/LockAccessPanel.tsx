import { ExpandableChips } from '../../../components/ui/ExpandableChips.tsx'
import {
  ROW_ACTION_DANGER,
  ROW_ACTIONS,
  ROW_ACTION_ICON,
} from '../../../components/ui/rowActions.ts'
import { findOwnTag, withoutOwnTag } from '../../../lib/lockOwnTag.ts'
import { useId, useState, type ComponentType, type ReactNode } from 'react'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  InfoIcon,
  type IconProps,
  LayersIcon,
  ListChecksIcon,
  LockIcon,
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
import { LockKeysSearch } from './LockKeysSearch.tsx'
import { LockCustomerSearch, type ChosenCustomer } from './LockCustomerSearch.tsx'
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
  /** What it does — shown when the ⓘ is hovered (the same words as the Add lock form's). */
  hint: ReactNode
  icon: ComponentType<IconProps>
  /** Left out of the card unless it is on (so a lock that has it can still be switched off). */
  hiddenUnlessOn?: boolean
}

/** "Applies when this product appears in:" and the places, as the Add lock form words it. */
const HIDE_FROM_LISTS_HINT = (
  <>
    Applies when this product appears in:
    <span role="list" className="mt-1 flex flex-col gap-0.5">
      {['Search results', 'Collection pages', 'And other areas...'].map((area) => (
        <span key={area} role="listitem" className="flex gap-2 before:content-['•']">
          {area}
        </span>
      ))}
    </span>
  </>
)

interface SettingGroup {
  title: string
  description: string
  icon: ComponentType<IconProps>
  items: SettingDef[]
}

/**
 * The lock's settings in the two cards Lock Management's lock page shows — **Access & Visibility**
 * and **Advanced Settings** — with the same words, hints and icons.
 */
const SETTING_GROUPS: SettingGroup[] = [
  {
    title: 'Access & Visibility',
    description: 'Who can access the product and where it is visible.',
    icon: EyeIcon,
    items: [
      {
        name: 'hide_from_nav',
        label: 'Hidden from navigation menus',
        hint: 'Applies when links to this product appear in navigation menus.',
        icon: ListChecksIcon,
      },
      {
        name: 'hide_from_lists',
        label: 'Hidden from lists',
        hint: HIDE_FROM_LISTS_HINT,
        icon: ListChecksIcon,
      },
    ],
  },
  {
    title: 'Advanced Settings',
    description: 'Extra lock options and indexing behavior.',
    icon: SlidersIcon,
    items: [
      {
        name: 'manual_locking',
        label: 'Manual locking',
        hint: 'Disables Lock management’s protection for this lock, allowing you to enforce the lock yourself using custom Liquid code.',
        icon: LockIcon,
        hiddenUnlessOn: true,
      },
      {
        name: 'hide_from_sitemap',
        label: 'Hidden from sitemaps',
        hint: 'Adds the SEO:Hidden metafield to this product, which results in hiding it from sitemaps, preventing Shopify from sending it to search engines, and removing it from storefront search results.',
        icon: LayersIcon,
      },
      {
        name: 'noindex',
        label: 'Search engines told not to index',
        hint: 'When enabled, adds the “noindex” meta tag whenever this lock denies access to the visitor.',
        icon: SearchIcon,
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

/** The settings a new lock starts with: nothing hidden, no manual locking. */
const NO_SETTINGS: Record<Exclude<LockSwitch, 'enabled'>, boolean> = {
  hide_from_nav: false,
  hide_from_lists: false,
  hide_from_sitemap: false,
  noindex: false,
  manual_locking: false,
}

/**
 * A product with no lock, set up on the spot: the same keys search, customer search and visibility
 * switches as a locked product, working on a draft held on screen. Everything is optional. **Lock
 * this product** asks once and then makes the lock in one call (`POST /access/locks`) with the keys
 * and customers chosen and the settings switched on — so locking takes one page, not two steps.
 * With no keys and no customers any customer who is signed in can open the product.
 */
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
  const [customers, setCustomers] = useState<ChosenCustomer[]>([])
  const [pickerKey, setPickerKey] = useState(0)
  const [options, setOptions] = useState(NO_SETTINGS)
  const [asking, setAsking] = useState(false)

  // The shared cards read an ordinary lock; this one only exists on screen until it is made.
  const draft: AccessLock = {
    product_id: handle,
    shopify_id: null,
    title,
    handle,
    status: null,
    image_url: null,
    product_tags: [],
    enabled: true,
    tags,
    ...options,
    message: null,
    customers_with_access: customers.length,
    sync_status: null,
    sync_error: null,
    last_pushed_at: null,
    updated_at: null,
    shop: null,
  }
  const settingsOn = SETTINGS.filter((setting) => options[setting.name])
  const summary =
    tags.length === 0 && customers.length === 0
      ? 'No keys or customers chosen: once locked, any customer who is signed in can open it.'
      : [
          tags.length > 0 &&
            `${tags.length} ${tags.length === 1 ? 'key' : 'keys'} (${tags.join(', ')})`,
          customers.length > 0 &&
            `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}`,
          settingsOn.length > 0 &&
            `${settingsOn.length} visibility ${settingsOn.length === 1 ? 'setting' : 'settings'} on`,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <div className="flex flex-col gap-3">
      <section
        className={`${CARD} from-accent-tint/60 to-bg flex items-center gap-3 bg-linear-to-r px-4 py-3`}
      >
        <span aria-hidden="true" className={TILE}>
          <LockIcon width={18} height={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[0.98rem] font-bold">This product is not locked</h2>
          <p className="text-text-muted m-0 text-[0.8rem]">
            Everyone can see and buy it. Choose who can open it below — everything is
            optional — then press <strong>Lock this product</strong>.
          </p>
        </div>
        <button
          type="button"
          className={`${PRIMARY} shrink-0`}
          disabled={writes.isWriting}
          onClick={() => setAsking(true)}
        >
          <LockIcon width={16} height={16} />
          Lock this product
        </button>
      </section>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <LockKeysSearch
            key={tags.join('|')}
            lock={draft}
            shop={shop}
            busy={writes.isWriting}
            onSave={({ add, remove }) =>
              setTags((current) => {
                const gone = lowerSet(remove)
                const kept = current.filter((tag) => !gone.has(tag.toLowerCase()))
                const have = lowerSet(kept)
                return [
                  ...kept,
                  ...add.filter((tag) => !have.has(tag.toLowerCase())),
                ].slice(0, MAX_KEYS)
              })
            }
          />

          <section
            className={`${CARD} flex flex-col gap-3 p-3 sm:p-4`}
            aria-label="Customers"
          >
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className={TILE}>
                <UsersIcon width={17} height={17} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-[0.92rem] font-bold">Customers</h2>
                <p className="text-text-muted m-0 truncate text-[0.76rem]">
                  Search and add the customers who can open this product.
                </p>
              </div>
              <span className={COUNT_BADGE}>{customers.length}</span>
            </div>
            <LockCustomerSearch
              key={pickerKey}
              lock={draft}
              shop={shop}
              busy={writes.isWriting}
              onAdd={(chosen) => {
                setCustomers((current) => {
                  const have = lowerSet(current.map((item) => item.ref))
                  return [
                    ...current,
                    ...chosen.filter((item) => !have.has(item.ref.toLowerCase())),
                  ].slice(0, 250)
                })
                // Empties the search box and its chosen customers.
                setPickerKey((key) => key + 1)
              }}
            />
            {customers.length > 0 && (
              <ul
                aria-label="Customers who will get access"
                className="m-0 flex list-none flex-wrap gap-1.5 p-0"
              >
                {customers.map((item) => (
                  <li key={item.ref} className={CHIP} title={item.ref}>
                    {item.label}
                    <button
                      type="button"
                      aria-label={`Remove ${item.label}`}
                      onClick={() =>
                        setCustomers(customers.filter((other) => other.ref !== item.ref))
                      }
                      className="hover:bg-accent hover:text-accent-contrast flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current"
                    >
                      <XIcon width={10} height={10} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <SettingsCard
          lock={draft}
          busy={writes.isWriting}
          onToggle={(name, value) =>
            setOptions((current) => ({ ...current, [name]: value }))
          }
        />
      </div>

      <section className={`${CARD} flex items-center gap-3 px-4 py-3`}>
        <p className="text-text-muted m-0 min-w-0 flex-1 text-[0.82rem]">{summary}</p>
      </section>

      {asking && (
        <AccessQuestion
          title={`Lock “${title}”?`}
          confirmLabel="Yes, lock it"
          onClose={() => setAsking(false)}
          onConfirm={async () => {
            await writes.write({
              kind: 'lock',
              tags,
              customers: customers.map((item) => item.ref),
              options,
            })
            setAsking(false)
          }}
        >
          <p className="m-0 text-[0.85rem]">
            {tags.length > 0 || customers.length > 0
              ? 'Only the customers you chose, and customers with one of the keys, will be able to open it.'
              : 'Only customers who are signed in will be able to open it.'}
          </p>
          <p className="text-text-muted mt-2 mb-0 text-[0.8rem]">{summary}</p>
          <p className="text-text-muted mt-3 mb-0 text-[0.8rem]">
            These changes will also be updated in Shopify.
          </p>
        </AccessQuestion>
      )}
    </div>
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
  | { kind: 'setKeys'; add: string[]; remove: string[] }

/**
 * The customer-access part of the tab on its own — the product's tags, Add / Remove tags, the
 * customer search and the customers table — for Lock Management's lock page (Customer Access tab),
 * which has its own header, settings and figures. The same component as the product page's, so
 * both pages work the same way.
 */
export function LockCustomerAccess({ lock, shop }: { lock: AccessLock; shop: string }) {
  return (
    <LockedProduct
      lock={lock}
      shop={shop}
      handle={lock.handle ?? lock.product_id}
      accessOnly
    />
  )
}

function LockedProduct({
  lock,
  shop,
  handle,
  accessOnly = false,
}: {
  lock: AccessLock
  shop: string
  handle: string
  /** Only the access sections: no header, settings or "Remove the lock" (Lock Management). */
  accessOnly?: boolean
}) {
  const product = lock.handle ?? lock.product_id
  // The lock's own tag (made with it): its holders are the customers chosen for this lock, and the
  // tag itself is internal — it is never shown.
  const ownTag = findOwnTag(lock.tags, lock.handle ?? handle)
  const keys = withoutOwnTag(lock.tags, ownTag)
  const list = useProductLockCustomers(shop, product, ownTag ?? '')
  const writes = useProductLockWrites(shop, handle, lock)
  const [notice, setNotice] = useState<string | null>(null)
  // The customers picked in the search box, waiting for "Yes" (and the box is emptied after it).
  const [giving, setGiving] = useState<ChosenCustomer[] | null>(null)
  const [pickerKey, setPickerKey] = useState(0)
  const [asked, setAsked] = useState<Asked | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const data = list.data
  const total = data?.total ?? lock.customers_with_access ?? 0
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
    // On Lock Management's page (`accessOnly`, from `lg`) the card fills the height left under the
    // lock's tabs: the page does not scroll, the customers table scrolls in its own box and the
    // pagination stays under it. The product page's tab is unchanged.
    <div className={`flex flex-col gap-3 ${accessOnly ? 'lg:min-h-0 lg:flex-1' : ''}`}>
      {!accessOnly && (
        <LockHeader
          lock={lock}
          customers={total}
          keys={keys.length}
          busy={writes.isWriting}
          onToggle={(value) => ask({ kind: 'switch', name: 'enabled', value })}
        />
      )}

      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      <div
        className={
          accessOnly
            ? 'flex flex-col gap-3 lg:min-h-0 lg:flex-1'
            : 'grid items-start gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]'
        }
      >
        <div
          className={`flex min-w-0 flex-col gap-3 ${accessOnly ? 'lg:min-h-0 lg:flex-1' : ''}`}
        >
          {/* The product's tags: one search bar, every tag with a tick box (ticked = on the product). */}
          <LockKeysSearch
            key={lock.tags.join('|')}
            lock={lock}
            shop={shop}
            busy={writes.isWriting}
            onSave={(change) => ask({ kind: 'setKeys', ...change })}
          />

          <section
            className={`${CARD} ${accessOnly ? 'flex flex-col lg:min-h-0 lg:flex-1' : ''}`}
            aria-label="Customer Access"
          >
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

            <div
              className={`relative max-h-[22rem] overflow-auto ${
                accessOnly ? 'lg:max-h-none lg:min-h-[12rem] lg:flex-1' : ''
              }`}
            >
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
                      const shownTags = withoutOwnTag(customer.tags, ownTag)
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
                            {/* The tag names, as the Key column of the locks list shows them: up to two,
                                then a "+N" that opens every one. A tag can still be taken off. */}
                            {shownTags.length === 0 ? (
                              <span className="text-text-muted">—</span>
                            ) : (
                              <ExpandableChips
                                values={shownTags}
                                label="Assigned tags"
                                onRemove={
                                  loginOnly
                                    ? undefined
                                    : (tag) => ask({ kind: 'untag', customer, tag })
                                }
                                removeLabel={(tag) => `Remove tag ${tag} from ${name}`}
                              />
                            )}
                          </td>
                          <td className={TD}>
                            {!loginOnly && (
                              <div className={ROW_ACTIONS}>
                                <button
                                  type="button"
                                  aria-label={`Remove access of ${name}`}
                                  title="Remove access"
                                  onClick={() =>
                                    ask({ kind: 'remove', customers: [customer] })
                                  }
                                  className={ROW_ACTION_DANGER}
                                >
                                  <TrashIcon
                                    width={ROW_ACTION_ICON}
                                    height={ROW_ACTION_ICON}
                                  />
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

        {!accessOnly && (
          <SettingsCard
            lock={lock}
            busy={writes.isWriting}
            onToggle={(name, value) => ask({ kind: 'switch', name, value })}
          />
        )}
      </div>

      {!accessOnly && (
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
      )}

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
    case 'setKeys': {
      const remaining = lock.tags.length + asked.add.length - asked.remove.length
      return (
        <AccessQuestion
          title={`Update the tags of “${lock.title}”?`}
          confirmLabel="Save tags"
          danger={asked.add.length === 0}
          onClose={onClose}
          onConfirm={onConfirm}
        >
          {asked.add.length > 0 && (
            <p className="m-0 text-[0.85rem]">
              <span className="text-text-muted">Add: </span>
              <strong>{asked.add.join(', ')}</strong>
            </p>
          )}
          {asked.remove.length > 0 && (
            <p className="mt-1 mb-0 text-[0.85rem]">
              <span className="text-text-muted">Take off: </span>
              <strong>{asked.remove.join(', ')}</strong>
            </p>
          )}
          <p className="text-text-muted mt-3 mb-0 text-[0.8rem]">
            {asked.remove.length > 0
              ? 'Customers who only have a tag taken off will no longer be able to open the product. '
              : 'Customers with an added tag will be able to open the product. '}
            {remaining <= 0
              ? 'With no tag left, any customer who is signed in can open it. '
              : ''}
            {footer}
          </p>
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
 * The Lock Access bar, one slim row: the lock icon and title, a small Enabled / Disabled dropdown
 * (picking the other one asks first), the Shopify state, how many customers and keys the lock has,
 * and — at the right — when it last changed.
 */
function LockHeader({
  lock,
  customers,
  keys,
  busy,
  onToggle,
}: {
  lock: AccessLock
  customers: number
  keys: number
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
  const count =
    'border-border bg-bg inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[0.8rem]'
  return (
    <section
      className={`${CARD} from-accent-tint/60 to-bg flex flex-wrap items-center gap-x-3 gap-y-2 bg-linear-to-r px-3 py-2`}
    >
      <LockIcon width={20} height={20} className="text-accent shrink-0" />
      <h2 className="m-0 text-[0.98rem] font-bold">Lock Access</h2>
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
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[0.78rem] font-semibold ${tone}`}
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
      <span aria-hidden="true" className="bg-border hidden h-6 w-px sm:block" />
      <span className={count} title="Customers who can open this product">
        <UsersIcon width={16} height={16} className="text-text-muted" />
        <strong>{customers.toLocaleString('en-GB')}</strong>
        {customers === 1 ? 'Customer' : 'Customers'}
      </span>
      <span className={count} title="Tags that give access to this product">
        <TagIcon width={16} height={16} className="text-text-muted" />
        <strong>{keys.toLocaleString('en-GB')}</strong>
        {keys === 1 ? 'Key' : 'Keys'}
      </span>
      {lock.updated_at && (
        <p className="text-text-muted m-0 ml-auto text-[0.78rem]">
          Updated {formatDateTimeAmPm(lock.updated_at)}.
        </p>
      )}
    </section>
  )
}

/**
 * The lock's other settings as switches, in the same two cards as Lock Management's lock page —
 * a tinted header with an icon, a title and a line about it, then a row per setting (icon, name,
 * an ⓘ with what it does, Yes / No and the switch). A switch asks first and saves at once.
 */
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
    <section className="flex min-w-0 flex-col gap-3" aria-label="Lock settings">
      {SETTING_GROUPS.map((group) => {
        const GroupIcon = group.icon
        return (
          <section
            key={group.title}
            aria-label={group.title}
            className={`${DETAIL_CARD} min-w-0`}
          >
            <div className="bg-accent-tint/60 border-border-strong flex items-center gap-3 rounded-t-[0.7rem] border-b px-4 py-3">
              <GroupIcon width={22} height={22} className="text-accent shrink-0" />
              <div className="min-w-0">
                <h2 className="m-0 text-[1rem] font-semibold">{group.title}</h2>
                <p className="text-text-muted m-0 text-[0.78rem]">{group.description}</p>
              </div>
            </div>
            <div className="px-4 py-1">
              {group.items
                .filter((setting) => !setting.hiddenUnlessOn || lock[setting.name])
                .map((setting) => {
                  const Icon = setting.icon
                  return (
                    <div
                      key={setting.name}
                      className="border-border flex items-center gap-3 border-b py-2.5 last:border-b-0"
                    >
                      <Icon width={18} height={18} className="text-text-muted shrink-0" />
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-[0.88rem] font-medium">
                        <span className="truncate">{setting.label}</span>
                        <InfoTip label={setting.label}>{setting.hint}</InfoTip>
                      </span>
                      <ToggleSwitch
                        label={setting.label}
                        checked={lock[setting.name]}
                        disabled={busy}
                        onChange={(value) => onToggle(setting.name, value)}
                      />
                    </div>
                  )
                })}
            </div>
          </section>
        )
      })}

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

/**
 * The ⓘ beside a setting: hover or focus it and a small card explains the setting. It opens
 * towards the left from the icon, so it stays inside the card even at the right-hand edge.
 */
function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={id}
        className="text-text-muted hover:text-accent focus-visible:outline-accent inline-flex cursor-help border-none bg-transparent p-0 focus-visible:outline-2"
      >
        <InfoIcon width={14} height={14} />
      </button>
      <span
        role="tooltip"
        id={id}
        className="bg-bg text-text border-border pointer-events-none absolute top-full right-0 z-20 mt-2 hidden w-72 max-w-[75vw] rounded-lg border px-3 py-2 text-[0.78rem] leading-snug font-normal shadow-lg group-focus-within:block group-hover:block"
      >
        {children}
      </span>
    </span>
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
        className="text-text-muted w-7 text-right text-[0.78rem] font-semibold"
      >
        {checked ? 'Yes' : 'No'}
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

function StateRow({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={5} className="text-text-muted px-4 py-10 text-center">
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
  // The tags people chose (the lock's own `lock-…` tag is given on its own, never offered).
  const keys = withoutOwnTag(lock.tags, findOwnTag(lock.tags, lock.handle))
  const [tag, setTag] = useState(keys[0] ?? '')
  const several = keys.length > 1
  const clean = (several ? tag : (keys[0] ?? tag)).trim()
  const hasOwnTag = keys.length < lock.tags.length
  const many = customers.length > 1
  return (
    <AccessQuestion
      title={many ? `Give access to ${customers.length} customers?` : 'Give access?'}
      confirmLabel={many ? `Give access (${customers.length})` : 'Give access'}
      disabled={!clean && !hasOwnTag}
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
        <TagChoice keys={keys} value={tag} onChange={setTag} />
      ) : keys[0] ? (
        <p className="mt-3 mb-0 text-[0.85rem]">
          They will get the key <strong>“{keys[0]}”</strong> and be able to open “
          {lock.title}”.
        </p>
      ) : (
        <p className="mt-3 mb-0 text-[0.85rem]">
          They will be able to open “{lock.title}”.
        </p>
      )}
      <SharedNote note={sharedNote(sharedTags, clean ? [clean] : [])} />
      <p className="text-text-muted mt-3 mb-0 text-[0.8rem]">
        These changes will also be updated in Shopify.
      </p>
    </AccessQuestion>
  )
}
