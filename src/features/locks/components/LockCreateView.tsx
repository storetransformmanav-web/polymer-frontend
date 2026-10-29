import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import { ArrowLeftIcon, CheckIcon, XIcon } from '../../../components/ui/icons.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import type { CustomerListItem, ProductListItem } from '../../../lib/api/endpoints.ts'
import { usePickCustomers, usePickProducts } from '../hooks/usePickers.ts'
import { useSaveLock } from '../hooks/useLockWrites.ts'
import {
  MAX_ITEMS,
  blankLockDraft,
  buildLockBody,
  isLockDraftDirty,
  validateLockDraft,
  type LockDraft,
  type PickedItem,
} from '../utils/lockDraft.ts'
import { LockCard } from './LockCard.tsx'
import { LockConfirmDialog } from './LockConfirmDialog.tsx'
import {
  LockAdvancedCard,
  LockMessageCard,
  LockSettingsCard,
} from './LockOptionCards.tsx'
import { PickList, type PickRow } from './PickList.tsx'
import { PickedChips } from './PickedChips.tsx'
import { TagPicker } from './TagPicker.tsx'

const productRow = (product: ProductListItem): PickRow => ({
  id: product.id,
  label: product.title,
  sub: product.handle,
  image: product.image_url,
  withImage: true,
  chips: product.status ? [product.status.toLowerCase()] : [],
})

const customerRow = (customer: CustomerListItem): PickRow => ({
  id: customer.id,
  label: customer.full_name?.trim() || customer.email || 'Unnamed customer',
  sub: customer.email,
  chips: customer.tags,
})

const toPicked = (row: PickRow): PickedItem => ({
  id: row.id,
  label: row.label,
  sub: row.sub,
  image: row.image,
})

interface LockCreateViewProps {
  shop: string
  shopName: string
  onBack: () => void
  /** The lock was saved: what the backend says it did. */
  onDone: (message: string) => void
  onDirtyChange?: (dirty: boolean) => void
}

/**
 * Add lock, in place of the list. Everything the lock needs is chosen from what the API has:
 * **products** (every product of the store listed with a checkbox, a search, Select all and
 * Load more), the **tags** (the store's tags suggested, or a new one typed) and the
 * **customers** who should get them, then the settings. One "Create lock" sends it all as a
 * single `POST /access/locks`, after a confirmation (it is also pushed to the store).
 */
export function LockCreateView({
  shop,
  shopName,
  onBack,
  onDone,
  onDirtyChange,
}: LockCreateViewProps) {
  const [draft, setDraft] = useState<LockDraft>(blankLockDraft)
  const [productSearch, setProductSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { save, clearError } = useSaveLock()

  const products = usePickProducts(shop, productSearch)
  const customers = usePickCustomers(shop, customerSearch)

  const problems = useMemo(() => validateLockDraft(draft), [draft])
  const shown = showErrors ? problems : {}

  const dirty = isLockDraftDirty(draft)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const productIds = useMemo(
    () => new Set(draft.products.map((item) => item.id)),
    [draft.products],
  )
  const customerIds = useMemo(
    () => new Set(draft.customers.map((item) => item.id)),
    [draft.customers],
  )

  const toggle = useCallback(
    (key: 'products' | 'customers', row: PickRow) =>
      setDraft((current) => {
        const has = current[key].some((item) => item.id === row.id)
        return {
          ...current,
          [key]: has
            ? current[key].filter((item) => item.id !== row.id)
            : [...current[key], toPicked(row)],
        }
      }),
    [],
  )

  const togglePage = useCallback(
    (key: 'products' | 'customers', rows: PickRow[], select: boolean) =>
      setDraft((current) => {
        const shownIds = new Set(rows.map((row) => row.id))
        const rest = current[key].filter((item) => !shownIds.has(item.id))
        return { ...current, [key]: select ? [...rest, ...rows.map(toPicked)] : rest }
      }),
    [],
  )

  function submit() {
    setShowErrors(true)
    if (Object.keys(validateLockDraft(draft)).length > 0) return
    clearError()
    setConfirming(true)
  }

  const noProducts = draft.products.length
  const noCustomers = draft.customers.length

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="flex flex-col gap-4"
    >
      {/* Stays in view while the form scrolls — under the top bar below `lg`, at the top of the
          form's own scroll box from `lg` up; it has the page's
          background and runs the full width of the page so nothing shows through behind it. */}
      <div className="bg-page sticky top-16 z-[9] -mx-3 flex flex-wrap items-center gap-3 px-3 py-3 sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:px-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.35rem] leading-tight font-bold">Add lock</h2>
          <p className="text-text-muted text-[0.82rem]">
            Hide products from everyone except customers who carry one of the tags — in{' '}
            <strong className="text-text">{shopName || 'the selected store'}</strong>.
          </p>
        </div>
        {/* The same controls as a product's page: icon-only ✓ / ✕ that name themselves in a
            tooltip, then the bordered "Back to list" button. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <IconAction
            label="Create lock"
            icon={CheckIcon}
            tone="primary"
            onClick={submit}
          />
          <IconAction label="Cancel" icon={XIcon} tone="danger" onClick={onBack} />
        </div>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold transition-colors"
        >
          <ArrowLeftIcon width={16} height={16} />
          <span className="hidden sm:inline" aria-hidden="true">
            Back to list
          </span>
        </button>
      </div>

      {showErrors && shown.form && <FormMessage tone="error">{shown.form}</FormMessage>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <LockCard
            title="Protected products"
            description="Choose the products to lock. Everyone without one of the tags below will not be able to open them."
            error={shown.products}
          >
            <div className="flex flex-col gap-4">
              <PickedChips
                noun="product"
                items={draft.products}
                onRemove={(id) =>
                  setDraft((current) => ({
                    ...current,
                    products: current.products.filter((item) => item.id !== id),
                  }))
                }
                onClear={() => setDraft((current) => ({ ...current, products: [] }))}
              />
              <PickList
                label="Products to lock"
                noun="product"
                rows={products.items.map(productRow)}
                selectedIds={productIds}
                onToggle={(row) => toggle('products', row)}
                onTogglePage={(rows, select) => togglePage('products', rows, select)}
                search={productSearch}
                onSearch={setProductSearch}
                searchPlaceholder="Search products by name, handle or tag…"
                total={products.total}
                isPending={products.isPending}
                isFetching={products.isFetching}
                isLoadingMore={products.isLoadingMore}
                hasMore={products.hasMore}
                onLoadMore={products.loadMore}
                error={products.error}
                onRetry={products.retry}
              />
              <p className="text-text-muted text-[0.75rem]">
                Up to {MAX_ITEMS} products at a time. Products already locked keep their
                lock; the tags and settings you choose are added to them.
              </p>
            </div>
          </LockCard>

          {/* Keys and Customers share a row, half the width each, from XL up. */}
          <div className="grid gap-4 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
            <LockCard
              title="Keys (tags)"
              description="A customer with one of these tags can open the locked products. Pick from the store’s tags, or type a new one."
              error={shown.tags}
            >
              <TagPicker
                shop={shop}
                selected={draft.tags}
                onAdd={(tags) =>
                  setDraft((current) => ({
                    ...current,
                    tags: [
                      ...current.tags,
                      ...tags.filter(
                        (tag) =>
                          !current.tags.some(
                            (have) => have.toLowerCase() === tag.toLowerCase(),
                          ),
                      ),
                    ],
                  }))
                }
                onRemove={(tag) =>
                  setDraft((current) => ({
                    ...current,
                    tags: current.tags.filter((have) => have !== tag),
                  }))
                }
              />
              <p className="text-text-muted mt-3 text-[0.75rem]">
                With no tag, the products are locked to signed-in customers only.
              </p>
            </LockCard>

            <LockCard
              title="Customers (optional)"
              description="Give these customers the tags above so they can open the locked products straight away."
              error={shown.customers}
            >
              <div className="flex flex-col gap-4">
                <PickedChips
                  noun="customer"
                  items={draft.customers}
                  onRemove={(id) =>
                    setDraft((current) => ({
                      ...current,
                      customers: current.customers.filter((item) => item.id !== id),
                    }))
                  }
                  onClear={() => setDraft((current) => ({ ...current, customers: [] }))}
                />
                <PickList
                  label="Customers to give the tags to"
                  noun="customer"
                  rows={customers.items.map(customerRow)}
                  selectedIds={customerIds}
                  onToggle={(row) => toggle('customers', row)}
                  onTogglePage={(rows, select) => togglePage('customers', rows, select)}
                  search={customerSearch}
                  onSearch={setCustomerSearch}
                  searchPlaceholder="Search customers by name, email or tag…"
                  total={customers.total}
                  isPending={customers.isPending}
                  isFetching={customers.isFetching}
                  isLoadingMore={customers.isLoadingMore}
                  hasMore={customers.hasMore}
                  onLoadMore={customers.loadMore}
                  error={customers.error}
                  onRetry={customers.retry}
                />
                <p className="text-text-muted text-[0.75rem]">
                  Up to {MAX_ITEMS} customers at a time, all linked to Shopify. A customer
                  who already has a tag is not given it twice.
                </p>
              </div>
            </LockCard>
          </div>

          <LockMessageCard
            options={draft.options}
            onChange={(patch) =>
              setDraft((current) => ({
                ...current,
                options: { ...current.options, ...patch },
              }))
            }
          />
        </div>

        {/* Settings follow the page (below the sticky header); a short window scrolls them. */}
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100svh-12rem)] lg:overflow-y-auto">
          <LockSettingsCard
            options={draft.options}
            onChange={(patch) =>
              setDraft((current) => ({
                ...current,
                options: { ...current.options, ...patch },
              }))
            }
          />
          <LockAdvancedCard
            options={draft.options}
            onChange={(patch) =>
              setDraft((current) => ({
                ...current,
                options: { ...current.options, ...patch },
              }))
            }
          />
        </div>
      </div>

      {confirming && (
        <LockConfirmDialog
          title={
            noProducts > 0
              ? `Lock ${noProducts.toLocaleString('en-GB')} product${noProducts === 1 ? '' : 's'}?`
              : `Give ${noCustomers.toLocaleString('en-GB')} customer${noCustomers === 1 ? '' : 's'} the tags?`
          }
          confirmLabel="Yes, create lock"
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            const result = await save(buildLockBody(draft, shop))
            setConfirming(false)
            onDone(result.message)
          }}
        >
          <p>
            Are you sure you want to do this? These changes will also be updated in
            Shopify
            {shopName ? ` (${shopName})` : ''}.
          </p>
          <ul className="text-text list-disc pl-5">
            {noProducts > 0 && (
              <li>{noProducts.toLocaleString('en-GB')} product(s) locked</li>
            )}
            {noCustomers > 0 && (
              <li>{noCustomers.toLocaleString('en-GB')} customer(s) given the tags</li>
            )}
            <li>
              {draft.tags.length > 0
                ? `Tags: ${draft.tags.join(', ')}`
                : 'No tags: signed-in customers only'}
            </li>
            {!draft.options.enabled && <li>The lock is switched off</li>}
          </ul>
        </LockConfirmDialog>
      )}
    </form>
  )
}
