import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import { SidePanel } from '../../../components/ui/SidePanel.tsx'
import type { Role, Shop, UserCreateBody } from '../../../lib/api/endpoints.ts'
import { isAdminRole } from '../utils/format.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FIELD_LABEL = 'text-text text-[0.82rem] font-semibold'
const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint placeholder:text-text-muted/70 h-10 w-full min-w-0 rounded-lg border px-3 text-[0.88rem] font-medium transition-colors outline-none focus:outline-2 aria-[invalid=true]:border-danger'

interface UserFormPanelProps {
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
  onClose: () => void
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
 * "Add user" slide-over. Staff sign in by emailed code or Google, so there is
 * no password — just who they are, their role and (for non-admins) which
 * stores they may see. Backend errors (a duplicate email, say) show above the
 * buttons in the backend's own words.
 */
export function UserFormPanel({
  roles,
  rolesError,
  onRetryRoles,
  shops,
  onCreate,
  isCreating,
  error,
  onClearError,
  onClose,
}: UserFormPanelProps) {
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

    // A failure is shown from `error`; success closes the panel (the page does that).
    await onCreate(body).catch(() => undefined)
  }

  return (
    <SidePanel
      title="Add user"
      label="Add user"
      onClose={onClose}
      closeDisabled={isCreating}
      footer={
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="hover:border-accent! flex-1"
            disabled={isCreating}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            className="flex-1"
            disabled={isCreating || (roles.length === 0 && !rolesError)}
          >
            {isCreating ? (
              <>
                <SpinnerIcon className="animate-spin" /> Creating…
              </>
            ) : (
              'Create user'
            )}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-5 p-5"
      >
        <p className="text-text-muted text-[0.85rem]">
          They&apos;ll sign in with an emailed code or Google — there is no password to
          set.
        </p>

        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
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
            options={roles.map((option) => ({ value: option.name, label: option.label }))}
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

        {error && <FormMessage tone="error">{error}</FormMessage>}
      </form>
    </SidePanel>
  )
}
