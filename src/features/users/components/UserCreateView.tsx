import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { DETAIL_CARD, DetailSection } from '../../../components/ui/DetailSection.tsx'
import { HeaderBackButton } from '../../../components/ui/DetailsHeader.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { PinFields } from '../../../components/ui/PinFields.tsx'
import {
  FileTextIcon,
  MapPinIcon,
  PhoneIcon,
  PlusIcon,
  ShieldCheckIcon,
  SpinnerIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import type {
  Role,
  Shop,
  UserCreateBody,
  UserCreateEmployee,
} from '../../../lib/api/endpoints.ts'
import { useManagerOptions } from '../hooks/useManagerOptions.ts'
import { isAdminRole } from '../utils/format.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FIELD_LABEL = 'text-text text-[0.82rem] font-semibold'
const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint placeholder:text-text-muted/70 h-10 w-full min-w-0 rounded-lg border px-3 text-[0.88rem] font-medium transition-colors outline-none focus:outline-2 aria-[invalid=true]:border-danger'
const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface UserCreateViewProps {
  roles: Role[]
  rolesError: string | null
  onRetryRoles: () => void
  /** Every store the signed-in user can see — what a new user can be given access to. */
  shops: Shop[]
  /** Resolves once the user is created; the form shows `error` if it fails. */
  onCreate: (body: UserCreateBody) => Promise<unknown>
  isCreating: boolean
  error: string | null
  onClearError: () => void
  /** Leave the form (the page asks first when something was entered). */
  onBack: () => void
  /** Told whenever the form gains or loses anything the user typed or chose. */
  onDirtyChange?: (dirty: boolean) => void
}

interface FieldProps {
  id: string
  label: string
  error?: string | null
  optional?: boolean
  children: ReactNode
}

function Field({ id, label, error, optional, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
        {optional && <span className="text-text-muted font-normal"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger text-[0.78rem]">
          {error}
        </p>
      )}
    </div>
  )
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-border-strong bg-bg flex flex-col gap-4 rounded-xl border p-5">
      <header className="flex flex-col gap-1">
        <h3 className="text-[0.95rem] font-semibold">{title}</h3>
        {description && <p className="text-text-muted text-[0.82rem]">{description}</p>}
      </header>
      {children}
    </section>
  )
}

/** A small on / off switch with a title and a one-line explanation beside it. */
function Toggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="border-border flex items-center gap-4 border-t pt-4">
      <div className="min-w-0 flex-1">
        <p className="text-text m-0 text-[0.85rem] font-semibold">{title}</p>
        <p className="text-text-muted m-0 mt-0.5 text-[0.78rem]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-[2.6rem] shrink-0 cursor-pointer rounded-full border-none transition-colors ${
          checked ? 'bg-accent' : 'bg-border-strong'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-[3px] left-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[1.1rem]' : ''
          }`}
        />
      </button>
    </div>
  )
}

const OPTIONAL = (
  <span className="text-text-muted border-border bg-surface rounded-full border px-2 py-0.5 text-[0.66rem] font-bold tracking-wide uppercase">
    Optional
  </span>
)

/** The optional details, as typed (all text; turned into the body's `employee` block on create). */
const BLANK_EXTRA = {
  position: '',
  department: '',
  managerId: '',
  joiningDate: '',
  leavingDate: '',
  dateOfBirth: '',
  shiftStart: '',
  lateGrace: '',
  address1: '',
  address2: '',
  city: '',
  postcode: '',
  taxCode: '',
  niNumber: '',
  niCategory: '',
  emergencyName: '',
  emergencyPhone: '',
  pin: '',
}
type Extra = typeof BLANK_EXTRA

/** The role a new user starts with: "office" if it exists, else the first non-admin role. */
function defaultRole(roles: Role[]): string {
  return (
    roles.find((role) => role.name === 'office')?.name ??
    roles.find((role) => !isAdminRole(role.name))?.name ??
    roles[0]?.name ??
    ''
  )
}

/** The `employee` block: only what was filled in (null when nothing was). */
function buildEmployee(extra: Extra): UserCreateEmployee | null {
  const employee: UserCreateEmployee = {}
  const set = (key: keyof UserCreateEmployee, value: string) => {
    const text = value.trim()
    if (text) (employee as Record<string, unknown>)[key] = text
  }
  set('position', extra.position)
  set('department', extra.department)
  set('manager_user_id', extra.managerId)
  set('joining_date', extra.joiningDate)
  set('leaving_date', extra.leavingDate)
  set('date_of_birth', extra.dateOfBirth)
  set('address_line1', extra.address1)
  set('address_line2', extra.address2)
  set('city', extra.city)
  set('postcode', extra.postcode)
  set('tax_code', extra.taxCode)
  set('ni_number', extra.niNumber)
  set('ni_category', extra.niCategory)
  set('emergency_name', extra.emergencyName)
  set('emergency_phone', extra.emergencyPhone)
  set('shift_start', extra.shiftStart)
  set('security_pin', extra.pin)
  if (extra.lateGrace.trim()) employee.late_grace_minutes = Number(extra.lateGrace.trim())
  return Object.keys(employee).length > 0 ? employee : null
}

/**
 * "Add user", opened in place of the list (like "Add product"): a header bar that stays in view
 * (Back, the title and Create user), then — on the left — the basics and the optional sections
 * (employment, personal and address, tax and National Insurance, emergency contact) and the required security PIN,
 * and — on the right — the role and access card. Staff sign in by emailed code or Google, so
 * there is no password. First name, email and the security PIN are required; whatever is left empty is simply
 * not sent. Backend errors (a duplicate email, a refused PIN…) show above the cards in the
 * backend's own words.
 */
export function UserCreateView({
  roles,
  rolesError,
  onRetryRoles,
  shops,
  onCreate,
  isCreating,
  error,
  onClearError,
  onBack,
  onDirtyChange,
}: UserCreateViewProps) {
  const formId = useId()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [chosenRole, setChosenRole] = useState('')
  const [shopKeys, setShopKeys] = useState<string[]>([])
  const [reminders, setReminders] = useState(false)
  const [extra, setExtra] = useState<Extra>(BLANK_EXTRA)
  /** How many digits the PIN will have; 0 until one is chosen. */
  const [pinLength, setPinLength] = useState(0)
  const [errors, setErrors] = useState<{
    firstName?: string
    email?: string
    lateGrace?: string
    pin?: string
  }>({})

  const role = chosenRole || defaultRole(roles)
  const isAdmin = isAdminRole(role)
  const managers = useManagerOptions(true)
  const ids = {
    firstName: `${formId}-first`,
    lastName: `${formId}-last`,
    email: `${formId}-email`,
    phone: `${formId}-phone`,
    role: `${formId}-role`,
    manager: `${formId}-manager`,
    grace: `${formId}-grace`,
  }

  const dirty =
    firstName.trim() !== '' ||
    lastName.trim() !== '' ||
    email.trim() !== '' ||
    phone.trim() !== '' ||
    chosenRole !== '' ||
    shopKeys.length > 0 ||
    reminders ||
    pinLength > 0 ||
    Object.values(extra).some((value) => value.trim() !== '')
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  /** Typing again clears the field's error and any failed-save message. */
  function edited(field?: keyof typeof errors) {
    if (field && errors[field])
      setErrors((current) => ({ ...current, [field]: undefined }))
    if (error) onClearError()
  }

  function toggleShop(key: string) {
    edited()
    setShopKeys((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    )
  }

  function setField(key: keyof Extra, value: string) {
    setExtra((current) => ({ ...current, [key]: value }))
    edited(key === 'lateGrace' || key === 'pin' ? key : undefined)
  }

  /** A click anywhere in a date or time box opens the browser's picker (not just its small icon). */
  function openPicker(event: MouseEvent<HTMLInputElement>) {
    try {
      event.currentTarget.showPicker()
    } catch {
      // The browser has no picker for it, or refused: the box still works by typing.
    }
  }

  /** A plain one-line box for an optional detail. */
  function textField(
    key: keyof Extra,
    label: string,
    options: {
      type?: string
      placeholder?: string
      maxLength?: number
      autoComplete?: string
    } = {},
  ) {
    const id = `${formId}-${key}`
    return (
      <Field id={id} label={label} optional>
        <input
          id={id}
          type={options.type ?? 'text'}
          onClick={
            options.type === 'date' || options.type === 'time' ? openPicker : undefined
          }
          autoComplete={options.autoComplete ?? 'off'}
          maxLength={options.maxLength ?? 120}
          placeholder={options.placeholder}
          value={extra[key]}
          onChange={(event) => setField(key, event.target.value)}
          className={FIELD_INPUT}
        />
      </Field>
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isCreating) return

    const next: typeof errors = {}
    if (!firstName.trim()) next.firstName = 'Enter a first name'
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address'
    const grace = extra.lateGrace.trim()
    if (grace && !/^\d+$/.test(grace)) next.lateGrace = 'Enter whole minutes, e.g. 5'
    if (!pinLength) next.pin = 'Choose a 4 or 6 digit security PIN'
    else if (extra.pin.length !== pinLength) {
      next.pin = `Enter all ${pinLength} digits of the security PIN`
    }
    setErrors(next)
    if (next.firstName || next.email || next.lateGrace || next.pin || !role) return

    const body: UserCreateBody = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      role,
      // Admins see every store, so only other roles carry a store list.
      shop_keys: isAdmin ? [] : shopKeys,
    }
    if (phone.trim()) body.phone = phone.trim()
    if (reminders) body.reminder_emails = true
    const employee = buildEmployee(extra)
    if (employee) body.employee = employee

    // A failure is shown from `error`; success closes the form (the page does that).
    await onCreate(body).catch(() => undefined)
  }

  const createButton = (
    <button
      type="submit"
      form={formId}
      disabled={isCreating || (roles.length === 0 && !rolesError)}
      className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent shadow-sm`}
    >
      {isCreating ? (
        <SpinnerIcon width={14} height={14} className="animate-spin" />
      ) : (
        <PlusIcon width={15} height={15} />
      )}
      {isCreating ? 'Creating…' : 'Create user'}
    </button>
  )

  return (
    <section aria-label="Add user" aria-busy={isCreating} className="flex flex-col gap-4">
      {/* Laid out like Add Collection's header (a tile, the title and a line under it, Back to
          list, the main button); it stays in view under the top bar while the form scrolls. */}
      <header
        className={`${DETAIL_CARD} sticky top-16 z-[9] flex flex-wrap items-center gap-3 p-3 shadow-sm sm:px-4 lg:top-0`}
      >
        <span
          aria-hidden="true"
          className="bg-accent text-accent-contrast flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        >
          <UsersIcon width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-lg leading-tight font-bold">Add User</h2>
          <p className="text-text-muted m-0 text-[0.76rem]">
            They sign in with an emailed code or Google. First name, email and security
            PIN are required.
          </p>
        </div>
        <HeaderBackButton onClick={onBack} disabled={isCreating} />
        {createButton}
      </header>

      {error && <FormMessage tone="error">{error}</FormMessage>}

      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1">
          <Card
            title="Basics"
            description="They'll sign in with an emailed code or Google — there is no password to set."
          >
            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
              <Field id={ids.firstName} label="First name" error={errors.firstName}>
                <input
                  id={ids.firstName}
                  autoFocus
                  autoComplete="off"
                  maxLength={80}
                  placeholder="Jane"
                  value={firstName}
                  aria-invalid={errors.firstName ? true : undefined}
                  aria-describedby={
                    errors.firstName ? `${ids.firstName}-error` : undefined
                  }
                  onChange={(event) => {
                    setFirstName(event.target.value)
                    edited('firstName')
                  }}
                  className={FIELD_INPUT}
                />
              </Field>
              <Field id={ids.lastName} label="Last name" optional>
                <input
                  id={ids.lastName}
                  autoComplete="off"
                  maxLength={80}
                  placeholder="Doe"
                  value={lastName}
                  onChange={(event) => {
                    setLastName(event.target.value)
                    edited()
                  }}
                  className={FIELD_INPUT}
                />
              </Field>
              <Field id={ids.email} label="Email address" error={errors.email}>
                <input
                  id={ids.email}
                  type="email"
                  autoComplete="off"
                  maxLength={254}
                  placeholder="jane@company.com"
                  value={email}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? `${ids.email}-error` : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    edited('email')
                  }}
                  className={FIELD_INPUT}
                />
              </Field>
              <Field id={ids.phone} label="Phone" optional>
                <input
                  id={ids.phone}
                  type="tel"
                  autoComplete="off"
                  maxLength={40}
                  placeholder="+44 20 7946 0000"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value)
                    edited()
                  }}
                  className={FIELD_INPUT}
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* On the right from `lg`, beside the basics and the optional sections. */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Card
            title="Role and access"
            description="What they can do, and which stores they can see."
          >
            {rolesError ? (
              <div className="flex flex-col gap-2">
                <FormMessage tone="error">{`Couldn't load roles. ${rolesError}`}</FormMessage>
                <button
                  type="button"
                  onClick={onRetryRoles}
                  className="text-accent hover:text-accent-hover cursor-pointer self-start border-none bg-none p-0 text-[0.82rem] font-semibold"
                >
                  Try again
                </button>
              </div>
            ) : (
              <SelectField
                id={ids.role}
                label="Role"
                value={role}
                options={roles.map((option) => ({
                  value: option.name,
                  label: option.label,
                }))}
                disabled={roles.length === 0}
                onChange={(value) => {
                  setChosenRole(value)
                  edited()
                }}
              />
            )}

            <fieldset className="flex flex-col gap-2.5 border-none p-0">
              <legend className={`${FIELD_LABEL} mb-1`}>Store access</legend>
              {isAdmin ? (
                <p className="text-text-muted bg-surface border-border rounded-lg border px-3 py-2.5 text-[0.82rem]">
                  Administrators can see every store.
                </p>
              ) : shops.length === 0 ? (
                <p className="text-text-muted text-[0.82rem]">No stores available.</p>
              ) : (
                <>
                  <p className="text-text-muted text-[0.8rem]">
                    Choose the stores this user can see.
                  </p>
                  <ul className="border-border divide-border flex flex-col divide-y overflow-hidden rounded-lg border">
                    {shops.map((shop) => {
                      const key = shopValue(shop)
                      return (
                        <li key={shop.id}>
                          <label className="hover:bg-surface flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[0.88rem]">
                            <input
                              type="checkbox"
                              checked={shopKeys.includes(key)}
                              onChange={() => toggleShop(key)}
                              className="accent-accent h-4 w-4 shrink-0 cursor-pointer"
                            />
                            <span className="min-w-0 truncate font-medium">
                              {shopLabel(shop)}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </fieldset>

            <Toggle
              title="Reminder emails"
              description="Send this person the regular reminder emails."
              checked={reminders}
              onChange={(value) => {
                setReminders(value)
                edited()
              }}
            />
          </Card>

          <DetailSection
            title="Security PIN"
            icon={ShieldCheckIcon}
            forceOpen={Boolean(errors.pin)}
          >
            <div className="flex flex-col gap-4">
              <div className="max-w-sm">
                <PinFields
                  id={`${formId}-pin`}
                  length={pinLength}
                  onLengthChange={(length) => {
                    // Another length starts the PIN again.
                    setPinLength(length)
                    setField('pin', '')
                  }}
                  pin={extra.pin}
                  onPinChange={(value) => setField('pin', value)}
                  error={errors.pin}
                />
              </div>
            </div>
          </DetailSection>

          <DetailSection
            title="Tax and National Insurance"
            icon={FileTextIcon}
            titleExtra={OPTIONAL}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-4">
              {textField('taxCode', 'Tax code', { placeholder: '1257L' })}
              {textField('niNumber', 'NI number', { placeholder: 'AB123456C' })}
              {textField('niCategory', 'NI category', { placeholder: 'A' })}
            </div>
          </DetailSection>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1">
          <DetailSection
            title="Employment"
            icon={UsersIcon}
            titleExtra={OPTIONAL}
            forceOpen={Boolean(errors.lateGrace)}
          >
            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
              {textField('position', 'Position', { placeholder: 'Warehouse Associate' })}
              {textField('department', 'Department', { placeholder: 'Logistics' })}
              <div className="flex flex-col gap-1.5">
                <SelectField
                  id={ids.manager}
                  label="Manager"
                  value={extra.managerId}
                  options={[
                    {
                      value: '',
                      label: managers.isLoading ? 'Loading people…' : 'No manager',
                    },
                    ...managers.managers.map((person) => ({
                      value: person.id,
                      label: person.label,
                    })),
                  ]}
                  disabled={managers.isLoading}
                  onChange={(value) => setField('managerId', value)}
                />
                {managers.error && (
                  <p className="text-danger text-[0.78rem]">
                    {`Couldn't load people. ${managers.error}`}
                  </p>
                )}
              </div>
              {textField('shiftStart', 'Shift starts', { type: 'time' })}
              {textField('joiningDate', 'Joining date', { type: 'date' })}
              {textField('leavingDate', 'Leaving date', { type: 'date' })}
              <Field
                id={ids.grace}
                label="Late grace (minutes)"
                optional
                error={errors.lateGrace}
              >
                <input
                  id={ids.grace}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="5"
                  value={extra.lateGrace}
                  aria-invalid={errors.lateGrace ? true : undefined}
                  aria-describedby={errors.lateGrace ? `${ids.grace}-error` : undefined}
                  onChange={(event) => setField('lateGrace', event.target.value)}
                  className={FIELD_INPUT}
                />
              </Field>
            </div>
          </DetailSection>

          <DetailSection
            title="Personal and address"
            icon={MapPinIcon}
            titleExtra={OPTIONAL}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
              {textField('dateOfBirth', 'Date of birth', { type: 'date' })}
              <span aria-hidden="true" className="hidden min-[520px]:block" />
              {textField('address1', 'Address line 1', { placeholder: '1 High Street' })}
              {textField('address2', 'Address line 2')}
              {textField('city', 'City', { placeholder: 'London' })}
              {textField('postcode', 'Postcode', { placeholder: 'SW1A 1AA' })}
            </div>
          </DetailSection>

          <DetailSection
            title="Emergency contact"
            icon={PhoneIcon}
            titleExtra={OPTIONAL}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
              {textField('emergencyName', 'Contact name', { placeholder: 'Alex Taylor' })}
              {textField('emergencyPhone', 'Contact phone', {
                type: 'tel',
                placeholder: '07700 900456',
              })}
            </div>
          </DetailSection>
        </div>
      </form>
    </section>
  )
}
