import { ArrowLeftIcon, HistoryIcon } from '../../../components/ui/icons.tsx'
import type { StockLocation } from '../../../lib/api/endpoints.ts'
import { StockHistory } from './StockHistory.tsx'

/**
 * The stock history, shown in place of the list and laid out like a product's page: a bordered
 * article with a header (an accent icon tile, the title as the page's `h1`, a line saying what the
 * page holds and the bordered **Back to list** button), and the content on the soft panel below — the same frame as one variant's page (`VariantStockView`).
 */
export function StockHistoryView({
  locations,
  onBack,
}: {
  locations: StockLocation[]
  onBack: () => void
}) {
  return (
    <article className="border-border bg-bg overflow-hidden rounded-2xl border">
      <header className="flex items-start gap-4 p-4 sm:p-6">
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent flex size-12 shrink-0 items-center justify-center rounded-xl sm:size-16"
        >
          <HistoryIcon width={26} height={26} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-snug font-bold sm:text-2xl">Stock history</h1>
          <p className="text-text-muted mt-1 text-[0.85rem]">
            Every change made to the stock — who made it, where, how the quantity moved
            and whether Shopify has confirmed it.
          </p>
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
      </header>

      <div className="border-border bg-surface flex flex-col gap-4 border-t p-3 sm:p-5">
        <StockHistory locations={locations} />
      </div>
    </article>
  )
}
