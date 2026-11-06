import type { UserDetail, UserItem, UserUpdateBody } from '../../../lib/api/endpoints.ts'

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
  }
}

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
  }
}
