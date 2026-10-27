import {
  CheckCircleIcon,
  UserCogIcon,
  UsersIcon,
  XCircleIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { Role, UserListResponse } from '../../../lib/api/endpoints.ts'
import { isAdminRole } from '../utils/format.ts'

const count = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('en-GB')

/**
 * Four figures above the users list, in this order — **Users**, **Administrators**,
 * **Active**, **Inactive** — read from the list answer's `totals` block
 * (`users`, `administrators`, `active`, `inactive`); they make no request of their own.
 * An older answer without `totals` falls back to what the page already has for the two
 * it can: the answer's `total` and the administrators from `GET /roles` (which feeds the
 * Role filter anyway); Active and Inactive show a dash until the answer has them.
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
    },
    {
      label: 'Active',
      value: count(totals?.active),
      hint: 'Can sign in',
      icon: CheckCircleIcon,
      tone: 'good',
    },
    {
      label: 'Inactive',
      value: count(totals?.inactive),
      hint: 'Cannot sign in',
      icon: XCircleIcon,
    },
  ]
  return <KpiCards items={kpis} />
}
