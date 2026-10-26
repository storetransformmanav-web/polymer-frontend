import {
  ListChecksIcon,
  StoreIcon,
  UserCogIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { KpiCards, type Kpi } from '../../../components/ui/KpiCards.tsx'
import type { Role } from '../../../lib/api/endpoints.ts'
import { isAdminRole } from '../utils/format.ts'

const count = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('en-GB')

/**
 * Four figures above the users list, read from answers the page already has — they make
 * no request of their own. **Users** is the list answer's `total` (everyone matching the
 * list); the other three come from `GET /roles`, which the page loads anyway (it feeds the
 * Role filter and the Add user form) and which says how many users each role has:
 * **Administrators** (the admin role, who see every store), **Other staff** (every other
 * role, limited to their own stores) and **Roles** (how many kinds of access exist).
 */
export function UsersKpis({
  total,
  roles,
  rolesLoaded,
}: {
  /** The list answer's `total`, or null until it has arrived. */
  total: number | null
  roles: readonly Role[]
  /** `GET /roles` has answered (an empty list before then means "not yet"). */
  rolesLoaded: boolean
}) {
  const admins = roles
    .filter((role) => isAdminRole(role.name))
    .reduce((sum, role) => sum + role.users_count, 0)
  const others = roles
    .filter((role) => !isAdminRole(role.name))
    .reduce((sum, role) => sum + role.users_count, 0)

  const kpis: Kpi[] = [
    {
      label: 'Users',
      value: count(total),
      hint: 'Everyone matching the list',
      icon: UsersIcon,
    },
    {
      label: 'Administrators',
      value: rolesLoaded ? count(admins) : '—',
      hint: 'Can see every store',
      icon: UserCogIcon,
      tone: 'good',
    },
    {
      label: 'Other staff',
      value: rolesLoaded ? count(others) : '—',
      hint: 'Limited to their own stores',
      icon: StoreIcon,
    },
    {
      label: 'Roles',
      value: rolesLoaded ? count(roles.length) : '—',
      hint: 'Kinds of access you can give',
      icon: ListChecksIcon,
    },
  ]
  return <KpiCards items={kpis} />
}
