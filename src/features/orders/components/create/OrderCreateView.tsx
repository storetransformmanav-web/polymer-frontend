import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../../app/store/shopSlice.ts'
import { ConfirmCancelDialog } from '../../../../components/ui/ConfirmCancelDialog.tsx'
import { Dialog } from '../../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  InfoIcon,
  SpinnerIcon,
} from '../../../../components/ui/icons.tsx'
import { type SelectOption } from '../../../../components/ui/SelectField.tsx'
import { useShops } from '../../../../hooks/useShops.ts'
import { currencySymbol, formatPrice } from '../../../../lib/format.ts'
import type { OrderCreateResult } from '../../../../lib/api/endpoints.ts'
import { useCreateOrder } from '../../hooks/useCreateOrder.ts'
import {
  blankOrderDraft,
  buildOrderBody,
  firstStepWithProblem,
  isOrderDirty,
  ORDER_STEPS,
  problemList,
  orderTotals,
  PAYMENT_LABELS,
  stepOfField,
  stepProblems,
  validateOrderDraft,
  withCustomerNameOnAddress,
  type DraftLine,
  type OrderDraft,
  type OrderStepId,
} from '../../utils/orderDraft.ts'
import {
  OrderAddressSection,
  OrderCustomerSection,
  type LinkedCustomer,
} from './OrderCustomerCards.tsx'
import { OrderDetailsSection } from './OrderDetailsSection.tsx'
import { OrderLinesCard } from './OrderLinesCard.tsx'
import { OrderReviewStep } from './OrderReviewStep.tsx'
import { OrderStepper } from './OrderStepper.tsx'
import { OrderSummaryCard } from './OrderSummaryCard.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-5 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const NAV_PRIMARY = `${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent shadow-sm`
const NAV_SECONDARY = `${BUTTON} border-border bg-bg text-text hover:border-accent`
const BACK_TO_LIST =
  'bg-text text-bg inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border-none px-3.5 text-[0.8rem] font-semibold transition-opacity hover:opacity-85 disabled:pointer-events-none disabled:opacity-50'

const LAST_STEP = ORDER_STEPS.length - 1

interface OrderCreateViewProps {
  onBack: () => void
  /** Tells the page whether the form holds anything typed (its tab asks before closing). */
  onDirtyChange?: (dirty: boolean) => void
  /** The store made the order; `shop` is the store it was made in. */
  onCreated: (result: OrderCreateResult, shop: string) => void
}

/**
 * "Create Order" as a four-step wizard in place of the list, in one card: a header (the title and
 * **Back to list**), the stepper, the step's form in a box that scrolls on its own, and a foot
 * with **Cancel** / **Back** and **Next**.
 *
 * 1. **Order & Customer** — ORDER (store, payment status and method, discount codes, tags),
 *    CUSTOMER (an existing one from the store, or a new buyer's details) and NOTES.
 * 2. **Addresses** — the delivery address and the delivery's method and cost.
 * 3. **Items** — store products and custom items.
 * 4. **Review & Create** — everything that will be sent, with Edit buttons back to each step.
 *
 * **Next** checks only the step you are on and stops at its first problem; the stepper takes you
 * back to a step you reached. Nothing is sent until **Create order** on the last step, which
 * checks every field (going to the first step with a problem), then asks — the order is also
 * made in Shopify — and only "Yes, create" sends one `POST /orders`. A refusal keeps everything
 * typed and shows the backend's message.
 */
export function OrderCreateView({
  onBack,
  onCreated,
  onDirtyChange,
}: OrderCreateViewProps) {
  const { shops, selected } = useShops()
  const { create, isCreating, error, clearError } = useCreateOrder()
  const [draft, setDraft] = useState<OrderDraft>(blankOrderDraft)
  const [linked, setLinked] = useState<LinkedCustomer | null>(null)
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(0)
  // The steps whose problems are shown (a step is touched when Next is pressed on it).
  const [touched, setTouched] = useState<ReadonlySet<OrderStepId>>(new Set())
  const [confirming, setConfirming] = useState(false)
  // Counts the presses a problem stopped, so the page goes to the first problem each time.
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
  const errors = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(problems).filter(([field]) => touched.has(stepOfField(field))),
      ),
    [problems, touched],
  )
  const problemSteps = useMemo(
    () => new Set(Object.keys(errors).map(stepOfField)),
    [errors],
  )
  const store = shops.find((candidate) => shopValue(candidate) === shop)
  const storeName = store ? shopLabel(store) : shop
  const currency = store?.currency ?? null
  const symbol = currencySymbol(currency)
  const stepId = ORDER_STEPS[step].id
  const stepProblemList = problemList(effective, stepProblems(errors, stepId))

  function update(patch: Partial<OrderDraft>) {
    clearError()
    // A different store has other products (and variants): the lines picked from the old one go.
    if (patch.shop !== undefined && patch.shop !== shop) {
      setDraft((current) => ({
        ...current,
        ...patch,
        lines: [],
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

  function goTo(index: number) {
    // The Addresses step opens with the customer's name as the delivery name (when it has none).
    if (ORDER_STEPS[index].id === 'addresses') setDraft(withCustomerNameOnAddress)
    setStep(index)
    setFurthest((current) => Math.max(current, index))
  }

  /** Next: only this step's fields are checked; a problem keeps the person here. */
  function next() {
    setTouched((current) => new Set(current).add(stepId))
    if (Object.keys(stepProblems(problems, stepId)).length > 0) {
      setStopped((count) => count + 1)
      return
    }
    goTo(step + 1)
  }

  function editStep(target: OrderStepId) {
    setStep(ORDER_STEPS.findIndex((candidate) => candidate.id === target))
  }

  /** Create order (last step): every step is checked; a problem takes you to its step. */
  function submit() {
    setTouched(new Set(ORDER_STEPS.map((candidate) => candidate.id)))
    const first = firstStepWithProblem(problems)
    if (first) {
      editStep(first)
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

  // On a long step the first problem can be out of sight: go to it.
  const sectionRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (stopped === 0) return
    const field = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (field) field.focus()
    else if (typeof messageRef.current?.scrollIntoView === 'function') {
      messageRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [stopped])

  // A new step starts at the top (not on the first render).
  const arrived = useRef(false)
  useEffect(() => {
    if (!arrived.current) {
      arrived.current = true
      return
    }
    if (typeof bodyRef.current?.scrollTo === 'function')
      bodyRef.current.scrollTo({ top: 0 })
    if (typeof sectionRef.current?.scrollIntoView === 'function') {
      sectionRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [step])

  const totals = orderTotals(effective)
  const isReview = stepId === 'review'
  return (
    <section
      ref={sectionRef}
      aria-label="Create order"
      aria-busy={isCreating}
      // `relative` keeps the visually hidden labels (sr-only) inside this card.
      className="border-border bg-bg relative flex w-full flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
    >
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-6">
        <h2 className="text-[1.05rem] font-bold">Create Order</h2>
        <button
          type="button"
          onClick={back}
          disabled={isCreating}
          className={BACK_TO_LIST}
        >
          <ArrowLeftIcon width={14} height={14} />
          Back to list
        </button>
      </div>

      <OrderStepper
        current={step}
        furthest={furthest}
        problemSteps={problemSteps}
        onGo={goTo}
      />

      <div
        ref={bodyRef}
        className={`px-4 py-5 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto ${
          isReview
            ? 'flex flex-col gap-7'
            : 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]'
        }`}
      >
        <div className="flex min-w-0 flex-col gap-7">
          <div ref={messageRef} className="flex flex-col gap-2 empty:hidden">
            {stepProblemList.length > 0 && (
              <div
                role="alert"
                className="bg-danger-bg text-danger flex items-start gap-2 rounded-lg px-3 py-2.5 text-[0.85rem] leading-snug"
              >
                <AlertTriangleIcon width={16} height={16} className="mt-px shrink-0" />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="m-0 font-semibold">
                    {stepProblemList.length === 1
                      ? 'Please fix this field to continue:'
                      : `Please fix these ${stepProblemList.length} fields to continue:`}
                  </p>
                  <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5">
                    {stepProblemList.map((problem) => (
                      <li key={problem.field}>
                        <button
                          type="button"
                          onClick={() => document.getElementById(problem.field)?.focus()}
                          className="cursor-pointer border-none bg-transparent p-0 text-left font-semibold underline underline-offset-2"
                        >
                          {problem.label}
                        </button>
                        {' — '}
                        {problem.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {error && !confirming && <FormMessage tone="error">{error}</FormMessage>}
          </div>

          {stepId === 'order' && (
            <>
              <OrderDetailsSection
                draft={effective}
                errors={errors}
                update={update}
                storeOptions={shopOptions}
              />
              <OrderCustomerSection
                draft={effective}
                errors={errors}
                update={update}
                linked={linked}
                onLink={setLinked}
              />
            </>
          )}
          {stepId === 'addresses' && (
            <OrderAddressSection
              draft={effective}
              errors={errors}
              update={update}
              symbol={symbol}
            />
          )}
          {stepId === 'items' && (
            <OrderLinesCard
              lines={effective.lines}
              shop={shop}
              currency={currency}
              errors={errors}
              onChange={updateLines}
            />
          )}
          {isReview && (
            <OrderReviewStep
              draft={effective}
              storeName={storeName}
              currency={currency}
              onEdit={editStep}
            />
          )}
        </div>
        {!isReview && <OrderSummaryCard draft={effective} currency={currency} />}
      </div>

      <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-3.5 sm:px-6">
        {step === 0 ? (
          <button
            type="button"
            onClick={back}
            disabled={isCreating}
            className={NAV_SECONDARY}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={isCreating}
            className={NAV_SECONDARY}
          >
            <ArrowLeftIcon width={16} height={16} />
            Back
          </button>
        )}
        {step === LAST_STEP ? (
          <button
            type="button"
            onClick={submit}
            disabled={isCreating}
            className={NAV_PRIMARY}
          >
            {isCreating ? (
              <SpinnerIcon width={16} height={16} className="animate-spin" />
            ) : (
              <CheckCircleIcon width={16} height={16} />
            )}
            {isCreating ? 'Creating…' : 'Create order'}
          </button>
        ) : (
          <button type="button" onClick={next} className={NAV_PRIMARY}>
            Next
            <ChevronRightIcon width={16} height={16} />
          </button>
        )}
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
              <dd className="m-0">{storeName}</dd>
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
                {PAYMENT_LABELS[effective.paymentStatus]}
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
