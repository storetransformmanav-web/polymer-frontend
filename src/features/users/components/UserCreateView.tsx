import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { ArrowLeftIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import type { Role, Shop, UserCreateBody } from '../../../lib/api/endpoints.ts'
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

/** The role a new user starts with: "office" if it exists, else the first non-admin role. */
function defaultRole(roles: Role[]): string {
  return (
    roles.find((role) => role.name === 'office')?.name ??
    roles.find((role) => !isAdminRole(role.name))?.name ??
    roles[0]?.name ??
    ''
  )
}

/**
 * "Add user", opened in place of the list (like "Add product"): a header bar with Back and
 * Create user, then cards for who they are and what they can see. Staff sign in by emailed
 * code or Google, so there is no password — just their details, their role and (for
 * non-admins) which stores they may see. Backend errors (a duplicate email, say) show above
 * the cards in the backend's own words.
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
  const [errors, setErrors] = useState<{ firstName?: string; email?: string }>({})

  const role = chosenRole || defaultRole(roles)
  const isAdmin = isAdminRole(role)
  const ids = {
    firstName: `${formId}-first`,
    lastName: `${formId}-last`,
    email: `${formId}-email`,
    phone: `${formId}-phone`,
    role: `${formId}-role`,
  }

  const dirty =
    firstName.trim() !== '' ||
    lastName.trim() !== '' ||
    email.trim() !== '' ||
    phone.trim() !== '' ||
    chosenRole !== '' ||
    shopKeys.length > 0
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isCreating) return

    const next: typeof errors = {}
    if (!firstName.trim()) next.firstName = 'Enter a first name'
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address'
    setErrors(next)
    if (next.firstName || next.email || !role) return

    const body: UserCreateBody = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      role,
      // Admins see every store, so only other roles carry a store list.
      shop_keys: isAdmin ? [] : shopKeys,
    }
    if (phone.trim()) body.phone = phone.trim()

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
      {isCreating && <SpinnerIcon width={14} height={14} className="animate-spin" />}
      {isCreating ? 'Creating…' : 'Create user'}
    </button>
  )

  return (
    <section aria-label="Add user" aria-busy={isCreating} className="flex flex-col gap-4">
      <div className="border-border bg-bg flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-2.5">
        <button
          type="button"
          onClick={onBack}
          disabled={isCreating}
          className="text-text hover:text-accent inline-flex h-9 cursor-pointer items-center gap-2 border-none bg-transparent px-1 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowLeftIcon width={16} height={16} />
          Back
        </button>
        <div className="bg-border hidden h-6 w-px sm:block" aria-hidden="true" />
        <h2 className="text-[0.95rem] font-semibold">Add user</h2>
        <div className="ml-auto">{createButton}</div>
      </div>

      {error && <FormMessage tone="error">{error}</FormMessage>}

      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]"
      >
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
                aria-describedby={errors.firstName ? `${ids.firstName}-error` : undefined}
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
          </div>

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
        </Card>

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
        </Card>
      </form>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isCreating}
          className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
        >
          Cancel
        </button>
        {createButton}
      </div>
    </section>
  )
}
