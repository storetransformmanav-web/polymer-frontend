import { ChevronDownIcon, StoreIcon } from '../../components/ui/icons.tsx'
import { SELECT_THEME } from '../../components/ui/SelectField.tsx'
import { ALL_SHOPS, shopLabel, shopValue, type ShopState } from '../store/shopSlice.ts'
import type { Shop } from '../../lib/api/endpoints.ts'

interface ShopSwitcherProps {
  shops: Shop[]
  status: ShopState['status']
  /** A shop's value (see `shopValue`) or `ALL_SHOPS`. */
  selected: string
  onSelect: (value: string) => void
}

/**
 * The store dropdown in the top bar: "All shops" first, then each store by
 * name, in the order the backend lists them. Native `<select>` for speed,
 * accessibility and mobile; only the chrome is styled — and, where the browser
 * allows, the open list is themed like the filter dropdowns (`SELECT_THEME`). Renders nothing if
 * the list couldn't be loaded — the app still works on "all".
 */
export function ShopSwitcher({ shops, status, selected, onSelect }: ShopSwitcherProps) {
  if (status === 'error') return null

  if (status !== 'ready') {
    return (
      <div role="status" className="flex items-center">
        <span className="sr-only">Loading shops…</span>
        <div
          aria-hidden="true"
          className="bg-border/70 h-9 w-32 animate-pulse rounded-lg sm:w-44"
        />
      </div>
    )
  }

  return (
    <div className="relative min-w-0">
      <label htmlFor="shop-switcher" className="sr-only">
        Shop
      </label>
      <StoreIcon
        width={16}
        height={16}
        className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
      />
      <select
        id="shop-switcher"
        value={selected}
        onChange={(event) => onSelect(event.target.value)}
        className={`border-border bg-bg text-text hover:border-accent focus:border-accent focus:outline-accent-tint h-9 w-full max-w-[11rem] min-w-0 cursor-pointer appearance-none truncate rounded-lg border pr-8 pl-9 text-[0.85rem] font-semibold transition-colors outline-none focus:outline-2 sm:max-w-[16rem] ${SELECT_THEME}`}
      >
        <option value={ALL_SHOPS}>All shops</option>
        {shops.map((shop) => (
          <option key={shop.id} value={shopValue(shop)}>
            {shopLabel(shop)}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        width={14}
        height={14}
        className="text-text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      />
    </div>
  )
}
