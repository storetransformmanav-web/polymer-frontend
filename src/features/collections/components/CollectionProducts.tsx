import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { HighlightQuery, Highlight } from '../../../components/ui/Highlight.tsx'
import {
  AlertTriangleIcon,
  ArrowUpDownIcon,
  PlusIcon,
  ProductsIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ROW_ACTION_DANGER } from '../../../components/ui/rowActions.ts'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type {
  CollectionDetail,
  CollectionProduct,
  CollectionProductSort,
} from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'
import type {
  CollectionProductsState,
  useCollectionDetails,
} from '../hooks/useCollections.ts'
import { isSmart } from '../utils/collectionDraft.ts'
import { CollectionConfirm } from './CollectionConfirm.tsx'
import { ProductPicker, type PickedProduct } from './CollectionFormParts.tsx'
import { CollectionImage, Message } from './CollectionParts.tsx'
import { count, MESSAGE_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../utils/ui.ts'

const SORT_OPTIONS: SelectOption[] = [
  { value: 'position', label: 'Collection order' },
  { value: 'title', label: 'Title' },
  { value: 'price', label: 'Price' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'created', label: 'Date created' },
  { value: 'updated', label: 'Last updated' },
]

const ORDER_OPTIONS: SelectOption[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
]

const TH =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-2.5 align-middle text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase'
const TD = 'px-3 py-2 align-middle whitespace-nowrap'

const statusTone = (status: string | null | undefined) => {
  const value = (status ?? '').toUpperCase()
  return value === 'ACTIVE' ? 'success' : value === 'ARCHIVED' ? 'danger' : 'neutral'
}

function priceOf(product: CollectionProduct, currency: string | null | undefined) {
  const min = formatPrice(product.price_min, currency)
  const max = formatPrice(product.price_max, currency)
  return max !== '—' && max !== min ? `${min} – ${max}` : min
}

type Details = ReturnType<typeof useCollectionDetails>

/**
 * The **Products** tab: one page at a time (`products_page`; the next pages, a search or a sort
 * come from `GET /collections/{id}/products`), searchable by title or SKU and sortable. A manual
 * collection can take products in (**Add products** — those already in it are hidden) and give
 * them up (the bin on a row), each after a question; an automated one is filled by its conditions.
 */
export function CollectionProducts({
  collection,
  details,
  canManage,
  onSave,
}: {
  collection: CollectionDetail
  details: Details
  canManage: boolean
  /** Sends `products_add` / `products_remove`; resolves with the backend's message. */
  onSave: (change: {
    products_add?: string[]
    products_remove?: string[]
  }) => Promise<void>
}) {
  const manual = !isSmart(collection.collection_type)
  const editable = manual && canManage && collection.editable !== false
  const table = details.table
  const page = details.productsPage
  const currency = collection.shop?.currency
  const [search, setSearch] = useDebouncedField(table.search, (value) =>
    details.setTable({ search: value }),
  )
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<PickedProduct[]>([])
  const [confirmAdd, setConfirmAdd] = useState(false)
  const [removing, setRemoving] = useState<CollectionProduct | null>(null)
  const inCollection = new Set(details.products.map((product) => product.id))
  const shop = collection.shop?.key ?? ''

  return (
    <section
      className={`${DETAIL_CARD} flex flex-col overflow-hidden`}
      aria-label="Products"
    >
      <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-end">
        <label className="border-border bg-surface focus-within:border-accent flex h-10 min-w-0 items-center gap-2 rounded-lg border px-3 lg:flex-1">
          <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
          <span className="sr-only">Search the collection’s products</span>
          <input
            type="search"
            value={search}
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product title or SKU…"
            className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch('')}
              className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0.5"
            >
              <XIcon width={14} height={14} />
            </button>
          )}
        </label>
        <div className="grid grid-cols-2 gap-3 sm:w-[24rem]">
          <SelectField
            compact
            id="collection-products-sort"
            label="Sort by"
            icon={ArrowUpDownIcon}
            value={table.sort}
            options={SORT_OPTIONS}
            onChange={(sort) => details.setTable({ sort: sort as CollectionProductSort })}
          />
          <SelectField
            compact
            id="collection-products-order"
            label="Order"
            icon={ArrowUpDownIcon}
            value={table.order}
            options={ORDER_OPTIONS}
            onChange={(order) =>
              details.setTable({ order: order as CollectionProductsState['order'] })
            }
          />
        </div>
        {editable && (
          <button
            type="button"
            className={adding ? SECONDARY_BUTTON : PRIMARY_BUTTON}
            aria-expanded={adding}
            onClick={() => {
              setAdding(!adding)
              setPicked([])
            }}
          >
            {adding ? (
              <XIcon width={16} height={16} />
            ) : (
              <PlusIcon width={16} height={16} />
            )}
            {adding ? 'Close' : 'Add products'}
          </button>
        )}
      </div>

      {!manual && (
        <p className="text-text-muted border-border m-0 border-t px-4 py-2.5 text-[0.8rem] sm:px-5">
          This collection is automated: its products come from its conditions. Change the
          conditions on the Overview tab, or use Refresh after Shopify has matched them.
        </p>
      )}

      {adding && editable && (
        <div className="border-border bg-surface flex flex-col gap-3 border-t p-4 sm:p-5">
          <h3 className="m-0 text-[0.95rem] font-bold">Add products</h3>
          <ProductPicker
            shop={shop}
            picked={picked}
            onChange={setPicked}
            exclude={inCollection}
            idPrefix="collection-add"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => {
                setAdding(false)
                setPicked([])
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={picked.length === 0}
              onClick={() => setConfirmAdd(true)}
            >
              <PlusIcon width={16} height={16} />
              {picked.length > 0
                ? `Add ${picked.length} to collection`
                : 'Add to collection'}
            </button>
          </div>
        </div>
      )}

      <div className="border-border relative overflow-auto border-t">
        {details.productsFetching && (
          <div
            aria-hidden="true"
            className="bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 animate-pulse"
          />
        )}
        {details.productsError ? (
          <Message>
            <AlertTriangleIcon width={28} height={28} className="text-danger" />
            <p>{details.productsError}</p>
            <button
              type="button"
              className={MESSAGE_BUTTON}
              onClick={details.retryProducts}
            >
              Try again
            </button>
          </Message>
        ) : !details.productsPending && details.products.length === 0 ? (
          <Message>
            <ProductsIcon width={28} height={28} />
            <p>
              {table.search.trim()
                ? 'No product in this collection matches your search.'
                : manual
                  ? 'This collection has no products yet.'
                  : 'No product matches the conditions yet. Shopify can take a few seconds — use Refresh.'}
            </p>
          </Message>
        ) : (
          <HighlightQuery query={table.search}>
            <table className="w-full min-w-[820px] border-collapse text-[0.85rem]">
              <thead>
                <tr>
                  <th className={`${TH} w-14 text-center`}>#</th>
                  <th className={`${TH} text-left`}>Product</th>
                  <th className={`${TH} text-left`}>SKU</th>
                  <th className={`${TH} text-center`}>Status</th>
                  <th className={`${TH} text-right`}>Inventory</th>
                  <th className={`${TH} text-right`}>Price</th>
                  {editable && <th className={`${TH} w-20 text-center`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {details.productsPending
                  ? Array.from({ length: 6 }, (_, row) => (
                      <tr key={row} aria-hidden="true" className="border-border border-b">
                        {Array.from({ length: editable ? 7 : 6 }, (_, cell) => (
                          <td key={cell} className={TD}>
                            <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : details.products.map((product) => (
                      <tr
                        key={product.id}
                        className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                      >
                        <td className={`${TD} text-text-muted text-center`}>
                          {product.position ?? '—'}
                        </td>
                        <td className={`${TD} max-w-0`}>
                          <span className="flex items-center gap-3">
                            <CollectionImage src={product.image_url} />
                            <span className="flex min-w-0 flex-col">
                              <Link
                                to={`/products/${encodeURIComponent(product.id)}`}
                                className="text-text hover:text-accent truncate font-semibold no-underline"
                                title={product.title}
                              >
                                <Highlight text={product.title} />
                              </Link>
                              <span className="text-text-muted truncate text-[0.75rem]">
                                {[product.vendor, product.product_type]
                                  .filter(Boolean)
                                  .join(' · ') || '—'}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className={`${TD} text-text-muted`}>
                          {product.sku ? <Highlight text={product.sku} /> : '—'}
                        </td>
                        <td className={`${TD} text-center`}>
                          {product.status ? (
                            <Badge tone={statusTone(product.status)}>
                              {product.status.toLowerCase()}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={`${TD} text-right`}>
                          {count(product.total_inventory)}
                        </td>
                        <td className={`${TD} text-right font-semibold`}>
                          {priceOf(product, currency)}
                        </td>
                        {editable && (
                          <td className={`${TD} text-center`}>
                            <button
                              type="button"
                              aria-label={`Remove ${product.title} from the collection`}
                              title="Remove from collection"
                              onClick={() => setRemoving(product)}
                              className={ROW_ACTION_DANGER}
                            >
                              <TrashIcon width={15} height={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
              </tbody>
            </table>
          </HighlightQuery>
        )}
      </div>

      {page && page.total > 0 && (
        <PaginationFooter
          page={page.page}
          pageSize={table.pageSize}
          total={page.total}
          totalPages={page.total_pages}
          onPageChange={(next) => details.setTable({ page: next })}
          onPageSizeChange={(pageSize) => details.setTable({ pageSize })}
        />
      )}

      {confirmAdd && (
        <CollectionConfirm
          title={`Add ${picked.length} ${picked.length === 1 ? 'product' : 'products'} to “${collection.title}”?`}
          confirmLabel="Yes, add"
          onClose={() => setConfirmAdd(false)}
          onConfirm={async () => {
            await onSave({ products_add: picked.map((item) => item.id) })
            setConfirmAdd(false)
            setAdding(false)
            setPicked([])
          }}
        >
          <p className="m-0 break-words">{picked.map((item) => item.title).join(', ')}</p>
          <p className="text-text-muted m-0">
            These changes will also be made in Shopify.
          </p>
        </CollectionConfirm>
      )}
      {removing && (
        <CollectionConfirm
          title={`Remove “${removing.title}” from “${collection.title}”?`}
          confirmLabel="Remove"
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await onSave({ products_remove: [removing.id] })
            setRemoving(null)
          }}
        >
          <p className="m-0">
            The product stays in the store; it is only taken out of this collection. These
            changes will also be made in Shopify.
          </p>
        </CollectionConfirm>
      )}
      {page === null && details.productsPending && (
        <FormMessage tone="info">Loading products…</FormMessage>
      )}
    </section>
  )
}
