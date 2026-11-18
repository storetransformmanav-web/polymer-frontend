import { useState } from 'react'
import {
  ChevronDownIcon,
  MinusIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from '../../../../components/ui/icons.tsx'
import { formatPrice } from '../../../../lib/format.ts'
import type { ProductListItem } from '../../../../lib/api/endpoints.ts'
import { usePickProducts, usePickVariants } from '../../hooks/useOrderPickers.ts'
import {
  FIELD,
  orderSubtotal,
  withoutOne,
  withVariant,
  type DraftLine,
  type OrderErrors,
} from '../../utils/orderDraft.ts'
import {
  FIELD_INPUT,
  FormSection,
  ICON_BUTTON,
  SearchDropdown,
  Thumb,
} from './formParts.tsx'

const TH = 'text-text px-3 py-2.5 text-[0.76rem] font-semibold whitespace-nowrap'
const TD = 'border-border border-t px-3 py-3 align-middle text-[0.85rem]'
const STEP =
  'border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-40'

type Change = (current: DraftLine[]) => DraftLine[]

/** The quantity of a variant already on the order, or 0. */
const quantityOf = (lines: DraftLine[] | undefined, variantId: string) => {
  const line = lines?.find((candidate) => candidate.variantId === variantId)
  const quantity = line ? Number.parseInt(line.quantity, 10) : 0
  return Number.isFinite(quantity) ? quantity : 0
}

/**
 * A variant's **Add** button; once it is on the order the button gives way to `[−] 1 [+]` —
 * one more, one fewer, and at 1 the − takes it off the order.
 */
function AddOrCounter({
  name,
  quantity,
  onChange,
  variantId,
  add,
}: {
  name: string
  quantity: number
  onChange: (change: Change) => void
  variantId: string
  add: () => void
}) {
  if (quantity <= 0) {
    return (
      <button
        type="button"
        aria-label={`Add ${name}`}
        onClick={add}
        className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border-none px-2.5 text-[0.78rem] font-semibold transition-colors"
      >
        <PlusIcon width={14} height={14} />
        Add
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label={`Quantity of ${name}`}
      className="flex items-center gap-1.5"
    >
      <button
        type="button"
        aria-label={quantity === 1 ? `Remove ${name}` : `One fewer of ${name}`}
        onClick={() => onChange((lines) => withoutOne(lines, variantId))}
        className={STEP}
      >
        <MinusIcon width={14} height={14} />
      </button>
      <span
        aria-live="polite"
        className="w-7 text-center text-[0.85rem] font-semibold tabular-nums"
      >
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`One more of ${name}`}
        onClick={add}
        className={STEP}
      >
        <PlusIcon width={14} height={14} />
      </button>
    </div>
  )
}

/** One product found by the search: opening it lists its variants, each with Add / a counter. */
function ProductResult({
  product,
  lines,
  onAdd,
}: {
  product: ProductListItem
  lines?: DraftLine[]
  onAdd: (lines: Change) => void
}) {
  const [open, setOpen] = useState(false)
  const details = usePickVariants(open ? product.id : null)
  // A variant known to have no stock is not offered (one with no stock figure — not tracked — is).
  const allVariants = details.data?.variants ?? []
  const variants = allVariants.filter(
    (variant) => variant.inventory_quantity == null || variant.inventory_quantity > 0,
  )
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
              {allVariants.length === 0
                ? 'This product has no variants.'
                : 'None of its variants is in stock.'}
            </p>
          )}
          <ul className="m-0 flex list-none flex-col p-0">
            {variants.map((variant) => {
              const name =
                variant.title && variant.title !== 'Default Title' ? variant.title : ''
              const label = `${product.title}${name ? ` – ${name}` : ''}`
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
                  <AddOrCounter
                    name={label}
                    quantity={quantityOf(lines, variant.id)}
                    variantId={variant.id}
                    onChange={onAdd}
                    add={() =>
                      onAdd((current) =>
                        withVariant(current, {
                          variantId: variant.id,
                          productTitle: product.title,
                          variantTitle: name,
                          sku: variant.sku ?? '',
                          price: variant.price,
                          imageUrl: variant.image_url ?? product.image_url,
                        }),
                      )
                    }
                  />
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </li>
  )
}

/** A line's quantity: − and + beside a box that can also be typed in; − at 1 removes the line. */
function QuantityStepper({
  id,
  name,
  value,
  error,
  onChange,
  onRemove,
}: {
  id: string
  name: string
  value: string
  error?: string
  onChange: (value: string) => void
  onRemove: () => void
}) {
  const current = Number.parseInt(value, 10)
  const known = Number.isFinite(current)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          aria-label={known && current <= 1 ? `Remove ${name}` : `One fewer of ${name}`}
          onClick={() =>
            known && current <= 1 ? onRemove() : onChange(String(known ? current - 1 : 1))
          }
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
 * A search over the store's products **that are in stock** whose list drops down under the box as
 * soon as it is focused — every one, A–Z, 20 at a time as it is scrolled — and narrows as you type;
 * opening one lists its variants that are in stock. With `lines`, a variant already on the
 * order shows its quantity counter in place of **Add**.
 */
export function ProductSearch({
  id,
  shop,
  noMatchHint,
  onAdd,
  lines,
}: {
  id: string
  shop: string
  /** Said after "No product matches …". */
  noMatchHint: string
  onAdd: (update: Change) => void
  lines?: DraftLine[]
}) {
  const [text, setText] = useState('')
  // The list is asked for the moment the box is focused: every product in stock, A–Z.
  const [activated, setActivated] = useState(false)
  const found = usePickProducts(shop, text, activated)
  const products = found.data?.pages.flatMap((page) => page.items) ?? []
  const total = found.data?.pages[0]?.total ?? 0
  const searching = text.trim() !== ''

  return (
    <SearchDropdown
      id={id}
      label="Search products"
      value={text}
      placeholder="Search products by name or SKU"
      onChange={setText}
      showWhenEmpty
      onActivate={() => setActivated(true)}
      onListScroll={(list) => {
        if (
          found.hasNextPage &&
          !found.isFetchingNextPage &&
          list.scrollTop + list.clientHeight >= list.scrollHeight - 80
        ) {
          void found.fetchNextPage()
        }
      }}
    >
      {found.isFetching && products.length === 0 && (
        <p className="text-text-muted flex items-center gap-2 px-3 py-3 text-[0.8rem]">
          <SpinnerIcon width={14} height={14} className="animate-spin" />
          {searching ? 'Searching products…' : 'Loading products…'}
        </p>
      )}
      {found.isError && (
        <p role="alert" className="text-danger px-3 py-3 text-[0.8rem]">
          Could not load the products. Try again in a moment.
        </p>
      )}
      {found.data && products.length === 0 && !found.isFetching && (
        <p className="text-text-muted px-3 py-3 text-[0.8rem]">
          {searching
            ? `No product in stock matches “${text.trim()}”. ${noMatchHint}`
            : 'No product is in stock.'}
        </p>
      )}
      {products.length > 0 && (
        <ul aria-label="Products found" className="m-0 list-none p-0">
          {products.map((product) => (
            <ProductResult
              key={product.id}
              product={product}
              lines={lines}
              onAdd={onAdd}
            />
          ))}
        </ul>
      )}
      {products.length > 0 && (
        <div className="border-border bg-bg text-text-muted sticky bottom-0 flex items-center justify-between border-t px-3 py-1.5 text-[0.74rem]">
          <span>
            {products.length.toLocaleString('en-GB')} of {total.toLocaleString('en-GB')}{' '}
            in stock
          </span>
          {found.isFetchingNextPage ? (
            <span className="flex items-center gap-1">
              <SpinnerIcon width={11} height={11} className="animate-spin" />
              Loading more…
            </span>
          ) : found.hasNextPage ? (
            <span>Scroll for more</span>
          ) : null}
        </div>
      )}
    </SearchDropdown>
  )
}

/**
 * "Items": only the store's own products can be ordered. A search lists matching products with
 * their picture, title and price; opening one lists its variants, each with **Add**, which becomes
 * a `[−] n [+]` counter (the same variant is never a second line). The chosen items are a table:
 * product, quantity, unit price, total and a bin, with the subtotal under it. Each line is sent as
 * its variant's id and quantity — the store prices it.
 */
export function OrderLinesCard({
  lines,
  shop,
  currency,
  errors,
  onChange,
}: {
  lines: DraftLine[]
  shop: string
  currency: string | null
  errors: OrderErrors
  onChange: (update: Change) => void
}) {
  const remove = (key: string) =>
    onChange((current) => current.filter((candidate) => candidate.key !== key))

  return (
    <FormSection title="Items">
      <ProductSearch
        id="order-product-search"
        shop={shop}
        noMatchHint="Only products of the store can be added."
        onAdd={onChange}
        lines={lines}
      />

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
          {errors[FIELD.lines] ?? 'No items yet. Search for a product above and add it.'}
        </p>
      ) : (
        <>
          <div className="border-border overflow-x-auto rounded-lg border">
            <table
              aria-label="Order items"
              className="w-full min-w-[620px] border-collapse"
            >
              <thead className="bg-table-head">
                <tr>
                  <th className={`${TH} text-left`}>Product</th>
                  <th className={`${TH} w-44 text-center`}>Quantity</th>
                  <th className={`${TH} w-28 text-right`}>Unit Price</th>
                  <th className={`${TH} w-28 text-right`}>Total</th>
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
                  return (
                    <tr key={line.key}>
                      <td className={TD}>
                        <div className="flex items-center gap-3">
                          <Thumb url={line.imageUrl} alt="" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-semibold">
                              {line.productTitle}
                            </span>
                            <span className="text-text-muted text-[0.76rem]">
                              {[line.variantTitle, line.sku ? `SKU: ${line.sku}` : '']
                                .filter(Boolean)
                                .join(' · ') || 'Default variant'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={TD}>
                        <QuantityStepper
                          id={FIELD.lineQuantity(line.key)}
                          name={line.productTitle}
                          value={line.quantity}
                          error={errors[FIELD.lineQuantity(line.key)]}
                          onChange={(value) =>
                            onChange((current) =>
                              current.map((candidate) =>
                                candidate.key === line.key
                                  ? { ...candidate, quantity: value }
                                  : candidate,
                              ),
                            )
                          }
                          onRemove={() => remove(line.key)}
                        />
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {formatPrice(line.price, currency)}
                      </td>
                      <td className={`${TD} text-right font-semibold tabular-nums`}>
                        {lineTotal === null ? '—' : formatPrice(lineTotal, currency)}
                      </td>
                      <td className={`${TD} text-center`}>
                        <button
                          type="button"
                          aria-label={`Delete ${line.productTitle}`}
                          onClick={() => remove(line.key)}
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
    </FormSection>
  )
}
