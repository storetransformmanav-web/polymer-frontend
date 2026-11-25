import type {
  UserCreateEmployee,
  UserDetail,
  UserItem,
  UserUpdateBody,
} from '../../../lib/api/endpoints.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The limits the Add user form uses, so an edit can't send what a new user couldn't have. */
export const USER_LIMITS = { name: 80, email: 254, phone: 40 } as const

/** What one edit changes: any of the fields `PUT /users/{user_id}` takes. */
export type UserChange = Partial<{
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  isActive: boolean
  shopKeys: string[]
  reminderEmails: boolean
}>

/**
 * The body of `PUT /users/{user_id}` for one edit: the user as they are now, with the changed
 * value in it. The whole record goes every time (the spec lists every field and none as
 * required), so it is right whether the backend replaces the user or only applies what it gets.
 * The email is sent in lower case, as Add user does.
 */
export function buildUserUpdateBody(
  user: Pick<
    UserItem,
    'first_name' | 'last_name' | 'email' | 'role' | 'phone' | 'is_active' | 'shop_keys'
  >,
  change: UserChange,
): UserUpdateBody {
  return {
    first_name: (change.firstName ?? user.first_name).trim(),
    last_name: (change.lastName ?? user.last_name).trim(),
    email: (change.email ?? user.email).trim().toLowerCase(),
    role: change.role ?? user.role,
    phone: (change.phone ?? user.phone ?? '').trim(),
    is_active: change.isActive ?? user.is_active,
    shop_keys: change.shopKeys ?? user.shop_keys,
    // Only sent when it is what changes: the details answer's own value is not echoed back.
    ...(change.reminderEmails !== undefined
      ? { reminder_emails: change.reminderEmails }
      : {}),
  }
}

/**
 * The body for a change to the employee details (position, address, tax, PIN…): the user as they
 * are now, plus an `employee` block holding only what changes — the PIN is never echoed back.
 */
export function buildUserEmployeeBody(
  user: Pick<
    UserItem,
    'first_name' | 'last_name' | 'email' | 'role' | 'phone' | 'is_active' | 'shop_keys'
  >,
  employee: UserCreateEmployee,
): UserUpdateBody {
  return { ...buildUserUpdateBody(user, {}), employee }
}

/** A reason a whole number of minutes can't be saved, or null (empty is fine). */
export const validateMinutes = (value: string): string | null =>
  value.trim() === '' || /^d+$/.test(value.trim()) ? null : 'Enter whole minutes, e.g. 5'

/** A reason a first name can't be saved, or null. */
export const validateFirstName = (value: string): string | null =>
  value.trim() === '' ? 'Enter a first name' : null

/** A reason an email can't be saved, or null. */
export const validateEmail = (value: string): string | null =>
  EMAIL_PATTERN.test(value.trim()) ? null : 'Enter a valid email address'

/**
 * Puts a saved change into a cached user the moment the server confirms (the details and every
 * cached list row), so the screen is right with no loader; the quiet re-read that follows
 * brings anything the backend worked out itself (the role's display name, say).
 */
export function applyUserBody<T extends UserItem | UserDetail>(
  user: T,
  body: UserUpdateBody,
  roleLabel?: string | null,
): T {
  const roleChanged = body.role !== undefined && body.role !== user.role
  const first = body.first_name ?? user.first_name
  const last = body.last_name ?? user.last_name
  return {
    ...user,
    first_name: first,
    last_name: last,
    // The backend builds the full name; until it is read again, build it the same way.
    full_name: [first, last].filter(Boolean).join(' ') || user.full_name,
    email: body.email ?? user.email,
    phone: body.phone !== undefined ? body.phone || null : user.phone,
    role: body.role ?? user.role,
    // A role's display name belongs to the old role: use the new one's, or let the re-read fill it.
    role_label: roleChanged ? (roleLabel ?? null) : user.role_label,
    is_active: body.is_active ?? user.is_active,
    shop_keys: body.shop_keys ?? user.shop_keys,
    ...('employee' in user || body.reminder_emails !== undefined || body.employee
      ? {
          reminder_emails: body.reminder_emails ?? (user as UserDetail).reminder_emails,
          employee: body.employee
            ? mergeEmployee((user as UserDetail).employee, body.employee)
            : (user as UserDetail).employee,
        }
      : {}),
  }
}

const blankToNull = (value: string | undefined) =>
  value === undefined ? undefined : value || null

/** The employee details as shown, with a saved change put in (the PIN's status is left to the re-read). */
function mergeEmployee(
  current: UserDetail['employee'],
  change: UserCreateEmployee,
): UserDetail['employee'] {
  const base = current ?? {}
  const pick = <T>(next: T | undefined, now: T | null | undefined) =>
    next === undefined ? now : next
  return {
    ...base,
    position: pick(blankToNull(change.position), base.position),
    department: pick(blankToNull(change.department), base.department),
    joining_date: pick(blankToNull(change.joining_date), base.joining_date),
    leaving_date: pick(blankToNull(change.leaving_date), base.leaving_date),
    date_of_birth: pick(blankToNull(change.date_of_birth), base.date_of_birth),
    tax_code: pick(blankToNull(change.tax_code), base.tax_code),
    ni_number: pick(blankToNull(change.ni_number), base.ni_number),
    ni_category: pick(blankToNull(change.ni_category), base.ni_category),
    shift_start: pick(blankToNull(change.shift_start), base.shift_start),
    late_grace_minutes: pick(change.late_grace_minutes, base.late_grace_minutes),
    address: {
      ...base.address,
      line1: pick(blankToNull(change.address_line1), base.address?.line1),
      line2: pick(blankToNull(change.address_line2), base.address?.line2),
      city: pick(blankToNull(change.city), base.address?.city),
      postcode: pick(blankToNull(change.postcode), base.address?.postcode),
    },
    emergency_contact: {
      ...base.emergency_contact,
      name: pick(blankToNull(change.emergency_name), base.emergency_contact?.name),
      phone: pick(blankToNull(change.emergency_phone), base.emergency_contact?.phone),
    },
  }
}
