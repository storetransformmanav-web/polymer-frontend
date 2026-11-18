import { useState } from 'react'
import { BoltIcon, HandIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import type { CollectionRules } from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { useRulePreview } from '../hooks/useCollections.ts'
import type { CollectionKind } from '../utils/collectionDraft.ts'
import { CollectionImage } from './CollectionParts.tsx'

const KINDS = [
  {
    kind: 'custom',
    label: 'Manual',
    icon: HandIcon,
    text: 'Pick the products yourself, one by one.',
  },
  {
    kind: 'smart',
    label: 'Smart',
    icon: BoltIcon,
    text: 'Conditions add the matching products on their own.',
  },
] as const

/**
 * The collection's type as a **Manual | Smart** toggle, made to sit in the header of the "Collection
 * type" card: the open one is a solid green pill. "Manual" is the API's `custom`, "Smart" its `smart`;
 * the type cannot be changed once the collection is made. Choosing one shows only that type's section
 * below the card.
 */
export function CollectionTypeToggle({
  kind,
  onChange,
}: {
  /** The chosen type, or null while none is chosen (neither button is on). */
  kind: CollectionKind | null
  onChange: (kind: CollectionKind) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Collection type"
      className="border-border bg-surface inline-flex gap-1 rounded-xl border p-1"
    >
      {KINDS.map((item) => {
        const active = item.kind === kind
        return (
          <button
            key={item.kind}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.kind)}
            className={`flex h-8 min-w-24 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3.5 text-[0.8rem] font-semibold transition-colors ${
              active
                ? 'bg-accent text-accent-contrast shadow-sm'
                : 'bg-bg text-text hover:bg-accent-tint/60'
            }`}
          >
            <item.icon width={14} height={14} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * **Matching products** of a Smart collection: once the conditions are complete (`rules` is not
 * null) the backend is asked which products they match (`POST /collections/rules/preview`) and they
 * are shown with their picture and title, a page at a time. Shopify does the matching, so what shows
 * here is what the collection will hold. Until the conditions are complete, or while the backend has
 * no such route yet, it says so instead of guessing.
 */
export function RulePreview({
  shop,
  rules,
}: {
  shop: string
  /** The complete conditions, or null while some are unfinished. */
  rules: CollectionRules | null
}) {
  const key = JSON.stringify(rules)
  // The page goes back to 1 whenever the conditions change.
  const [paging, setPaging] = useState({ key, page: 1, pageSize: 10 })
  const page = paging.key === key ? paging.page : 1
  const preview = useRulePreview(shop, rules, page, paging.pageSize)
  const move = (next: number) => setPaging({ ...paging, key, page: next })

  return (
    <section aria-label="Matching products" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h4 className="m-0 text-[0.85rem] font-bold">Matching products</h4>
        {preview.hasAnswer && !preview.unavailable && (
          <span className="bg-accent-tint text-accent rounded-full px-2 py-0.5 text-[0.72rem] font-bold">
            {preview.total.toLocaleString('en-GB')}
          </span>
        )}
        {preview.isLoading && (
          <SpinnerIcon width={14} height={14} className="text-text-muted animate-spin" />
        )}
      </div>

      {preview.hasAnswer && !preview.unavailable && preview.message && (
        <p className="text-text-muted m-0 text-[0.78rem]">{preview.message}</p>
      )}

      {rules === null ? (
        <p className="text-text-muted m-0 text-[0.82rem]">
          Complete the conditions above to see which products match them.
        </p>
      ) : preview.unavailable ? (
        <p
          role="note"
          className="border-warning/40 bg-warning-bg text-text m-0 rounded-lg border px-3 py-2.5 text-[0.82rem] leading-snug"
        >
          The live preview of matching products is not available yet. Shopify adds the
          matching products as soon as the collection is created.
        </p>
      ) : preview.error ? (
        <p role="alert" className="text-danger m-0 text-[0.82rem]">
          {`Could not load the matching products: ${preview.error}`}
        </p>
      ) : !preview.hasAnswer ? (
        <p className="text-text-muted m-0 text-[0.82rem]">
          Finding the matching products…
        </p>
      ) : preview.items.length === 0 ? (
        <p className="text-text-muted m-0 text-[0.82rem]">
          No product matches these conditions.
        </p>
      ) : (
        <div className="border-border-strong overflow-hidden rounded-xl border">
          <ul
            className="m-0 grid max-h-96 list-none grid-cols-1 gap-2 overflow-y-auto p-2 min-[560px]:grid-cols-2 xl:grid-cols-3"
            aria-label="Products that match the conditions"
          >
            {preview.items.map((item) => (
              <li
                key={item.id}
                className="border-border bg-bg flex items-center gap-2.5 rounded-lg border p-2"
              >
                <CollectionImage src={item.image_url} />
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[0.82rem] font-semibold"
                    title={item.title}
                  >
                    {item.title}
                  </span>
                  <span className="text-text-muted block truncate text-[0.72rem]">
                    {formatPrice(item.price_min, item.currency)}
                    {item.status ? ` · ${item.status.toLowerCase()}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {/* The same footer as the listing pages: the count, the page size and the page buttons. */}
          <PaginationFooter
            compact
            page={page}
            pageSize={paging.pageSize}
            total={preview.total}
            totalPages={preview.totalPages}
            onPageChange={move}
            onPageSizeChange={(pageSize) => setPaging({ key, page: 1, pageSize })}
          />
        </div>
      )}
    </section>
  )
}
