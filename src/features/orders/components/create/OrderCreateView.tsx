import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../../app/store/shopSlice.ts'
import { ConfirmCancelDialog } from '../../../../components/ui/ConfirmCancelDialog.tsx'
import { Dialog } from '../../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import {
  EyeIcon,
  InfoIcon,
  ShoppingCartIcon,
  SpinnerIcon,
} from '../../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../../components/ui/SelectField.tsx'
import { useShops } from '../../../../hooks/useShops.ts'
import { currencySymbol, formatPrice } from '../../../../lib/format.ts'
import type { OrderCreateResult } from '../../../../lib/api/endpoints.ts'
import { useCreateOrder } from '../../hooks/useCreateOrder.ts'
import {
  blankOrderDraft,
  buildOrderBody,
  FIELD,
  isOrderDirty,
  orderTotals,
  validateOrderDraft,
  type DraftLine,
  type OrderDraft,
} from '../../utils/orderDraft.ts'
import { IconTile, SECONDARY_BUTTON } from './formParts.tsx'
import { OrderCustomerCard, OrderShippingCard } from './OrderCustomerCards.tsx'
import { OrderLinesCard } from './OrderLinesCard.tsx'
import { OrderPaymentCard, OrderSummaryCard } from './OrderSummaryCards.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface OrderCreateViewProps {
  onBack: () => void
  /** Tells the page whether the form holds anything typed (its tab asks before closing). */
  onDirtyChange?: (dirty: boolean) => void
  /** The store made the order; `shop` is the store it was made in. */
  onCreated: (result: OrderCreateResult, shop: string) => void
}

/**
 * "Add order": one page in place of the list. Sections in a wide column — Customer, Add Products,
 * Shipping & Delivery, Payment & Details — with the Order Summary beside them, in view while the
 * form scrolls; the store is chosen in the page's heading. Nothing is sent until **Create order**, which
 * checks every field first (going to the first problem), then asks — the order is also made in
 * Shopify — and only "Yes, create" sends one `POST /orders`. A refusal keeps everything typed
 * and shows the backend's message.
 */
export function OrderCreateView({
  onBack,
  onCreated,
  onDirtyChange,
}: OrderCreateViewProps) {
  const { shops, selected } = useShops()
  const { create, isCreating, error, clearError } = useCreateOrder()
  const [draft, setDraft] = useState<OrderDraft>(blankOrderDraft)
  const [showErrors, setShowErrors] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // Counts the Create presses a problem stopped, so the page goes to the first problem each time.
  const [stopped, setStopped] = useState(0)

  const usable = useMemo(() => {
    const live = shops.filter((shop) => shop.connected && shop.is_active)
    return live.length > 0 ? live : shops
  }, [shops])
  const shopOptions: SelectOption[] = usable.map((shop) => ({
    value: shopValue(shop),
    label: shopLabel(shop),
  }))
  const defaultShop = selected !== ALL_SHOPS ? selected : (shopOptions[0]?.value ?? '')
  const shop = draft.shop || defaultShop
  const effective: OrderDraft = useMemo(() => ({ ...draft, shop }), [draft, shop])
  const problems = useMemo(() => validateOrderDraft(effective), [effective])
  const errors = showErrors ? problems : {}
  const store = shops.find((candidate) => shopValue(candidate) === shop)
  const currency = store?.currency ?? null
  const symbol = currencySymbol(currency)

  function update(patch: Partial<OrderDraft>) {
    clearError()
    // A different store has other products: the lines picked from the old one go.
    if (patch.shop !== undefined && patch.shop !== shop) {
      setDraft((current) => ({
        ...current,
        ...patch,
        lines: current.lines.filter((line) => line.kind === 'custom'),
      }))
      return
    }
    setDraft((current) => ({ ...current, ...patch }))
  }

  function updateLines(change: (current: DraftLine[]) => DraftLine[]) {
    clearError()
    setDraft((current) => ({ ...current, lines: change(current.lines) }))
  }

  const dirty = isOrderDirty(draft)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const [discarding, setDiscarding] = useState(false)
  function back() {
    if (dirty) setDiscarding(true)
    else onBack()
  }

  /** From the summary: the customer goes, and the search is ready for another. */
  function changeCustomer() {
    update({ customer: blankOrderDraft().customer })
    document.getElementById('order-customer-search')?.focus()
  }

  function submit() {
    setShowErrors(true)
    if (Object.keys(problems).length > 0) {
      setStopped((count) => count + 1)
      return
    }
    setConfirming(true)
  }

  async function confirmCreate() {
    try {
      const result = await create(buildOrderBody(effective))
      setConfirming(false)
      onCreated(result, shop)
    } catch {
      // The backend's message shows in the question, which stays open.
    }
  }

  // On a long page the first problem can be out of sight: go to it.
  const sectionRef = useRef<HTMLElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (stopped === 0) return
    const field = sectionRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (field) field.focus()
    else if (typeof messageRef.current?.scrollIntoView === 'function') {
      messageRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [stopped])

  const totals = orderTotals(effective)
  return (
    <section
      ref={sectionRef}
      aria-label="Add order"
      aria-busy={isCreating}
      // `relative` keeps the visually hidden labels (sr-only) inside this box.
      className="relative flex w-full flex-col gap-5 lg:min-h-full"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <IconTile icon={ShoppingCartIcon} large />
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[1.5rem] leading-tight font-bold">Add order</h2>
          <p className="text-text-muted m-0 text-[0.85rem]">
            Create a new order with products and shipping details
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-3">
          <div className="flex w-56 max-w-full flex-col gap-1">
            <SelectField
              compact
              id={FIELD.shop}
              label="Store"
              value={effective.shop}
              options={shopOptions}
              onChange={(next) => update({ shop: next })}
            />
            {errors[FIELD.shop] && (
              <p role="alert" className="text-danger text-[0.76rem]">
                {errors[FIELD.shop]}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={back}
            disabled={isCreating}
            className={SECONDARY_BUTTON}
          >
            <EyeIcon width={16} height={16} />
            View Orders
          </button>
        </div>
      </div>

      <div ref={messageRef} className="flex flex-col gap-2 empty:hidden">
        {showErrors && Object.keys(problems).length > 0 && (
          <FormMessage tone="error">
            Fix the highlighted fields to create the order.
          </FormMessage>
        )}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <OrderCustomerCard draft={effective} errors={errors} update={update} />
          <OrderLinesCard
            lines={effective.lines}
            shop={shop}
            currency={currency}
            symbol={symbol}
            errors={errors}
            onChange={updateLines}
          />
          <OrderShippingCard
            draft={effective}
            errors={errors}
            update={update}
            symbol={symbol}
          />
          <OrderPaymentCard draft={effective} errors={errors} update={update} />
        </div>

        <OrderSummaryCard
          draft={effective}
          currency={currency}
          isCreating={isCreating}
          onChangeCustomer={changeCustomer}
          onCreate={submit}
        />
      </div>

      {confirming && (
        <Dialog
          role="alertdialog"
          title="Create this order?"
          icon={<InfoIcon width={20} height={20} />}
          onClose={() => !isCreating && setConfirming(false)}
          closeDisabled={isCreating}
          footer={
            <>
              <button
                type="button"
                autoFocus
                disabled={isCreating}
                onClick={() => setConfirming(false)}
                className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => void confirmCreate()}
                className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
              >
                {isCreating && (
                  <SpinnerIcon width={14} height={14} className="animate-spin" />
                )}
                {isCreating ? 'Creating…' : 'Yes, create'}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-[0.88rem]">
            <p className="m-0 font-semibold">
              Are you sure you want to create this order?
            </p>
            <p className="text-text-muted m-0">It will also be created in Shopify.</p>
            <dl className="border-border bg-surface/40 m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border p-3 text-[0.82rem]">
              <dt className="text-text-muted">Store</dt>
              <dd className="m-0">{store ? shopLabel(store) : shop}</dd>
              <dt className="text-text-muted">Items</dt>
              <dd className="m-0">
                {totals.items} ({effective.lines.length}{' '}
                {effective.lines.length === 1 ? 'line' : 'lines'})
              </dd>
              {effective.customer.email.trim() && (
                <>
                  <dt className="text-text-muted">Customer</dt>
                  <dd className="m-0 break-all">{effective.customer.email.trim()}</dd>
                </>
              )}
              <dt className="text-text-muted">Payment</dt>
              <dd className="m-0">
                {effective.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'}
                {effective.paymentMethod.trim()
                  ? ` · ${effective.paymentMethod.trim()}`
                  : ''}
              </dd>
              <dt className="text-text-muted">Estimated total</dt>
              <dd className="m-0 font-semibold">{formatPrice(totals.total, currency)}</dd>
            </dl>
            {error && <FormMessage tone="error">{error}</FormMessage>}
          </div>
        </Dialog>
      )}

      {discarding && (
        <ConfirmCancelDialog
          title="Discard this new order?"
          question=""
          detail="What you entered will be lost."
          keepLabel="Keep editing"
          confirmLabel="Yes, discard"
          onConfirm={() => {
            setDiscarding(false)
            onBack()
          }}
          onKeep={() => setDiscarding(false)}
        />
      )}
    </section>
  )
}
