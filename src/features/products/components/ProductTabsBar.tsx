import { HistoryIcon, ProductsIcon, XIcon } from '../../../components/ui/icons.tsx'
import type { ProductTab } from '../hooks/useProductTabs.ts'

interface ProductTabsBarProps {
  tabs: ProductTab[]
  /** The product whose details are showing, or null on the list. */
  activeId: string | null
  onShowList: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onClear: () => void
}

const label = (tab: ProductTab) => tab.handle ?? `${tab.id.slice(0, 8)}…`

/**
 * Browser-style strip of opened products: "All Products" returns to the
 * list, each product is a tab you can switch to or close. Switching is
 * instant — details are cached in Redux. Hidden until there's a tab.
 */
export function ProductTabsBar({
  tabs,
  activeId,
  onShowList,
  onSelect,
  onClose,
  onClear,
}: ProductTabsBarProps) {
  if (tabs.length === 0) return null

  return (
    <nav
      aria-label="Open products"
      className="border-border bg-bg flex items-stretch rounded-xl border"
    >
      <button
        type="button"
        onClick={onShowList}
        aria-label="All Products"
        aria-current={activeId === null ? 'page' : undefined}
        className={`text-text flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-4 py-3 text-[0.85rem] font-semibold transition-colors ${
          activeId === null ? 'border-accent' : 'hover:border-border border-transparent'
        }`}
      >
        <ProductsIcon width={16} height={16} />
        <span className="hidden sm:inline" aria-hidden="true">
          All Products
        </span>
      </button>

      <span className="border-border text-text-muted flex shrink-0 items-center border-r px-3">
        <HistoryIcon width={16} height={16} aria-label="Opened products" />
      </span>

      <ul className="flex min-w-0 flex-1 [scrollbar-width:none] items-stretch gap-1 overflow-x-auto px-2 [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <li
              key={tab.id}
              className={`flex shrink-0 items-center border-b-2 ${
                active ? 'border-accent' : 'border-transparent'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                aria-current={active ? 'page' : undefined}
                title={tab.title ?? undefined}
                className="hover:bg-surface flex cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent py-1.5 pr-1 pl-2.5 text-[0.8rem] transition-colors"
              >
                <ProductsIcon width={14} height={14} className="text-accent" />
                <span className="text-text-muted text-[0.62rem] font-bold tracking-wider uppercase">
                  Product
                </span>
                <span className="max-w-32 truncate font-semibold">{label(tab)}</span>
              </button>
              <button
                type="button"
                aria-label={`Close ${label(tab)}`}
                onClick={() => onClose(tab.id)}
                className="text-text-muted hover:text-danger flex cursor-pointer items-center border-none bg-transparent p-1.5 transition-colors"
              >
                <XIcon width={12} height={12} />
              </button>
            </li>
          )
        })}
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
