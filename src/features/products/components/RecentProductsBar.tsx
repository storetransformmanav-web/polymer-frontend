import { HistoryIcon, ProductsIcon, XIcon } from '../../../components/ui/icons.tsx'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'

interface RecentProductsBarProps {
  recent: ProductListItem[]
  selectedId: string | null
  onOpen: (product: ProductListItem) => void
  onClear: () => void
}

/**
 * Quick-return strip of recently opened products (newest first). Reopening
 * one is instant — the full product is already in memory.
 */
export function RecentProductsBar({
  recent,
  selectedId,
  onOpen,
  onClear,
}: RecentProductsBarProps) {
  if (recent.length === 0) return null

  return (
    <nav
      aria-label="Recently viewed products"
      className="border-border bg-bg flex items-stretch rounded-xl border"
    >
      <span className="border-accent text-text flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[0.85rem] font-semibold">
        <ProductsIcon width={16} height={16} />
        <span className="hidden sm:inline">All Products</span>
      </span>
      <span className="border-border text-text-muted flex shrink-0 items-center border-r px-3">
        <HistoryIcon width={16} height={16} aria-label="Recently viewed" />
      </span>

      <ul className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-1 overflow-x-auto px-2 [&::-webkit-scrollbar]:hidden">
        {recent.map((product) => (
          <li key={product.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onOpen(product)}
              aria-current={product.id === selectedId ? 'true' : undefined}
              title={product.title}
              className={`hover:bg-surface flex cursor-pointer items-center gap-2 rounded-lg border-none px-2.5 py-1.5 text-[0.8rem] transition-colors ${
                product.id === selectedId ? 'bg-accent-tint' : 'bg-transparent'
              }`}
            >
              <ProductsIcon width={14} height={14} className="text-accent" />
              <span className="text-text-muted text-[0.62rem] font-bold tracking-wider uppercase">
                Product
              </span>
              <span className="max-w-32 truncate font-semibold">{product.handle}</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onClear}
        className="border-border text-text-muted hover:text-danger flex shrink-0 cursor-pointer items-center gap-1.5 border-0 border-l bg-transparent px-4 text-[0.72rem] font-bold tracking-wide uppercase transition-colors"
      >
        <XIcon width={14} height={14} />
        Clear
      </button>
    </nav>
  )
}
