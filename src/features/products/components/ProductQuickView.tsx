import { useEffect, useRef, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { Button } from '../../../components/ui/Button.tsx'
import { ChevronRightIcon, XIcon } from '../../../components/ui/icons.tsx'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { formatDate } from '../../../lib/format.ts'
import { formatPriceRange, statusLabel, statusTone } from '../utils/format.ts'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { ProductImage } from './ProductImage.tsx'

interface ProductQuickViewProps {
  product: ProductListItem
  onClose: () => void
  /** Leaves the panel and opens the full details page. */
  onOpenDetails: () => void
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-b py-2.5 text-[0.88rem] last:border-b-0">
      <dt className="text-text-muted shrink-0">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  )
}

const dateOrDash = (value: string | null) => (value ? formatDate(value) : '—')

/**
 * Right-hand quick-view panel opened from a row's image. Everything shown
 * is already in the list row, so it appears with no request; "Open full
 * details" continues to the product's page (whose data is prefetched on
 * hover). Closes on Escape, the backdrop or the close button, and returns
 * focus to whatever opened it.
 */
export function ProductQuickView({
  product,
  onClose,
  onOpenDetails,
}: ProductQuickViewProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (opener?.isConnected) opener.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button
        type="button"
        aria-label="Close quick view"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default border-none bg-black/40 transition-opacity duration-300 starting:opacity-0"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${product.title} quick view`}
        className="bg-bg border-border relative flex h-full w-full flex-col border-l shadow-[0_0_40px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out motion-reduce:transition-none sm:max-w-md starting:translate-x-full"
      >
        <header className="border-border flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-text-muted text-xs font-bold tracking-wider uppercase">
            Quick view
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-text-muted hover:text-text hover:bg-surface inline-flex cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-1.5 transition-colors"
          >
            <XIcon />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          <ProductImage src={product.image_url} alt={product.title} size="xl" />

          <div className="flex flex-col gap-2">
            <h3 className="text-lg leading-snug font-semibold">{product.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(product.status)}>
                {statusLabel(product.status)}
              </Badge>
              <span className="text-text-muted flex items-center gap-1 font-mono text-[0.8rem]">
                {product.handle}
                <CopyButton value={product.handle} label={`Copy ${product.handle}`} />
              </span>
            </div>
          </div>

          <dl className="border-border rounded-xl border px-4">
            <Row label="Price">{formatPriceRange(product)}</Row>
            <Row label="Stock">
              {product.total_inventory === null
                ? '—'
                : product.total_inventory <= 0
                  ? 'Out of stock'
                  : `${product.total_inventory.toLocaleString('en-GB')} in stock`}
            </Row>
            <Row label="Variants">{product.variants_count}</Row>
            <Row label="Vendor">{product.vendor ?? '—'}</Row>
            <Row label="Product type">{product.product_type || '—'}</Row>
            <Row label="Category">{product.category_name ?? '—'}</Row>
            <Row label="Updated">{dateOrDash(product.shopify_updated_at)}</Row>
          </dl>

          {product.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <li
                  key={tag}
                  className="bg-accent-tint text-accent rounded-full px-2.5 py-0.5 text-xs font-semibold"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-border border-t p-4">
          <Button type="button" className="w-full" onClick={onOpenDetails}>
            Open full details <ChevronRightIcon />
          </Button>
        </footer>
      </aside>
    </div>
  )
}
