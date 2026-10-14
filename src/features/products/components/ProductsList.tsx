import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { AlertTriangleIcon, EyeIcon, SearchIcon } from '../../../components/ui/icons.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { formatPriceRange, statusLabel, statusTone } from '../utils/format.ts'
import { ProductImage } from './ProductImage.tsx'

const TH_BASE =
  'text-text-muted border-border bg-accent-tint/60 sticky top-0 z-[1] border-b px-3.5 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_RIGHT = `${TH_BASE} text-right`
const TH_CENTER = `${TH_BASE} text-center`
// No alignment here: a `text-left` in the base would fight (and beat) the
// `text-center` / `text-right` added per cell. Cells default to left.
const TD = 'px-3.5 py-2.5 whitespace-nowrap'
const SKELETON_ROWS = 8

interface ProductsListProps {
  items: ProductListItem[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  /** Opens a product's details page. Only the View button / card triggers this. */
  onOpen: (product: ProductListItem) => void
  /** Clicking a row's image opens the quick-view side panel. */
  onQuickView: (product: ProductListItem) => void
  /** Hover/focus on View or an image: start loading details so opening is instant. */
  onPrefetch: (id: string) => void
  onRetry: () => void
  onClearFilters: () => void
}

function Stock({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-text-muted">—</span>
  if (value <= 0) return <span className="text-danger font-semibold">Out of stock</span>
  return (
    <span>
      {value.toLocaleString('en-GB')}
      {suffix}
    </span>
  )
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-14 text-center text-[0.9rem]">
      {children}
    </div>
  )
}

const MESSAGE_BUTTON =
  'border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors'

/**
 * The results area: a sticky-header table from `md` up, stacked cards
 * below it. Handles the loading skeleton, error and empty states itself so
 * the page only passes data in.
 */
export function ProductsList({
  items,
  isPending,
  error,
  hasFilters,
  isStale,
  onOpen,
  onQuickView,
  onPrefetch,
  onRetry,
  onClearFilters,
}: ProductsListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (error) {
    return (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load products</p>
          <p>{error}</p>
        </div>
        <button type="button" className={MESSAGE_BUTTON} onClick={onRetry}>
          Try again
        </button>
      </Message>
    )
  }

  if (!isPending && items.length === 0) {
    return (
      <Message>
        <SearchIcon width={28} height={28} />
        <div>
          <p className="text-text font-semibold">No products found</p>
          <p>Nothing matches the current search and filters.</p>
        </div>
        {hasFilters && (
          <button type="button" className={MESSAGE_BUTTON} onClick={onClearFilters}>
            Clear all filters
          </button>
        )}
      </Message>
    )
  }

  const dim = isStale ? 'opacity-60' : ''

  if (!isDesktop) {
    return (
      <ul
        aria-busy={isPending || isStale}
        className={`flex flex-col gap-2.5 p-3 transition-opacity duration-150 ${dim}`}
      >
        {isPending && (
          <li role="status" className="sr-only">
            Loading products…
          </li>
        )}
        {isPending
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li
                key={index}
                aria-hidden="true"
                className="border-border bg-surface h-24 animate-pulse rounded-xl border"
              />
            ))
          : items.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onOpen(product)}
                  onPointerEnter={() => onPrefetch(product.id)}
                  onFocus={() => onPrefetch(product.id)}
                  aria-label={`View ${product.title}`}
                  className="border-border bg-bg hover:border-accent flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors"
                >
                  <ProductImage src={product.image_url} alt="" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="line-clamp-2 text-[0.88rem] font-semibold">
                      {product.title}
                    </span>
                    <span className="text-text-muted truncate text-[0.78rem]">
                      {[product.vendor, product.product_type]
                        .filter(Boolean)
                        .join(' · ') || product.handle}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.82rem]">
                      <span className="font-semibold">{formatPriceRange(product)}</span>
                      <Stock value={product.total_inventory} suffix=" in stock" />
                      <Badge tone={statusTone(product.status)}>
                        {statusLabel(product.status)}
                      </Badge>
                    </span>
                  </span>
                </button>
              </li>
            ))}
      </ul>
    )
  }

  return (
    <div
      aria-busy={isPending || isStale}
      className="max-h-[min(68svh,760px)] overflow-auto"
    >
      <table
        className={`w-full min-w-[720px] border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            {/* Narrow columns get a fixed width so Product takes the spare space. */}
            <th className={`${TH} w-20`}>Image</th>
            <th className={TH}>Product</th>
            <th className={`${TH_CENTER} w-28`}>Variants</th>
            <th className={`${TH} w-32`}>Status</th>
            <th className={`${TH_RIGHT} w-36`}>Inventory</th>
            <th className={`${TH_RIGHT} w-44`}>Price</th>
            <th className={`${TH_CENTER} w-20`}>View</th>
          </tr>
        </thead>
        <tbody>
          {isPending && (
            <tr className="sr-only">
              <td role="status">Loading products…</td>
            </tr>
          )}
          {isPending
            ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} aria-hidden="true" className="border-border border-b">
                  {Array.from({ length: 7 }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((product) => (
                <tr
                  key={product.id}
                  className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                >
                  <td className={TD}>
                    <button
                      type="button"
                      aria-label={`Quick view ${product.title}`}
                      onClick={() => onQuickView(product)}
                      onPointerEnter={() => onPrefetch(product.id)}
                      onFocus={() => onPrefetch(product.id)}
                      className="focus-visible:outline-accent block cursor-zoom-in rounded-md border-none bg-transparent p-0 transition-transform duration-150 hover:scale-110 focus-visible:outline-2"
                    >
                      <ProductImage src={product.image_url} alt="" />
                    </button>
                  </td>
                  <td className={TD}>
                    <span
                      className="block max-w-64 truncate font-medium 2xl:max-w-[26rem]"
                      title={product.title}
                    >
                      {product.title}
                    </span>
                  </td>
                  <td className={`${TD} text-center`}>
                    {product.variants_count.toLocaleString('en-GB')}
                  </td>
                  <td className={TD}>
                    <Badge tone={statusTone(product.status)}>
                      {statusLabel(product.status)}
                    </Badge>
                  </td>
                  <td className={`${TD} text-right`}>
                    <Stock value={product.total_inventory} />
                  </td>
                  <td className={`${TD} text-right font-semibold`}>
                    {formatPriceRange(product)}
                  </td>
                  <td className={`${TD} text-center`}>
                    <button
                      type="button"
                      aria-label={`View ${product.title}`}
                      onClick={() => onOpen(product)}
                      onPointerEnter={() => onPrefetch(product.id)}
                      onFocus={() => onPrefetch(product.id)}
                      className="text-text-muted hover:text-accent inline-flex cursor-pointer items-center justify-center border-none bg-none p-1 transition-colors"
                    >
                      <EyeIcon />
                    </button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
