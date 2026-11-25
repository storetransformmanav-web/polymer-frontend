import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { PillSelect, type PillOption } from '../../../components/ui/PillSelect.tsx'
import { DoubleClickEdit } from '../../../components/ui/DoubleClickEdit.tsx'
import {
  USER_STATUSES,
  type Role,
  type UserDetail,
  type UserItem,
} from '../../../lib/api/endpoints.ts'
import { isAdminRole, roleLabel, roleTone } from '../utils/format.ts'
import {
  USER_LIMITS,
  buildUserUpdateBody,
  validateEmail,
  validateFirstName,
} from '../utils/userEdit.ts'
import type { UserUpdateRequest } from './UserUpdateDialog.tsx'

/** Asks "Are you sure?" for a change; nothing is sent until the person says yes. */
export type AskUserUpdate = (request: UserUpdateRequest) => void

type TextField = 'firstName' | 'lastName' | 'email' | 'phone'

const TEXT_FIELDS: Record<
  TextField,
  {
    label: string
    max: number
    read: (user: UserDetail) => string
    validate?: (value: string) => string | null
  }
> = {
  firstName: {
    label: 'First name',
    max: USER_LIMITS.name,
    read: (user) => user.first_name,
    validate: validateFirstName,
  },
  lastName: { label: 'Last name', max: USER_LIMITS.name, read: (user) => user.last_name },
  email: {
    label: 'Email',
    max: USER_LIMITS.email,
    read: (user) => user.email,
    validate: validateEmail,
  },
  phone: { label: 'Phone', max: USER_LIMITS.phone, read: (user) => user.phone ?? '' },
}

const show = (value: string) => (value === '' ? '—' : value)

/**
 * One of a user's typed details (first name, last name, email, phone), changed where it is shown:
 * the small pencil (or a double-click, or Enter on it) turns it into a box; Enter or leaving it
 * asks "Are you sure?" with old → new, and only "Yes, update" sends it. Escape sends nothing.
 * `after` sits beside the pencil (the email's copy button), so the two line up on one row.
 */
export function UserTextCell({
  user,
  field,
  onAsk,
  after,
}: {
  user: UserDetail
  field: TextField
  onAsk: AskUserUpdate
  after?: ReactNode
}) {
  const spec = TEXT_FIELDS[field]
  const saved = spec.read(user)

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <DoubleClickEdit
        value={saved}
        showActions
        label={spec.label}
        showIcon
        maxLength={spec.max}
        inputMode={field === 'phone' ? 'text' : undefined}
        validate={spec.validate}
        onCommit={(next) => {
          const value = field === 'email' ? next.trim().toLowerCase() : next.trim()
          if (value === saved) return
          onAsk({
            change: { label: spec.label, from: show(saved), to: show(value) },
            body: buildUserUpdateBody(user, { [field]: value }),
          })
        }}
        display={
          <span className={`break-all ${saved === '' ? 'text-text-muted' : ''}`}>
            {show(saved)}
          </span>
        }
      />
      {after}
    </span>
  )
}

/**
 * A user's role as a coloured pill with a dropdown — the same control as a product's status in the
 * Products list (`PillSelect`). **The choices are the roles the backend lists** (`GET /roles`: each
 * role's own name and label); choosing another asks "Are you sure?" and only "Yes, update" sends it.
 */
export function UserRoleCell({
  user,
  roles,
  onAsk,
}: {
  user: UserItem
  roles: Role[]
  onAsk: AskUserUpdate
}) {
  const badge = <Badge tone={roleTone(user.role)}>{roleLabel(user)}</Badge>
  // The role list hasn't arrived (or failed): show the role, nothing to choose from.
  if (roles.length === 0) return badge

  const options: PillOption[] = roles.map((role) => ({
    value: role.name,
    label: role.label || role.name,
    tone: roleTone(role.name),
  }))
  // The user's own role is always listed, even if the backend's list no longer has it.
  if (!options.some((option) => option.value === user.role)) {
    options.push({ value: user.role, label: roleLabel(user), tone: roleTone(user.role) })
  }

  return (
    <PillSelect
      label={`Role: ${roleLabel(user)}`}
      menuLabel="Role"
      options={options}
      value={user.role}
      widthClass="w-auto min-w-24 px-2.5"
      onChange={(next) => {
        const target = options.find((option) => option.value === next)
        let note: string | undefined
        if (isAdminRole(next)) note = 'Administrators can see every store.'
        else if (isAdminRole(user.role) && user.shop_keys.length === 0) {
          note = 'They will see no store until you give them some on the Access tab.'
        }
        onAsk({
          change: { label: 'Role', from: roleLabel(user), to: target?.label ?? next },
          body: buildUserUpdateBody(user, { role: next }),
          note,
        })
      }}
    />
  )
}

/** "inactive" → "Inactive": the API's own status word, capitalised (no label is written here). */
const statusLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

/**
 * Whether the account is active, as the same coloured pill with a dropdown. **The choices are the
 * API's own statuses** (`USER_STATUSES`); an inactive account can no longer sign in, its history is
 * kept. Choosing another asks "Are you sure?" first.
 */
export function UserStatusCell({
  user,
  onAsk,
}: {
  user: UserItem
  onAsk: AskUserUpdate
}) {
  const options: PillOption[] = USER_STATUSES.map((status) => ({
    value: status,
    label: statusLabel(status),
    tone: status === 'active' ? 'success' : 'neutral',
  }))
  const current = user.is_active ? 'active' : 'inactive'

  return (
    <PillSelect
      label={`Status: ${statusLabel(current)}`}
      menuLabel="Status"
      options={options}
      value={current}
      widthClass="w-auto min-w-24 px-2.5"
      onChange={(next) => {
        const active = next === 'active'
        onAsk({
          change: {
            label: 'Status',
            from: statusLabel(current),
            to: statusLabel(next),
          },
          body: buildUserUpdateBody(user, { isActive: active }),
          note: active ? undefined : 'They will no longer be able to sign in.',
        })
      }}
    />
  )
}
