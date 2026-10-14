import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import type { UserItem } from '../../../lib/api/endpoints.ts'

/** The role that can see every store (other roles are limited to their `shop_keys`). */
export const ADMIN_ROLE = 'admin'

export const isAdminRole = (role: string) => role.toLowerCase() === ADMIN_ROLE

/** The name to show: full name, else first + last, else the email's local part. */
export function userName(
  user: Pick<UserItem, 'full_name' | 'first_name' | 'last_name' | 'email'>,
): string {
  const full = user.full_name.trim()
  if (full) return full

  const joined = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return joined || user.email.split('@')[0] || 'Unnamed user'
}

/** "Office" — the role's display name, falling back to its capitalised key. */
export function roleLabel(user: Pick<UserItem, 'role' | 'role_label'>): string {
  const label = user.role_label?.trim()
  if (label) return label
  return user.role.charAt(0).toUpperCase() + user.role.slice(1)
}

export function roleTone(role: string): BadgeTone {
  return isAdminRole(role) ? 'default' : 'neutral'
}
