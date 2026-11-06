import { useState } from 'react'
import {
  ChevronDownIcon,
  MinusIcon,
  PlusIcon,
  ProductsIcon,
  SpinnerIcon,
  TrashIcon,
} from '../../../../components/ui/icons.tsx'
import { formatPrice } from '../../../../lib/format.ts'
import type { ProductListItem } from '../../../../lib/api/endpoints.ts'
import {
  PICK_LIMIT,
  usePickProducts,
  usePickVariants,
} from '../../hooks/useOrderPickers.ts'
import {
  blankCustomLine,
  FIELD,
  orderSubtotal,
  withVariant,
  type CustomLine,
  type DraftLine,
  type OrderErrors,
} from '../../utils/orderDraft.ts'
import {
  CheckField,
  FIELD_INPUT,
  ICON_BUTTON,
  MoneyInput,
  OrderSection,
  PRIMARY_BUTTON,
  SearchDropdown,
  Thumb,
} from './formParts.tsx'

const TH = 'text-text px-3 py-2.5 text-[0.76rem] font-semibold whitespace-nowrap'
const TD = 'border-border border-t px-3 py-3 align-top text-[0.85rem]'
const STEP =
  'border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-40'

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
  const stock = product.total_inventory

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
          <span className="truncate text-[0.88rem] font-semibold">{product.title}</span>
          <span className="text-text-muted truncate text-[0.76rem]">
            {[
              `${product.variants_count} ${product.variants_count === 1 ? 'variant' : 'variants'}`,
              product.vendor,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-[0.85rem] font-semibold tabular-nums">{range}</span>
          {stock != null && (
            <span
              className={`flex items-center gap-1 text-[0.74rem] ${stock > 0 ? 'text-accent' : 'text-danger'}`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${stock > 0 ? 'bg-accent' : 'bg-danger'}`}
              />
              {stock > 0 ? 'In stock' : 'Out of stock'}
            </span>
          )}
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

/** A line's quantity: − and + beside a box that can also be typed in. */
function QuantityStepper({
  id,
  name,
  value,
  error,
  onChange,
}: {
  id: string
  name: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const current = Number.parseInt(value, 10)
  const known = Number.isFinite(current)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          aria-label={`One fewer of ${name}`}
          disabled={known && current <= 1}
          onClick={() => onChange(String(known ? current - 1 : 1))}
          className={STEP}
        >
          <MinusIcon width={14} height={14} />
        </button>
        <label htmlFor={id} className="sr-only">
          Quantity of {name}
        </label>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD_INPUT} h-8 w-14 px-1 text-center tabular-nums`}
        />
        <button
          type="button"
          aria-label={`One more of ${name}`}
          onClick={() => onChange(String(known ? current + 1 : 1))}
          className={STEP}
        >
          <PlusIcon width={14} height={14} />
        </button>
      </div>
      {error && (
        <span id={`${id}-error`} role="alert" className="text-danger text-[0.74rem]">
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * A search over the store's products (nothing is asked until something is typed) whose matches
 * drop down under the box; opening one lists its variants, each with **Add**.
 */
export function ProductSearch({
  id,
  shop,
  noMatchHint,
  onAdd,
}: {
  id: string
  shop: string
  /** Said after "No product matches …". */
  noMatchHint: string
  onAdd: (update: (current: DraftLine[]) => DraftLine[]) => void
}) {
  const [text, setText] = useState('')
  const found = usePickProducts(shop, text)
  const products = found.data?.items ?? []
  const total = found.data?.total ?? 0

  return (
    <SearchDropdown
      id={id}
      label="Search products"
      value={text}
      placeholder="Search products by name or SKU"
      onChange={setText}
    >
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
          No product matches “{text.trim()}”. {noMatchHint}
        </p>
      )}
      {products.length > 0 && (
        <ul aria-label="Products found" className="m-0 list-none p-0">
          {products.map((product) => (
            <ProductResult key={product.id} product={product} onAdd={onAdd} />
          ))}
        </ul>
      )}
      {total > PICK_LIMIT && (
        <p className="border-border text-text-muted border-t px-3 py-2 text-[0.76rem]">
          Showing {PICK_LIMIT} of {total.toLocaleString('en-GB')} — keep typing to narrow
          the list.
        </p>
      )}
    </SearchDropdown>
  )
}

/**
 * "Add Products": a search over the store's products (nothing is asked until something is typed)
 * whose matches drop down under the box; opening one lists its variants, and **Add** puts a
 * variant on the order (again: one more of it). **Add custom item** adds a line that is not a
 * product of the store, with its own name, price and flags. The lines are a table: product,
 * quantity, unit price, total and a bin, with the subtotal under it.
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
  const setLine = (key: string, patch: Partial<CustomLine> | { quantity: string }) =>
    onChange((current) =>
      current.map((line) =>
        line.key === key ? ({ ...line, ...patch } as DraftLine) : line,
      ),
    )

  return (
    <OrderSection
      icon={ProductsIcon}
      title="Add Products"
      subtitle="Search and add products to this order"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <ProductSearch
          id="order-product-search"
          shop={shop}
          noMatchHint="Add it as a custom item instead."
          onAdd={onChange}
        />
        <button
          type="button"
          onClick={() => onChange((current) => [...current, blankCustomLine()])}
          className={PRIMARY_BUTTON}
        >
          <PlusIcon width={16} height={16} />
          Add custom item
        </button>
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
        <>
          <div className="border-border overflow-x-auto rounded-lg border">
            <table
              aria-label="Order items"
              className="w-full min-w-[660px] border-collapse"
            >
              <thead className="bg-table-head">
                <tr>
                  <th className={`${TH} text-left`}>Product</th>
                  <th className={`${TH} w-44 text-center`}>Quantity</th>
                  <th className={`${TH} w-32 text-right`}>Unit Price</th>
                  <th className={`${TH} w-24 text-right`}>Total</th>
                  <th className={`${TH} w-16 text-center`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const quantity = Number.parseInt(line.quantity, 10)
                  const lineTotal =
                    Number.isFinite(quantity) && line.price.trim()
                      ? Number.parseFloat(line.price) * quantity
                      : null
                  const name =
                    line.kind === 'variant'
                      ? line.productTitle
                      : line.title.trim() || 'Custom item'
                  const titleId = FIELD.lineTitle(line.key)
                  const priceId = FIELD.linePrice(line.key)
                  return (
                    <tr key={line.key}>
                      <td className={TD}>
                        {line.kind === 'variant' ? (
                          <div className="flex items-center gap-3">
                            <Thumb url={line.imageUrl} alt="" />
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate font-semibold">{name}</span>
                              <span className="text-text-muted text-[0.76rem]">
                                {[line.variantTitle, line.sku ? `SKU: ${line.sku}` : '']
                                  .filter(Boolean)
                                  .join(' · ') || 'Product of the store'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-w-0 flex-col gap-2">
                            <label htmlFor={titleId} className="sr-only">
                              Item name
                            </label>
                            <input
                              id={titleId}
                              autoComplete="off"
                              value={line.title}
                              placeholder="Custom item, e.g. Custom printing"
                              aria-invalid={errors[titleId] ? true : undefined}
                              onChange={(event) =>
                                setLine(line.key, { title: event.target.value })
                              }
                              className={FIELD_INPUT}
                            />
                            {errors[titleId] && (
                              <span role="alert" className="text-danger text-[0.74rem]">
                                {errors[titleId]}
                              </span>
                            )}
                            <div className="flex flex-wrap gap-x-5 gap-y-2">
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
                      </td>
                      <td className={TD}>
                        <QuantityStepper
                          id={FIELD.lineQuantity(line.key)}
                          name={name}
                          value={line.quantity}
                          error={errors[FIELD.lineQuantity(line.key)]}
                          onChange={(value) => setLine(line.key, { quantity: value })}
                        />
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {line.kind === 'variant' ? (
                          formatPrice(line.price, currency)
                        ) : (
                          <div className="flex flex-col gap-1 text-left">
                            <MoneyInput
                              id={priceId}
                              label="Price"
                              value={line.price}
                              symbol={symbol}
                              error={errors[priceId]}
                              onChange={(price) => setLine(line.key, { price })}
                            />
                            {errors[priceId] && (
                              <span
                                id={`${priceId}-error`}
                                role="alert"
                                className="text-danger text-[0.74rem]"
                              >
                                {errors[priceId]}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className={`${TD} text-right font-semibold tabular-nums`}>
                        {lineTotal === null ? '—' : formatPrice(lineTotal, currency)}
                      </td>
                      <td className={`${TD} text-center`}>
                        <button
                          type="button"
                          aria-label={`Remove ${name}`}
                          onClick={() =>
                            onChange((current) =>
                              current.filter((candidate) => candidate.key !== line.key),
                            )
                          }
                          className={ICON_BUTTON}
                        >
                          <TrashIcon width={16} height={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="m-0 flex items-baseline justify-end gap-6">
            <span className="text-[0.88rem] font-semibold">Subtotal</span>
            <span className="text-[1.05rem] font-bold tabular-nums">
              {formatPrice(orderSubtotal(lines), currency)}
            </span>
          </p>
        </>
      )}
    </OrderSection>
  )
}
