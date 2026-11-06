import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { ChoiceEdit } from '../../../components/ui/ChoiceEdit.tsx'
import { DoubleClickEdit } from '../../../components/ui/DoubleClickEdit.tsx'
import type { Role, UserDetail } from '../../../lib/api/endpoints.ts'
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
 * A user's role, changed by double-clicking it (or its small pencil): it turns into a dropdown of
 * the roles; choosing another asks "Are you sure?" and only "Yes, update" sends it.
 */
export function UserRoleCell({
  user,
  roles,
  onAsk,
}: {
  user: UserDetail
  roles: Role[]
  onAsk: AskUserUpdate
}) {
  const badge = <Badge tone={roleTone(user.role)}>{roleLabel(user)}</Badge>
  // The role list hasn't arrived (or failed): show the role, nothing to choose from.
  if (roles.length === 0) return badge

  return (
    <ChoiceEdit
      value={user.role}
      label="Role"
      display={badge}
      options={roles.map((role) => ({ value: role.name, label: role.label }))}
      onCommit={(next) => {
        const target = roles.find((role) => role.name === next)
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

const ACTIVE = 'active'
const INACTIVE = 'inactive'

/**
 * Whether the account is active, changed the same way (a dropdown: Active / Inactive). An inactive
 * account can no longer sign in; its history is kept.
 */
export function UserStatusCell({
  user,
  onAsk,
}: {
  user: UserDetail
  onAsk: AskUserUpdate
}) {
  return (
    <ChoiceEdit
      value={user.is_active ? ACTIVE : INACTIVE}
      label="Status"
      display={
        <Badge tone={user.is_active ? 'success' : 'neutral'}>
          {user.is_active ? 'Active' : 'Inactive'}
        </Badge>
      }
      options={[
        { value: ACTIVE, label: 'Active' },
        { value: INACTIVE, label: 'Inactive' },
      ]}
      onCommit={(next) => {
        const active = next === ACTIVE
        onAsk({
          change: {
            label: 'Status',
            from: user.is_active ? 'Active' : 'Inactive',
            to: active ? 'Active' : 'Inactive',
          },
          body: buildUserUpdateBody(user, { isActive: active }),
          note: active ? undefined : 'They will no longer be able to sign in.',
        })
      }}
    />
  )
}
