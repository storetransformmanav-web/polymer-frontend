import { useState } from 'react'
import {
  ChevronDownIcon,
  ImageIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
} from '../../../../components/ui/icons.tsx'
import { formatPrice } from '../../../../lib/format.ts'
import { safeUrl } from '../../../../lib/safeUrl.ts'
import type { ProductListItem } from '../../../../lib/api/endpoints.ts'
import {
  PICK_LIMIT,
  usePickProducts,
  usePickVariants,
} from '../../hooks/useOrderPickers.ts'
import {
  blankCustomLine,
  FIELD,
  withVariant,
  type CustomLine,
  type DraftLine,
  type OrderErrors,
} from '../../utils/orderDraft.ts'
import {
  CheckField,
  FIELD_INPUT,
  FormCard,
  ICON_BUTTON,
  MoneyInput,
  TEXT_BUTTON,
} from './formParts.tsx'

const THUMB =
  'border-border bg-surface flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border'

function Thumb({ url, alt }: { url: string | null | undefined; alt: string }) {
  const src = safeUrl(url)
  return (
    <span className={THUMB}>
      {src ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <ImageIcon width={16} height={16} className="text-text-muted" />
      )}
    </span>
  )
}

/** One product found by the search: opening it lists its variants, each with Add. */
function ProductResult({
  product,
  onAdd,
}: {
  product: ProductListItem
  onAdd: (lines: (current: DraftLine[]) => DraftLine[]) => void
}) {
  const [open, setOpen] = useState(false)
  const details = usePickVariants(open ? product.id : null)
  const variants = details.data?.variants ?? []
  const range =
    product.price_min && product.price_max && product.price_min !== product.price_max
      ? `${formatPrice(product.price_min, product.currency)} – ${formatPrice(product.price_max, product.currency)}`
      : formatPrice(product.price_min, product.currency)

  return (
    <li className="border-border border-t first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="hover:bg-accent-tint/60 flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-3 py-2 text-left transition-colors"
      >
        <Thumb url={product.image_url} alt="" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[0.85rem] font-semibold">{product.title}</span>
          <span className="text-text-muted text-[0.76rem]">
            {range} · {product.variants_count}{' '}
            {product.variants_count === 1 ? 'variant' : 'variants'}
          </span>
        </span>
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-text-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="bg-surface/40 px-3 pb-2">
          {details.isPending && (
            <p className="text-text-muted flex items-center gap-2 py-2 text-[0.8rem]">
              <SpinnerIcon width={14} height={14} className="animate-spin" />
              Loading its variants…
            </p>
          )}
          {details.isError && (
            <p role="alert" className="text-danger py-2 text-[0.8rem]">
              Could not load this product’s variants. Try again in a moment.
            </p>
          )}
          {details.data && variants.length === 0 && (
            <p className="text-text-muted py-2 text-[0.8rem]">
              This product has no variants.
            </p>
          )}
          <ul className="m-0 flex list-none flex-col p-0">
            {variants.map((variant) => {
              const name =
                variant.title && variant.title !== 'Default Title' ? variant.title : ''
              return (
                <li
                  key={variant.id}
                  className="flex items-center gap-3 py-1.5 pl-[3.25rem] text-[0.82rem]"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{name || product.title}</span>
                    <span className="text-text-muted text-[0.74rem]">
                      {[
                        variant.sku ? `SKU ${variant.sku}` : '',
                        variant.inventory_quantity != null
                          ? `${variant.inventory_quantity} in stock`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatPrice(variant.price, variant.currency ?? product.currency)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add ${product.title}${name ? ` – ${name}` : ''}`}
                    onClick={() =>
                      onAdd((lines) =>
                        withVariant(lines, {
                          variantId: variant.id,
                          productTitle: product.title,
                          variantTitle: name,
                          sku: variant.sku ?? '',
                          price: variant.price,
                          imageUrl: variant.image_url ?? product.image_url,
                        }),
                      )
                    }
                    className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border-none px-2.5 text-[0.78rem] font-semibold transition-colors"
                  >
                    <PlusIcon width={14} height={14} />
                    Add
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </li>
  )
}

/**
 * "Products": a search over the store's products (nothing is asked until something is typed);
 * opening one lists its variants, and **Add** puts a variant on the order (again: one more of
 * it). **Add custom item** adds a line that is not a product of the store, with its own name,
 * price and flags. Each line has its quantity and a bin.
 */
export function OrderLinesCard({
  lines,
  shop,
  currency,
  symbol,
  errors,
  onChange,
}: {
  lines: DraftLine[]
  shop: string
  currency: string | null
  symbol: string
  errors: OrderErrors
  onChange: (update: (current: DraftLine[]) => DraftLine[]) => void
}) {
  const [text, setText] = useState('')
  const found = usePickProducts(shop, text)
  const searching = text.trim().length > 0
  const products = found.data?.items ?? []
  const total = found.data?.total ?? 0

  const setLine = (key: string, patch: Partial<CustomLine> | { quantity: string }) =>
    onChange((current) =>
      current.map((line) =>
        line.key === key ? ({ ...line, ...patch } as DraftLine) : line,
      ),
    )

  return (
    <FormCard
      title="Products"
      headingAbove
      action={
        <button
          type="button"
          onClick={() => onChange((current) => [...current, blankCustomLine()])}
          className={TEXT_BUTTON}
        >
          <PlusIcon width={14} height={14} />
          Add custom item
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="order-product-search" className="sr-only">
          Search products
        </label>
        <div className="relative">
          <SearchIcon
            width={16}
            height={16}
            aria-hidden="true"
            className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            id="order-product-search"
            type="search"
            autoComplete="off"
            value={text}
            placeholder="Search products by name or SKU"
            onChange={(event) => setText(event.target.value)}
            className={`${FIELD_INPUT} pl-9`}
          />
        </div>
        {searching && (
          <div className="border-border overflow-hidden rounded-lg border">
            {found.isFetching && products.length === 0 && (
              <p className="text-text-muted flex items-center gap-2 px-3 py-3 text-[0.8rem]">
                <SpinnerIcon width={14} height={14} className="animate-spin" />
                Searching products…
              </p>
            )}
            {found.isError && (
              <p role="alert" className="text-danger px-3 py-3 text-[0.8rem]">
                Could not search the products. Try again in a moment.
              </p>
            )}
            {found.data && products.length === 0 && !found.isFetching && (
              <p className="text-text-muted px-3 py-3 text-[0.8rem]">
                No product matches “{text.trim()}”. Add it as a custom item instead.
              </p>
            )}
            {products.length > 0 && (
              <ul aria-label="Products found" className="m-0 list-none p-0">
                {products.map((product) => (
                  <ProductResult key={product.id} product={product} onAdd={onChange} />
                ))}
              </ul>
            )}
            {total > PICK_LIMIT && (
              <p className="border-border text-text-muted border-t px-3 py-2 text-[0.76rem]">
                Showing {PICK_LIMIT} of {total.toLocaleString('en-GB')} — keep typing to
                narrow the list.
              </p>
            )}
          </div>
        )}
      </div>

      {lines.length === 0 ? (
        <p
          id={FIELD.lines}
          tabIndex={-1}
          aria-invalid={errors[FIELD.lines] ? true : undefined}
          className={`rounded-lg border border-dashed px-4 py-6 text-center text-[0.85rem] outline-none ${
            errors[FIELD.lines]
              ? 'border-danger text-danger'
              : 'border-border text-text-muted'
          }`}
        >
          {errors[FIELD.lines] ??
            'No items yet. Search for a product above, or add a custom item.'}
        </p>
      ) : (
        <ul aria-label="Order items" className="m-0 flex list-none flex-col gap-0 p-0">
          {lines.map((line) => {
            const quantityId = FIELD.lineQuantity(line.key)
            const quantity = Number.parseInt(line.quantity, 10)
            const lineTotal =
              Number.isFinite(quantity) && line.price.trim()
                ? Number.parseFloat(line.price) * quantity
                : null
            const name =
              line.kind === 'variant'
                ? line.productTitle
                : line.title.trim() || 'Custom item'
            return (
              <li
                key={line.key}
                className="border-border flex flex-col gap-3 border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start gap-3">
                  {line.kind === 'variant' ? (
                    <Thumb url={line.imageUrl} alt="" />
                  ) : (
                    <span className={THUMB}>
                      <PlusIcon width={16} height={16} className="text-text-muted" />
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {line.kind === 'variant' ? (
                      <>
                        <span className="truncate text-[0.88rem] font-semibold">
                          {name}
                        </span>
                        <span className="text-text-muted text-[0.76rem]">
                          {[line.variantTitle, line.sku ? `SKU ${line.sku}` : '']
                            .filter(Boolean)
                            .join(' · ') || 'Product of the store'}
                        </span>
                        <span className="text-text-muted text-[0.76rem]">
                          {formatPrice(line.price, currency)} each
                        </span>
                      </>
                    ) : (
                      <span className="text-text-muted text-[0.76rem] font-semibold tracking-wide uppercase">
                        Custom item
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex w-24 flex-col gap-1">
                      <label htmlFor={quantityId} className="sr-only">
                        Quantity of {name}
                      </label>
                      <input
                        id={quantityId}
                        inputMode="numeric"
                        autoComplete="off"
                        value={line.quantity}
                        aria-invalid={errors[quantityId] ? true : undefined}
                        aria-describedby={
                          errors[quantityId] ? `${quantityId}-error` : undefined
                        }
                        onChange={(event) =>
                          setLine(line.key, { quantity: event.target.value })
                        }
                        className={`${FIELD_INPUT} text-right tabular-nums`}
                      />
                      {errors[quantityId] && (
                        <span
                          id={`${quantityId}-error`}
                          role="alert"
                          className="text-danger text-[0.74rem]"
                        >
                          {errors[quantityId]}
                        </span>
                      )}
                    </div>
                    <span className="w-24 pt-2.5 text-right text-[0.88rem] font-semibold tabular-nums">
                      {lineTotal === null ? '—' : formatPrice(lineTotal, currency)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={() =>
                        onChange((current) =>
                          current.filter((candidate) => candidate.key !== line.key),
                        )
                      }
                      className={`${ICON_BUTTON} mt-1`}
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  </div>
                </div>

                {line.kind === 'custom' && (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:pl-[3.25rem]">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={FIELD.lineTitle(line.key)}
                        className="text-[0.78rem] font-semibold"
                      >
                        Item name
                      </label>
                      <input
                        id={FIELD.lineTitle(line.key)}
                        autoComplete="off"
                        value={line.title}
                        placeholder="e.g. Custom printing"
                        aria-invalid={
                          errors[FIELD.lineTitle(line.key)] ? true : undefined
                        }
                        onChange={(event) =>
                          setLine(line.key, { title: event.target.value })
                        }
                        className={FIELD_INPUT}
                      />
                      {errors[FIELD.lineTitle(line.key)] && (
                        <span role="alert" className="text-danger text-[0.74rem]">
                          {errors[FIELD.lineTitle(line.key)]}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={FIELD.linePrice(line.key)}
                        className="text-[0.78rem] font-semibold"
                      >
                        Price
                      </label>
                      <MoneyInput
                        id={FIELD.linePrice(line.key)}
                        value={line.price}
                        symbol={symbol}
                        error={errors[FIELD.linePrice(line.key)]}
                        onChange={(price) => setLine(line.key, { price })}
                      />
                      {errors[FIELD.linePrice(line.key)] && (
                        <span
                          id={`${FIELD.linePrice(line.key)}-error`}
                          role="alert"
                          className="text-danger text-[0.74rem]"
                        >
                          {errors[FIELD.linePrice(line.key)]}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2">
                      <CheckField
                        id={`order-line-${line.key}-taxable`}
                        label="Charge tax"
                        checked={line.taxable}
                        onChange={(taxable) => setLine(line.key, { taxable })}
                      />
                      <CheckField
                        id={`order-line-${line.key}-shipping`}
                        label="Needs shipping"
                        checked={line.requiresShipping}
                        onChange={(requiresShipping) =>
                          setLine(line.key, { requiresShipping })
                        }
                      />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </FormCard>
  )
}
