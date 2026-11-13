import { useMemo, useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  LockIcon,
  PlusIcon,
  ProductsIcon,
  SearchIcon,
  SpinnerIcon,
  StoreIcon,
  TagIcon,
  TrashIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { useAccess } from '../../../hooks/useAccess.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import type { AccessLock, CustomerDetail } from '../../../lib/api/endpoints.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { useStoreTags } from '../../products/index.ts'
import { useCustomerLockWrites, useStoreLocks } from '../hooks/useCustomerLockAccess.ts'
import { useUpdateCustomer } from '../hooks/useUpdateCustomer.ts'
import { customerName } from '../utils/format.ts'
import {
  alsoLosing,
  changeTags,
  giveCandidates,
  hasAccess,
  heldKeys,
  isLoginOnly,
  isOwnTag,
  lowerSet,
  matchLocks,
  splitTags,
  tagUse,
} from '../utils/lockAccess.ts'
import { CustomerUpdateDialog } from './CustomerUpdateDialog.tsx'

const CARD = 'border-border bg-bg rounded-2xl border'
const TILE =
  'bg-accent-tint text-accent border-accent/20 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border'
const PRIMARY =
  'bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3.5 text-[0.82rem] font-semibold shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50'
const OUTLINE =
  'border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const DANGER_OUTLINE =
  'border-danger text-danger hover:bg-danger-bg inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border bg-transparent font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const CHIP =
  'inline-flex items-center gap-2 rounded-full py-1.5 pr-2 pl-3 text-[0.88rem] font-semibold'
const CHIP_KEY = `${CHIP} bg-accent-tint text-accent`
const CHIP_PLAIN = `${CHIP} border-border bg-surface text-text border`
const CHIP_X =
  'hover:bg-accent hover:text-accent-contrast flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current transition-colors disabled:pointer-events-none disabled:opacity-50'
const SEARCH_BOX =
  'border-border bg-bg focus-within:border-accent flex h-9 w-full min-w-0 shrink-0 items-center gap-2.5 rounded-lg border px-3 shadow-sm transition-colors'
const SEARCH_INPUT =
  'text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.88rem] outline-none [&::-webkit-search-cancel-button]:hidden'
const COUNT_BADGE =
  'bg-accent-tint text-accent shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] font-bold whitespace-nowrap'
const DIALOG_BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** How many products one page of the product list shows to begin with. */
const PAGE_SIZE = 10

// The table is the customers list's: a tinted sticky header, 0.85rem cells, striped rows.
const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_CENTER = `${TH_BASE} text-center`
const TD = 'px-3 py-3 align-middle'

/**
 * The **Lock Access** tab of a customer: which locked products they can open and by which tags —
 * on the same access API as Lock Management and a product's Lock Access tab (the same locks and
 * tags, the same cache: a change here shows there). The tags card shows the customer's keys, with
 * **Show all tags** for their other tags; the products card shows what they can open, with **Show
 * all products** for every locked product of the store, each with Give access / Remove access.
 * Every change asks first and is also sent to Shopify.
 */
export function CustomerLockAccessPanel({ customer }: { customer: CustomerDetail }) {
  const shop = customer.shop?.key ?? ''
  const store = useStoreLocks(shop)

  if (!shop) {
    return (
      <Empty
        title="Lock access is not available"
        text="This customer has no store yet, so there is no lock to manage."
      />
    )
  }
  if (store.error) {
    return (
      <Empty
        tone="error"
        title="Couldn't load the locked products"
        text={store.error}
        action={
          <button
            type="button"
            onClick={store.retry}
            className={`${OUTLINE} h-9 px-3 text-[0.82rem]`}
          >
            Try again
          </button>
        }
      />
    )
  }
  if (store.isPending) {
    return (
      <section
        className={`${CARD} text-text-muted flex items-center justify-center gap-2 py-14`}
      >
        <SpinnerIcon width={18} height={18} className="animate-spin" />
        Loading lock access…
      </section>
    )
  }
  return (
    <LoadedLockAccess
      customer={customer}
      locks={store.locks}
      truncated={store.truncated}
    />
  )
}

function LoadedLockAccess({
  customer,
  locks,
  truncated,
}: {
  customer: CustomerDetail
  locks: AccessLock[]
  truncated: boolean
}) {
  const { canManage: manageAccess } = useAccess('access')
  const { canManage: manageCustomers } = useAccess('customers')
  const writes = useCustomerLockWrites(customer)
  const [notice, setNotice] = useState<string | null>(null)

  const use = useMemo(() => tagUse(locks), [locks])
  const { keys, others } = useMemo(
    () => splitTags(customer.tags, use),
    [customer.tags, use],
  )
  const withAccess = useMemo(
    () => locks.filter((lock) => hasAccess(lock, customer.tags)),
    [locks, customer.tags],
  )

  return (
    <div className="flex flex-col gap-3">
      <section
        className={`${CARD} from-accent-tint/70 to-bg flex flex-wrap items-center gap-x-4 gap-y-3 bg-linear-to-r px-5 py-4`}
      >
        <LockIcon width={30} height={30} className="text-accent shrink-0" />
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="m-0 text-[1.15rem] leading-tight font-bold">Lock Access</h2>
          <p className="text-text-muted m-0 text-[0.85rem]">
            Manage product access for this customer using tags.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {customer.shop?.name && (
            <span className="border-border bg-bg text-text-muted inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[0.85rem] shadow-sm">
              <StoreIcon width={15} height={15} />
              {customer.shop.name}
            </span>
          )}
          <Count
            icon={<ProductsIcon width={16} height={16} className="text-accent" />}
            value={withAccess.length}
            one="Product"
            many="Products"
            title="Locked products this customer can open"
          />
          <Count
            icon={<TagIcon width={16} height={16} className="text-accent" />}
            value={keys.length}
            one="Key"
            many="Keys"
            title="Tags this customer holds that open locked products"
          />
        </div>
      </section>

      {notice && <FormMessage tone="success">{notice}</FormMessage>}
      {truncated && (
        <FormMessage tone="info">
          This store has more than 1,000 locked products; only the first 1,000 are listed.
        </FormMessage>
      )}

      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <TagsCard
          customer={customer}
          keys={keys}
          others={others}
          use={use}
          canEdit={manageAccess && manageCustomers}
          onChanged={async () => {
            setNotice(null)
            await writes.refresh()
          }}
        />
        <ProductsCard
          customer={customer}
          locks={locks}
          withAccess={withAccess}
          use={use}
          canEdit={manageAccess}
          onGive={async (lock, tag) => {
            setNotice(await writes.give({ lock, tag }))
          }}
          onRemove={async (lock) => {
            setNotice(await writes.remove({ lock }))
          }}
        />
      </div>
    </div>
  )
}

function Count({
  icon,
  value,
  one,
  many,
  title,
}: {
  icon: ReactNode
  value: number
  one: string
  many: string
  title: string
}) {
  return (
    <span
      title={title}
      className="border-border bg-bg inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[0.88rem] shadow-sm"
    >
      {icon}
      <strong>{value.toLocaleString('en-GB')}</strong>
      {value === 1 ? one : many}
    </span>
  )
}

// --- Tags ---------------------------------------------------------------------------------

/**
 * The customer's tags. By default only the **keys** (tags that open locked products), each with a ✕;
 * **Show all tags** adds their other tags. A search box suggests the store's tags (lock keys first);
 * pick or type some and press Add — a question names what changes before anything is sent
 * (`PUT /customers/{ref}` with the whole tag list, which also updates Shopify).
 */
function TagsCard({
  customer,
  keys,
  others,
  use,
  canEdit,
  onChanged,
}: {
  customer: CustomerDetail
  keys: string[]
  others: string[]
  use: ReadonlyMap<string, number>
  canEdit: boolean
  onChanged: () => Promise<void>
}) {
  const shop = customer.shop?.key ?? ''
  const [showAll, setShowAll] = useState(false)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [asked, setAsked] = useState<{ added: string[]; removed: string[] } | null>(null)
  const store = useStoreTags(shop ? [shop] : [], { enabled: open })
  const { update, isUpdating, error, clearError } = useUpdateCustomer()

  const mine = lowerSet(customer.tags)
  const pickedSet = lowerSet(picked)
  const query = text.trim().toLowerCase()
  const suggestions = store.tags
    .filter(
      (tag) =>
        !isOwnTag(tag) &&
        !mine.has(tag.toLowerCase()) &&
        !pickedSet.has(tag.toLowerCase()) &&
        (!query || tag.toLowerCase().includes(query)),
    )
    // The tags that open locked products first.
    .sort(
      (a, b) =>
        Number(use.has(b.toLowerCase())) - Number(use.has(a.toLowerCase())) ||
        a.localeCompare(b),
    )
    .slice(0, 50)
  const typed = [
    ...new Map(
      text
        .split(',')
        .map((tag) => tag.trim())
        .filter(
          (tag) =>
            tag &&
            !isOwnTag(tag) &&
            !mine.has(tag.toLowerCase()) &&
            !pickedSet.has(tag.toLowerCase()),
        )
        .map((tag) => [tag.toLowerCase(), tag] as const),
    ).values(),
  ]
  const known = lowerSet(store.tags)
  const addable = typed.filter((tag) => !known.has(tag.toLowerCase()))

  function pick(...next: string[]) {
    setPicked([...picked, ...next.filter((tag) => !pickedSet.has(tag.toLowerCase()))])
  }

  function addTyped() {
    if (typed.length === 0) return
    pick(...typed)
    setText('')
  }

  async function confirm() {
    if (!asked) return
    const result = await update({
      id: customer.id,
      shop: customer.shop?.key ?? null,
      body: { tags: changeTags(customer.tags, asked.added, asked.removed) },
    })
    if (!result) return
    setAsked(null)
    setPicked((current) => current.filter((tag) => !asked.added.includes(tag)))
    await onChanged()
  }

  const shown = showAll ? [...keys, ...others] : keys

  return (
    <section
      className={`${CARD} flex min-w-0 flex-col gap-3 p-3 sm:p-4`}
      aria-label="Tags"
    >
      <div className="flex items-center gap-3">
        <TagIcon width={24} height={24} className="text-accent shrink-0" />
        <h2
          className="m-0 min-w-0 flex-1 text-[1.05rem] font-bold"
          title={
            showAll
              ? 'All of this customer’s tags. The highlighted ones open locked products.'
              : 'The tags that open locked products for this customer.'
          }
        >
          Tags
        </h2>
        <span className={COUNT_BADGE} title="Key tags and all tags">
          {keys.length} / {keys.length + others.length}
        </span>
      </div>

      {canEdit && (
        <div className="flex flex-col items-start gap-3">
          <div
            className="relative w-full"
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
              <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
              <span className="sr-only">Add tags to this customer</span>
              <input
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls="customer-lock-tags"
                aria-autocomplete="list"
                value={text}
                maxLength={255}
                placeholder="Search tags or add a new one…"
                onFocus={() => setOpen(true)}
                onChange={(event) => {
                  setText(event.target.value)
                  setOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault()
                    addTyped()
                  }
                }}
                className={SEARCH_INPUT}
              />
              {text && (
                <button
                  type="button"
                  aria-label="Clear tag search"
                  onClick={() => setText('')}
                  className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0.5"
                >
                  <XIcon width={13} height={13} />
                </button>
              )}
            </label>

            {open && (
              <div
                id="customer-lock-tags"
                tabIndex={-1}
                className="border-border bg-bg absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-lg border shadow-lg outline-none"
              >
                <ul
                  aria-label="Tags in the store"
                  className="m-0 max-h-56 list-none overflow-auto p-0"
                >
                  {addable.map((tag) => (
                    <li key={`new-${tag}`} className="border-border border-b">
                      <button
                        type="button"
                        onClick={() => {
                          pick(tag)
                          setText('')
                        }}
                        className="hover:bg-accent-tint/60 text-accent flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-[0.8rem] font-semibold transition-colors"
                      >
                        <PlusIcon width={13} height={13} />
                        Add new tag “{tag}”
                      </button>
                    </li>
                  ))}
                  {store.isLoading ? (
                    <li
                      role="status"
                      className="text-text-muted flex items-center justify-center gap-2 px-4 py-5 text-[0.8rem]"
                    >
                      <SpinnerIcon width={13} height={13} className="animate-spin" />
                      Loading tags…
                    </li>
                  ) : suggestions.length === 0 ? (
                    addable.length === 0 && (
                      <li className="text-text-muted px-4 py-5 text-center text-[0.8rem]">
                        {query
                          ? `No tag matches “${text.trim()}”.`
                          : 'No more tags to add.'}
                      </li>
                    )
                  ) : (
                    suggestions.map((tag) => (
                      <li key={tag} className="border-border border-b last:border-b-0">
                        <button
                          type="button"
                          onClick={() => pick(tag)}
                          className="hover:bg-accent-tint/60 flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-[0.82rem] font-semibold transition-colors"
                        >
                          <span className="min-w-0 flex-1 truncate">{tag}</span>
                          {use.has(tag.toLowerCase()) && (
                            <span className="bg-accent-tint text-accent shrink-0 rounded-full px-2 py-0.5 text-[0.66rem] font-bold">
                              Opens {use.get(tag.toLowerCase())} product
                              {use.get(tag.toLowerCase()) === 1 ? '' : 's'}
                            </span>
                          )}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={picked.length === 0}
            onClick={() => {
              clearError()
              setAsked({ added: picked, removed: [] })
            }}
            className={`${PRIMARY} h-10 px-4 text-[0.88rem]`}
          >
            <PlusIcon width={14} height={14} />
            {picked.length > 1 ? `Add ${picked.length} tags` : 'Add tag'}
          </button>
        </div>
      )}

      {picked.length > 0 && (
        <ul aria-label="Tags to add" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {picked.map((tag) => (
            <li key={tag} className={`${CHIP_KEY} border-accent/40 border border-dashed`}>
              {tag}
              <button
                type="button"
                aria-label={`Don’t add ${tag}`}
                onClick={() =>
                  setPicked(
                    picked.filter((item) => item.toLowerCase() !== tag.toLowerCase()),
                  )
                }
                className={CHIP_X}
              >
                <XIcon width={10} height={10} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {shown.length === 0 ? (
        <p className="text-text-muted m-0 text-[0.82rem]">
          {others.length > 0
            ? 'No key tags: no tag of this customer opens a locked product.'
            : 'This customer has no tags.'}
        </p>
      ) : (
        <ul
          aria-label="Tags of this customer"
          className="m-0 flex max-h-[26rem] min-h-24 flex-1 list-none flex-wrap content-start gap-2.5 overflow-auto p-0"
        >
          {shown.map((tag) => {
            const isKey = use.has(tag.toLowerCase())
            return (
              <li key={tag} className={isKey ? CHIP_KEY : CHIP_PLAIN}>
                {isKey && <LockIcon width={15} height={15} />}
                {tag}
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Remove the tag ${tag}`}
                    title="Remove this tag"
                    onClick={() => {
                      clearError()
                      setAsked({ added: [], removed: [tag] })
                    }}
                    className={CHIP_X}
                  >
                    <XIcon width={13} height={13} />
                  </button>
                ) : (
                  <span className="pr-1" />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {others.length > 0 && (
        <div className="border-border mt-auto border-t pt-3">
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll(!showAll)}
            className="text-accent inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[0.9rem] font-semibold"
          >
            {showAll ? 'Show key tags only' : `Show all tags (${others.length} more)`}
            <ChevronRightIcon
              width={15}
              height={15}
              className={showAll ? '-rotate-90' : ''}
            />
          </button>
        </div>
      )}

      {asked && (
        <CustomerUpdateDialog
          title={`Update “${customerName(customer)}”?`}
          added={asked.added}
          removed={asked.removed}
          isUpdating={isUpdating}
          error={error}
          onConfirm={() => void confirm()}
          onCancel={() => {
            if (!isUpdating) {
              setAsked(null)
              clearError()
            }
          }}
        />
      )}
    </section>
  )
}

// --- Products -----------------------------------------------------------------------------

type ProductAction = { kind: 'give' | 'remove'; lock: AccessLock }

/**
 * The locked products. By default only those the customer can open; **Show all products** lists
 * every locked product of the store with whether they have access. Search narrows either list; each
 * row has **Give access** or **Remove access** (asked first).
 */
function ProductsCard({
  customer,
  locks,
  withAccess,
  use,
  canEdit,
  onGive,
  onRemove,
}: {
  customer: CustomerDetail
  locks: AccessLock[]
  withAccess: AccessLock[]
  use: ReadonlyMap<string, number>
  canEdit: boolean
  onGive: (lock: AccessLock, tag: string) => Promise<void>
  onRemove: (lock: AccessLock) => Promise<void>
}) {
  const [showAll, setShowAll] = useState(false)
  const [search, setSearch] = useState('')
  const [paging, setPaging] = useState({ view: '', page: 1 })
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [action, setAction] = useState<ProductAction | null>(null)

  const rows = matchLocks(showAll ? locks : withAccess, search)
  const view = `${showAll}|${search}`
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = Math.min(paging.view === view ? paging.page : 1, totalPages)
  const shown = rows.slice((page - 1) * pageSize, page * pageSize)

  const tab = (on: boolean) =>
    `inline-flex h-10 cursor-pointer items-center gap-2.5 border px-4 text-[0.88rem] font-semibold transition-colors ${
      on
        ? 'border-accent bg-accent-tint/50 text-accent rounded-xl'
        : 'text-text-muted hover:text-text border-transparent bg-transparent'
    }`

  return (
    <section
      className={`${CARD} flex min-w-0 flex-col gap-3 p-3 sm:p-4`}
      aria-label="Locked products"
    >
      <div className="flex flex-wrap items-center gap-3">
        <ProductsIcon width={26} height={26} className="text-accent shrink-0" />
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="m-0 text-[1.05rem] font-bold">Locked Products</h2>
          <p className="text-text-muted m-0 text-[0.82rem]">
            {showAll
              ? 'Every locked product in the store, and whether this customer can access it.'
              : 'Products this customer can access.'}
          </p>
        </div>
        <div
          role="group"
          aria-label="Which products to show"
          className="border-border bg-bg flex shrink-0 overflow-hidden rounded-xl border shadow-sm"
        >
          <button
            type="button"
            aria-pressed={!showAll}
            onClick={() => setShowAll(false)}
            className={tab(!showAll)}
          >
            With access
            <span className="text-[0.82rem] font-bold">{withAccess.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={showAll}
            onClick={() => setShowAll(true)}
            className={tab(showAll)}
          >
            All products
            <span className="text-[0.82rem] font-bold">{locks.length}</span>
          </button>
        </div>
      </div>

      <label className={SEARCH_BOX}>
        <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
        <span className="sr-only">Search locked products</span>
        <input
          type="search"
          value={search}
          maxLength={200}
          placeholder="Search products by name or handle…"
          onChange={(event) => setSearch(event.target.value)}
          className={SEARCH_INPUT}
        />
        {search && (
          <button
            type="button"
            aria-label="Clear product search"
            onClick={() => setSearch('')}
            className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0.5"
          >
            <XIcon width={13} height={13} />
          </button>
        )}
      </label>

      {shown.length === 0 ? (
        <p className="text-text-muted border-border m-0 rounded-lg border border-dashed px-4 py-8 text-center text-[0.85rem]">
          {search.trim()
            ? `No product matches “${search.trim()}”.`
            : showAll
              ? 'This store has no locked products yet.'
              : 'This customer can’t open any locked product yet. Choose Show all products to give them access.'}
        </p>
      ) : (
        <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
          <div className="max-h-[min(60svh,30rem)] min-h-40 flex-1 overflow-auto">
            <table
              aria-label={showAll ? 'All locked products' : 'Products with access'}
              className="w-full min-w-[640px] border-collapse text-[0.85rem]"
            >
              <thead>
                <tr>
                  <th className={TH}>Product</th>
                  <th className={`${TH_CENTER} w-28`}>Status</th>
                  <th className={TH}>Keys</th>
                  {canEdit && <th className={`${TH_CENTER} w-44`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((lock) => (
                  <ProductRow
                    key={lock.product_id}
                    lock={lock}
                    customerTags={customer.tags}
                    canEdit={canEdit}
                    onGive={() => setAction({ kind: 'give', lock })}
                    onRemove={() => setAction({ kind: 'remove', lock })}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter
            page={page}
            pageSize={pageSize}
            total={rows.length}
            totalPages={totalPages}
            onPageChange={(next) => setPaging({ view, page: next })}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPaging({ view, page: 1 })
            }}
          />
        </div>
      )}

      {action && (
        <ProductQuestion
          action={action}
          customer={customer}
          locks={locks}
          use={use}
          onClose={() => setAction(null)}
          onConfirm={async (tag) => {
            if (action.kind === 'give') await onGive(action.lock, tag)
            else await onRemove(action.lock)
            setAction(null)
          }}
        />
      )}
    </section>
  )
}

function ProductRow({
  lock,
  customerTags,
  canEdit,
  onGive,
  onRemove,
}: {
  lock: AccessLock
  customerTags: readonly string[]
  canEdit: boolean
  onGive: () => void
  onRemove: () => void
}) {
  const image = safeUrl(lock.image_url)
  const access = hasAccess(lock, customerTags)
  const loginOnly = isLoginOnly(lock)
  const matched = heldKeys(lock, customerTags).filter((tag) => !isOwnTag(tag))
  return (
    <tr className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors">
      <td className={TD}>
        <span className="flex min-w-0 items-center gap-3">
          <span className="bg-surface border-border text-text-muted flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
            {image ? (
              <img
                src={image}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <ProductsIcon width={16} height={16} />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold" title={lock.title}>
              {lock.title}
            </span>
            {lock.handle && (
              <span className="text-text-muted block truncate text-[0.75rem]">
                /{lock.handle}
              </span>
            )}
          </span>
        </span>
      </td>
      <td className={`${TD} text-center`}>
        <Badge
          tone={lock.enabled ? 'success' : 'neutral'}
          className="w-24 justify-center"
        >
          {lock.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </td>
      <td className={TD}>
        {loginOnly ? (
          <span className="text-text-muted text-[0.78rem]">Any signed-in customer</span>
        ) : access ? (
          matched.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {matched.map((tag) => (
                <span
                  key={tag}
                  className="bg-accent-tint text-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold"
                >
                  <LockIcon width={12} height={12} />
                  {tag}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-text-muted text-[0.78rem]">
              Chosen for this product
            </span>
          )
        ) : (
          <span className="text-text-muted text-[0.78rem]">No access</span>
        )}
      </td>
      {canEdit && (
        <td className={`${TD} text-center`}>
          {!loginOnly &&
            (access ? (
              <button
                type="button"
                aria-label={`Remove access to ${lock.title}`}
                onClick={onRemove}
                className={`${DANGER_OUTLINE} h-8 px-3 text-[0.8rem]`}
              >
                <TrashIcon width={14} height={14} />
                Remove access
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Give access to ${lock.title}`}
                onClick={onGive}
                className={`${OUTLINE} h-8 px-3 text-[0.8rem]`}
              >
                <PlusIcon width={14} height={14} />
                Give access
              </button>
            ))}
        </td>
      )}
    </tr>
  )
}

/**
 * "Are you sure?" before a change of access (it is also sent to Shopify). Cancel is focused;
 * nothing is sent until the confirm button, and a refusal shows the backend's message inside.
 * Giving access to a product with several keys asks which tag the customer gets; a tag shared with
 * other locked products, and the other products a removal also closes, are said plainly.
 */
function ProductQuestion({
  action,
  customer,
  locks,
  use,
  onClose,
  onConfirm,
}: {
  action: ProductAction
  customer: CustomerDetail
  locks: AccessLock[]
  use: ReadonlyMap<string, number>
  onClose: () => void
  onConfirm: (tag: string) => Promise<void>
}) {
  const { lock } = action
  const name = customerName(customer)
  const candidates = giveCandidates(lock)
  const [tag, setTag] = useState(candidates[0] ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const giving = action.kind === 'give'
  const sharedWith = giving ? Math.max(0, (use.get(tag.toLowerCase()) ?? 1) - 1) : 0
  const losing = giving ? [] : alsoLosing(locks, lock, customer.tags)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(tag)
    } catch (caught) {
      setError(toUserMessage(caught))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={giving ? `Give ${name} access?` : `Remove ${name}’s access?`}
      onClose={onClose}
      closeDisabled={busy}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            disabled={busy}
            onClick={onClose}
            className={`${DIALOG_BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || (giving && !tag)}
            onClick={() => void confirm()}
            className={`${DIALOG_BUTTON} border-transparent text-white hover:opacity-90 ${
              giving ? 'bg-accent' : 'bg-danger'
            }`}
          >
            {busy && <SpinnerIcon width={16} height={16} className="animate-spin" />}
            {giving ? 'Give access' : 'Remove access'}
          </button>
        </>
      }
    >
      <p className="m-0 text-[0.85rem]">
        {giving
          ? `${name} will be able to open “${lock.title}”.`
          : `${name} will no longer be able to open “${lock.title}”.`}{' '}
        These changes will also be updated in Shopify.
      </p>

      {giving && candidates.length > 1 && (
        <fieldset className="m-0 mt-3 border-none p-0">
          <legend className="mb-2 text-[0.82rem] font-semibold">Tag to give</legend>
          <div className="flex flex-wrap gap-2">
            {candidates.map((key) => (
              <label
                key={key}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[0.8rem] font-semibold transition-colors ${
                  tag === key
                    ? 'border-accent bg-accent-tint text-accent'
                    : 'border-border bg-bg text-text-muted hover:border-accent'
                }`}
              >
                <input
                  type="radio"
                  name="customer-lock-tag"
                  checked={tag === key}
                  onChange={() => setTag(key)}
                  className="accent-accent m-0 h-3.5 w-3.5"
                />
                {key}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {giving && candidates.length === 1 && !isOwnTag(candidates[0]) && (
        <p className="text-text-muted mt-2 mb-0 text-[0.8rem]">
          They get the tag “{candidates[0]}”.
        </p>
      )}

      {sharedWith > 0 && (
        <Note>
          The tag “{tag}” also opens {sharedWith} other locked product
          {sharedWith === 1 ? '' : 's'}, so {name} will be able to open those too.
        </Note>
      )}
      {losing.length > 0 && (
        <Note>
          The same tag also opens {losing.length} other locked product
          {losing.length === 1 ? '' : 's'} (
          {losing
            .slice(0, 3)
            .map((other) => `“${other.title}”`)
            .join(', ')}
          {losing.length > 3 ? ', …' : ''}), so {name} will lose those too.
        </Note>
      )}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="bg-warning-bg text-warning mt-3 mb-0 flex items-start gap-2 rounded-lg px-3 py-2 text-[0.8rem]"
    >
      <AlertTriangleIcon width={14} height={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
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
          <AlertTriangleIcon width={20} height={20} />
        ) : (
          <LockIcon width={20} height={20} />
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
