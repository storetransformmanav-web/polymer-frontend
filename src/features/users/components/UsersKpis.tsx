import {
  ListChecksIcon,
  StoreIcon,
  UserCogIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { Role, UserListResponse } from '../../../lib/api/endpoints.ts'
import { isAdminRole } from '../utils/format.ts'

const count = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('en-GB')

/**
 * Four figures above the users list, read from the list answer's `totals` block
 * (`users`, `administrators`, `other_staff`, `roles`) — they make no request of their own.
 * `totals` also carries `active` and `inactive`; the status filter shows those. An older
 * answer without `totals` falls back to what the page already has: the answer's `total`
 * and the per-role user counts from `GET /roles` (which feeds the Role filter anyway).
 */
export function UsersKpis({
  totals,
  total,
  roles,
  rolesLoaded,
}: {
  /** The list answer's `totals` block, or null/undefined when it has none (yet). */
  totals: UserListResponse['totals']
  /** The list answer's `total`, or null until it has arrived. */
  total: number | null
  roles: readonly Role[]
  /** `GET /roles` has answered (an empty list before then means "not yet"). */
  rolesLoaded: boolean
}) {
  const fromRoles = (pick: (role: Role) => boolean) =>
    rolesLoaded
      ? roles.filter(pick).reduce((sum, role) => sum + role.users_count, 0)
      : null

  const kpis: Kpi[] = [
    {
      label: 'Users',
      value: count(totals?.users ?? total),
      hint: 'Everyone matching the list',
      icon: UsersIcon,
    },
    {
      label: 'Administrators',
      value: count(totals?.administrators ?? fromRoles((role) => isAdminRole(role.name))),
      hint: 'Can see every store',
      icon: UserCogIcon,
      tone: 'good',
    },
    {
      label: 'Other staff',
      value: count(totals?.other_staff ?? fromRoles((role) => !isAdminRole(role.name))),
      hint: 'Limited to their own stores',
      icon: StoreIcon,
    },
    {
      label: 'Roles',
      value: count(totals?.roles ?? (rolesLoaded ? roles.length : null)),
      hint: 'Kinds of access you can give',
      icon: ListChecksIcon,
    },
  ]
  return <KpiCards items={kpis} />
}
