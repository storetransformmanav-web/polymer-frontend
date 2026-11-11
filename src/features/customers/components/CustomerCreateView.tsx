import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { useAppSelector } from '../../../app/store/hooks.ts'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  ArrowLeftIcon,
  LayersIcon,
  MailIcon,
  MapPinIcon,
  PlusIcon,
  SpinnerIcon,
  StoreIcon,
  TagIcon,
  TrashIcon,
  UsersIcon,
  type IconProps,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useShops } from '../../../hooks/useShops.ts'
import type { CustomerCreateResult } from '../../../lib/api/endpoints.ts'
import { countryName, countryOptions } from '../../../lib/countries.ts'
import { mergeTags, TagsInput, useStoreTags } from '../../products/index.ts'
import { useCreateCustomer } from '../hooks/useCreateCustomer.ts'
import {
  buildCustomerBody,
  EMPTY_DRAFT,
  isDraftDirty,
  MAX_METAFIELDS,
  validateCustomerDraft,
  type CustomerDraft,
} from '../utils/customerDraft.ts'
import { CustomerCreateDialog } from './CustomerCreateDialog.tsx'

const CARD = 'border-border bg-bg min-w-0 rounded-2xl border'
const FIELD_LABEL = 'text-text text-[0.82rem] font-semibold'
const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint placeholder:text-text-muted/70 h-10 w-full min-w-0 rounded-lg border px-3 text-[0.88rem] font-medium transition-colors outline-none focus:outline-2 aria-[invalid=true]:border-danger disabled:opacity-60'
const BUTTON =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50'
const PRIMARY_BUTTON = `${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent shadow-sm`
const SECONDARY_BUTTON = `${BUTTON} border-border bg-bg text-text hover:border-accent`

interface CustomerCreateViewProps {
  /** The store made the customer: open it (the page does). */
  onCreated: (result: CustomerCreateResult) => void
  /** Leave the form (the page asks first when something was entered). */
  onBack: () => void
  /** Told whenever the form gains or loses anything the person typed or chose. */
  onDirtyChange?: (dirty: boolean) => void
}

function Section({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: ComponentType<IconProps>
  title: string
  subtitle: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className={`${CARD} flex flex-col gap-4 p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="bg-accent-tint text-accent border-border-strong flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
          >
            <Icon width={20} height={20} />
          </span>
          <div className="flex flex-col">
            <h3 className="text-[1rem] font-semibold">{title}</h3>
            <p className="text-text-muted m-0 text-[0.8rem]">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({
  id,
  label,
  error,
  optional,
  children,
}: {
  id: string
  label: string
  error?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
        {optional && <span className="text-text-muted font-normal"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger m-0 text-[0.78rem]">
          {error}
        </p>
      )}
    </div>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="hover:bg-surface flex cursor-pointer items-start gap-3 rounded-lg px-1 py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-accent mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[0.88rem] font-semibold">{label}</span>
        <span className="text-text-muted text-[0.78rem]">{hint}</span>
      </span>
    </label>
  )
}

/**
 * "Add customer", opened in place of the list at `/customers/new` as a "New customer" tab (like
 * Add order and Add user): a header bar with Back and Create customer, then cards for who they
 * are (name, email), an optional address, tags and metafields, and beside them the store and
 * the consent choices. **Create customer** checks every field first (the first problem gets the
 * focus), then asks "Are you sure?" and only "Yes, create" sends one `POST /customers`. A
 * refusal (a duplicate email, say) shows the backend's own words inside the question and keeps
 * everything typed.
 */
export function CustomerCreateView({
  onCreated,
  onBack,
  onDirtyChange,
}: CustomerCreateViewProps) {
  const formId = useId()
  const fid = (name: string) => `${formId}-${name}`
  const { shops, selected } = useShops()
  const { create, isCreating, error, clearError } = useCreateCustomer()
  const [draft, setDraft] = useState<CustomerDraft>(EMPTY_DRAFT)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [loadTags, setLoadTags] = useState(false)
  const nextRow = useRef(0)

  // The store: the top bar's, else the first connected one. Another store can be picked here.
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
  const effective: CustomerDraft = useMemo(() => ({ ...draft, shop }), [draft, shop])
  const store = shops.find((candidate) => shopValue(candidate) === shop)

  // Every tag the store has (asked for once the Tags box is focused) and the ones seen on the
  // customers loaded so far — so the box offers all of them and still works if the call is refused.
  const seenTags = useAppSelector((state) => state.customers.facets.tags)
  const storeTags = useStoreTags(shop ? [shop] : [], { enabled: loadTags })
  const knownTags = mergeTags(storeTags.tags, seenTags)

  const dirty = isDraftDirty(draft)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  /** Changes the form; typing again clears that field's error and any failed-save message. */
  function update(patch: Partial<CustomerDraft>, ...fields: string[]) {
    setDraft((current) => ({ ...current, ...patch }))
    if (fields.some((field) => errors[field])) {
      setErrors((current) => {
        const next = { ...current }
        for (const field of fields) delete next[field]
        return next
      })
    }
    if (error) clearError()
  }

  function updateMetafield(
    id: string,
    patch: Partial<CustomerDraft['metafields'][number]>,
  ) {
    setDraft((current) => ({
      ...current,
      metafields: current.metafields.map((row) =>
        row.id === id ? { ...row, ...patch } : row,
      ),
    }))
    if (errors[`metafield-${id}`]) {
      setErrors((current) => {
        const next = { ...current }
        delete next[`metafield-${id}`]
        return next
      })
    }
    if (error) clearError()
  }

  function addMetafield() {
    nextRow.current += 1
    setDraft((current) => ({
      ...current,
      metafields: [
        ...current.metafields,
        { id: String(nextRow.current), namespace: '', key: '', value: '' },
      ],
    }))
  }

  function removeMetafield(id: string) {
    setDraft((current) => ({
      ...current,
      metafields: current.metafields.filter((row) => row.id !== id),
    }))
    if (error) clearError()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isCreating) return
    const found = validateCustomerDraft(effective)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      // Put the cursor on the first field with a problem.
      const target = first.startsWith('metafield-')
        ? document.getElementById(fid(`${first}-namespace`))
        : document.getElementById(fid(first))
      target?.focus()
      return
    }
    clearError()
    setConfirming(true)
  }

  async function confirm() {
    const result = await create(buildCustomerBody(effective))
    if (!result) return
    setConfirming(false)
    onCreated(result)
  }

  const name = [effective.firstName, effective.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
  const summary = [
    { label: 'Customer', value: name || effective.email.trim() },
    ...(name ? [{ label: 'Email', value: effective.email.trim().toLowerCase() }] : []),
    { label: 'Store', value: store ? shopLabel(store) : shop },
    ...(effective.country
      ? [
          {
            label: 'Country',
            value: countryName(effective.country),
          },
        ]
      : []),
    ...(effective.tags.length > 0
      ? [{ label: 'Tags', value: effective.tags.join(', ') }]
      : []),
    {
      label: 'Marketing emails',
      value: effective.acceptsMarketing ? 'Subscribed' : 'Not subscribed',
    },
  ]

  const problems = Object.keys(errors).length > 0

  const createButton = (
    <button type="submit" form={formId} disabled={isCreating} className={PRIMARY_BUTTON}>
      {isCreating && <SpinnerIcon width={14} height={14} className="animate-spin" />}
      {isCreating ? 'Creating…' : 'Create customer'}
    </button>
  )

  return (
    <section
      aria-label="Add customer"
      aria-busy={isCreating}
      // `relative` keeps the visually hidden labels inside this box (as on Add product).
      className="relative flex w-full flex-col gap-5 lg:min-h-full"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[1.5rem] leading-tight font-bold">Add customer</h2>
        <div className="ml-auto flex items-center gap-2">
          {/* Same button as on a product's details page and the Add product form. */}
          <button
            type="button"
            onClick={onBack}
            disabled={isCreating}
            aria-label="Back to list"
            className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowLeftIcon width={16} height={16} />
            <span className="hidden sm:inline" aria-hidden="true">
              Back to list
            </span>
          </button>
          {createButton}
        </div>
      </div>

      {problems && (
        <FormMessage tone="error">
          Fix the highlighted fields to create the customer.
        </FormMessage>
      )}

      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <Section
            icon={UsersIcon}
            title="Customer"
            subtitle="Who they are and how to reach them."
          >
            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
              <Field id={fid('firstName')} label="First name" optional>
                <input
                  id={fid('firstName')}
                  autoFocus
                  autoComplete="off"
                  maxLength={80}
                  placeholder="Sergio"
                  value={draft.firstName}
                  onChange={(event) => update({ firstName: event.target.value })}
                  className={FIELD_INPUT}
                />
              </Field>
              <Field id={fid('lastName')} label="Last name" optional>
                <input
                  id={fid('lastName')}
                  autoComplete="off"
                  maxLength={80}
                  placeholder="Dizio"
                  value={draft.lastName}
                  onChange={(event) => update({ lastName: event.target.value })}
                  className={FIELD_INPUT}
                />
              </Field>
            </div>
            <Field id={fid('email')} label="Email address" error={errors.email}>
              <div className="relative">
                <MailIcon
                  width={16}
                  height={16}
                  className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                />
                <input
                  id={fid('email')}
                  type="email"
                  autoComplete="off"
                  maxLength={254}
                  placeholder="sergio@example.com"
                  value={draft.email}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? `${fid('email')}-error` : undefined}
                  onChange={(event) => update({ email: event.target.value }, 'email')}
                  className={`${FIELD_INPUT} pl-9`}
                />
              </div>
            </Field>
          </Section>

          <Section
            icon={MapPinIcon}
            title="Address"
            subtitle="Optional. Once you start, the street, city and country are needed."
          >
            <Field id={fid('company')} label="Company" optional>
              <input
                id={fid('company')}
                autoComplete="off"
                maxLength={120}
                placeholder="JUICENESS LIMITED"
                value={draft.company}
                onChange={(event) => update({ company: event.target.value })}
                className={FIELD_INPUT}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
              <Field id={fid('address1')} label="Address" error={errors.address1}>
                <input
                  id={fid('address1')}
                  autoComplete="off"
                  maxLength={200}
                  placeholder="Brushfield Street"
                  value={draft.address1}
                  aria-invalid={errors.address1 ? true : undefined}
                  aria-describedby={
                    errors.address1 ? `${fid('address1')}-error` : undefined
                  }
                  onChange={(event) =>
                    update({ address1: event.target.value }, 'address1')
                  }
                  className={FIELD_INPUT}
                />
              </Field>
              <Field id={fid('address2')} label="Apartment, suite, etc." optional>
                <input
                  id={fid('address2')}
                  autoComplete="off"
                  maxLength={200}
                  placeholder="Anchor Stall 1"
                  value={draft.address2}
                  onChange={(event) => update({ address2: event.target.value })}
                  className={FIELD_INPUT}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-4">
              <Field id={fid('city')} label="City" error={errors.city}>
                <input
                  id={fid('city')}
                  autoComplete="off"
                  maxLength={100}
                  placeholder="London"
                  value={draft.city}
                  aria-invalid={errors.city ? true : undefined}
                  aria-describedby={errors.city ? `${fid('city')}-error` : undefined}
                  onChange={(event) => update({ city: event.target.value }, 'city')}
                  className={FIELD_INPUT}
                />
              </Field>
              <Field id={fid('province')} label="County / state code" optional>
                <input
                  id={fid('province')}
                  autoComplete="off"
                  maxLength={10}
                  placeholder="ENG"
                  value={draft.province}
                  onChange={(event) => update({ province: event.target.value })}
                  className={`${FIELD_INPUT} uppercase`}
                />
              </Field>
              <Field id={fid('zip')} label="Postcode" optional>
                <input
                  id={fid('zip')}
                  autoComplete="off"
                  maxLength={20}
                  placeholder="E1 6AA"
                  value={draft.zip}
                  onChange={(event) => update({ zip: event.target.value })}
                  className={FIELD_INPUT}
                />
              </Field>
              <div className="flex min-w-0 flex-col gap-1.5">
                <SelectField
                  id={fid('country')}
                  label="Country"
                  value={draft.country}
                  options={countryOptions()}
                  onChange={(country) => update({ country }, 'country')}
                />
                {errors.country && (
                  <p role="alert" className="text-danger m-0 text-[0.78rem]">
                    {errors.country}
                  </p>
                )}
              </div>
            </div>
            <Field id={fid('phone')} label="Phone" optional>
              <input
                id={fid('phone')}
                type="tel"
                autoComplete="off"
                maxLength={40}
                placeholder="+44 20 7946 0000"
                value={draft.phone}
                onChange={(event) => update({ phone: event.target.value })}
                className={FIELD_INPUT}
              />
            </Field>
          </Section>

          <Section
            icon={TagIcon}
            title="Tags"
            subtitle="Tags the customer carries, such as b2b. Every tag the store has is offered."
          >
            <TagsInput
              id={fid('tags')}
              ariaLabel="Add tags"
              listLabel="Tags"
              removeLabel={(tag) => `Remove tag ${tag}`}
              tags={draft.tags}
              onChange={(tags) => update({ tags }, 'tags')}
              suggestions={knownTags}
              suggestAll
              onActivate={() => setLoadTags(true)}
            />
            {errors.tags && (
              <p role="alert" className="text-danger m-0 text-[0.78rem]">
                {errors.tags}
              </p>
            )}
          </Section>

          <Section
            icon={LayersIcon}
            title="Metafields"
            subtitle="Optional custom data, such as an accounting ID."
            action={
              draft.metafields.length < MAX_METAFIELDS ? (
                <button
                  type="button"
                  onClick={addMetafield}
                  className="text-accent hover:text-accent-hover inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[0.82rem] font-semibold transition-colors"
                >
                  <PlusIcon width={14} height={14} />
                  Add a metafield
                </button>
              ) : undefined
            }
          >
            {draft.metafields.length === 0 ? (
              <p className="text-text-muted m-0 text-[0.85rem]">No metafields added.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {draft.metafields.map((row, index) => {
                  const rowError = errors[`metafield-${row.id}`]
                  const base = fid(`metafield-${row.id}`)
                  return (
                    <li key={row.id} className="flex flex-col gap-1.5">
                      <div className="grid grid-cols-1 items-center gap-2 min-[640px]:grid-cols-[1fr_1fr_1.4fr_auto]">
                        <input
                          id={`${base}-namespace`}
                          aria-label={`Namespace of metafield ${index + 1}`}
                          autoComplete="off"
                          maxLength={64}
                          placeholder="namespace (sparklayer)"
                          value={row.namespace}
                          aria-invalid={rowError ? true : undefined}
                          onChange={(event) =>
                            updateMetafield(row.id, { namespace: event.target.value })
                          }
                          className={FIELD_INPUT}
                        />
                        <input
                          aria-label={`Key of metafield ${index + 1}`}
                          autoComplete="off"
                          maxLength={64}
                          placeholder="key (accounting_id)"
                          value={row.key}
                          aria-invalid={rowError ? true : undefined}
                          onChange={(event) =>
                            updateMetafield(row.id, { key: event.target.value })
                          }
                          className={FIELD_INPUT}
                        />
                        <input
                          aria-label={`Value of metafield ${index + 1}`}
                          autoComplete="off"
                          maxLength={1000}
                          placeholder="value (JUI001)"
                          value={row.value}
                          aria-invalid={rowError ? true : undefined}
                          onChange={(event) =>
                            updateMetafield(row.id, { value: event.target.value })
                          }
                          className={FIELD_INPUT}
                        />
                        <button
                          type="button"
                          aria-label={`Remove metafield ${index + 1}`}
                          onClick={() => removeMetafield(row.id)}
                          className="text-text-muted hover:text-danger hover:bg-danger-bg inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent transition-colors"
                        >
                          <TrashIcon width={16} height={16} />
                        </button>
                      </div>
                      {rowError && (
                        <p role="alert" className="text-danger m-0 text-[0.78rem]">
                          {rowError}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-0">
          <Section icon={StoreIcon} title="Store" subtitle="Where the customer is made.">
            <div className="flex flex-col gap-1.5">
              <SelectField
                id={fid('shop')}
                label="Store"
                hideLabel
                value={shop}
                options={shopOptions}
                disabled={shopOptions.length === 0}
                onChange={(next) => update({ shop: next }, 'shop')}
              />
              {errors.shop && (
                <p role="alert" className="text-danger m-0 text-[0.78rem]">
                  {errors.shop}
                </p>
              )}
            </div>
            <p className="text-text-muted m-0 text-[0.8rem]">
              The customer is created in Shopify and in the CRM.
            </p>
          </Section>

          <Section
            icon={MailIcon}
            title="Preferences"
            subtitle="Marketing consent and tax."
          >
            <div className="flex flex-col gap-1">
              <CheckRow
                checked={draft.acceptsMarketing}
                onChange={(acceptsMarketing) => update({ acceptsMarketing })}
                label="Accepts email marketing"
                hint="Only tick this if the customer agreed to receive marketing emails."
              />
              <CheckRow
                checked={draft.taxExempt}
                onChange={(taxExempt) => update({ taxExempt })}
                label="Tax exempt"
                hint="Tax is not charged on this customer's orders."
              />
            </div>
          </Section>
        </aside>
      </form>

      <div className="flex flex-wrap justify-end gap-2 lg:mt-auto">
        <button
          type="button"
          onClick={onBack}
          disabled={isCreating}
          className={SECONDARY_BUTTON}
        >
          Cancel
        </button>
        {createButton}
      </div>

      {confirming && (
        <CustomerCreateDialog
          title={`Create “${name || effective.email.trim()}”?`}
          summary={summary}
          isCreating={isCreating}
          error={error}
          onConfirm={() => void confirm()}
          onCancel={() => {
            if (!isCreating) {
              setConfirming(false)
              clearError()
            }
          }}
        />
      )}
    </section>
  )
}
