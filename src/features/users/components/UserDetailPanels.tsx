import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import type { Role, Shop } from '../../../lib/api/endpoints.ts'
import {
  DETAIL_TD as TD,
  DETAIL_TH as TH,
  DetailEmpty,
  DetailSection,
  DetailSkeleton,
  Field,
  FieldGrid,
} from '../../../components/ui/DetailSection.tsx'
import { ListChecksIcon, UsersIcon } from '../../../components/ui/icons.tsx'
import type { UserDetail, UserItem } from '../../../lib/api/endpoints.ts'
import { formatDate, formatDateTime } from '../../../lib/format.ts'
import { areaLabel, isAdminRole, roleLabel } from '../utils/format.ts'
import {
  UserRoleCell,
  UserStatusCell,
  UserTextCell,
  type AskUserUpdate,
} from './UserEditCells.tsx'
import { UserStoreAccess } from './UserStoreAccess.tsx'
import type { UserUpdateRequest } from './UserUpdateDialog.tsx'

const dateOrNull = (value: string | null | undefined) =>
  value ? formatDate(value) : null
const dateTimeOrNull = (value: string | null | undefined) =>
  value ? formatDateTime(value) : null

const SUMMARY_CARD = 'border-border bg-accent-tint/50 rounded-xl border p-5'
const SUMMARY_LABEL = 'text-text-muted text-[0.7rem] font-bold tracking-wide uppercase'

// --- Overview -----------------------------------------------------------------

interface OverviewProps {
  user: UserDetail | null
  /** The matching list row, so the summary can draw before the details arrive. */
  preview: UserItem | null
  /** Every role, for the role dropdown. */
  roles: Role[]
  /** Asks "Are you sure?" for a change made with a small pencil. */
  onAsk: AskUserUpdate
}

export function UserOverviewPanel({ user, preview, roles, onAsk }: OverviewProps) {
  const source = user ?? preview

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className={SUMMARY_CARD}>
          <p className={SUMMARY_LABEL}>Role</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {source ? roleLabel(source) : '—'}
          </p>
          {source && (
            <p className="text-text-muted mt-1 text-[0.82rem]">
              {isAdminRole(source.role)
                ? 'Can see every store'
                : 'Limited to their stores'}
            </p>
          )}
        </div>
        <div className={SUMMARY_CARD}>
          <p className={SUMMARY_LABEL}>Last login</p>
          <p className="mt-1 text-xl font-bold tracking-tight">
            {source?.last_login_at ? formatDate(source.last_login_at) : 'Never'}
          </p>
        </div>
        <div className={SUMMARY_CARD}>
          <p className={SUMMARY_LABEL}>User since</p>
          <p className="mt-1 text-xl font-bold tracking-tight">
            {dateOrNull(source?.created_at) ?? '—'}
          </p>
        </div>
      </div>

      {!user ? (
        <DetailSkeleton />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <DetailSection title="Profile & Account" count={11} icon={UsersIcon}>
            <FieldGrid>
              <Field label="First name">
                <UserTextCell user={user} field="firstName" onAsk={onAsk} />
              </Field>
              <Field label="Last name">
                <UserTextCell user={user} field="lastName" onAsk={onAsk} />
              </Field>
              <Field label="Email">
                <UserTextCell
                  user={user}
                  field="email"
                  onAsk={onAsk}
                  after={<CopyButton value={user.email} label="Copy email" />}
                />
              </Field>
              <Field label="Phone">
                <UserTextCell user={user} field="phone" onAsk={onAsk} />
              </Field>
              <Field label="Role">
                <UserRoleCell user={user} roles={roles} onAsk={onAsk} />
              </Field>
              <Field label="Status">
                <UserStatusCell user={user} onAsk={onAsk} />
              </Field>
              <Field label="Sign-in">
                {user.google_linked ? (
                  <Badge tone="default">Google</Badge>
                ) : (
                  <Badge tone="neutral">Email code</Badge>
                )}
              </Field>
              <Field label="User ID">
                <span className="flex items-center gap-1.5 font-mono text-[0.8rem] break-all">
                  {user.id}
                  <CopyButton value={user.id} label="Copy user ID" />
                </span>
              </Field>
              <Field label="Last login">
                {dateTimeOrNull(user.last_login_at) ?? 'Never'}
              </Field>
              <Field label="Created">{dateTimeOrNull(user.created_at)}</Field>
              <Field label="Updated">{dateTimeOrNull(user.updated_at)}</Field>
            </FieldGrid>
          </DetailSection>
        </div>
      )}
    </div>
  )
}

// --- Access (stores and permissions) -------------------------------------------

interface AccessProps {
  user: UserDetail
  /** Every store the signed-in user can see — what this user can be given. */
  shops: Shop[]
  /** Store key → display name. */
  shopNames: Record<string, string>
  /** Asks "Are you sure?" for a change; `onSaved` runs once it went through. */
  onAsk: (request: UserUpdateRequest, onSaved?: () => void) => void
}

const yesNoBadge = (value: boolean | undefined) =>
  value === undefined ? (
    <span className="text-text-muted">—</span>
  ) : (
    <Badge tone={value ? 'success' : 'neutral'}>{value ? 'Yes' : 'No'}</Badge>
  )

export function UserAccessPanel({ user, shops, shopNames, onAsk }: AccessProps) {
  const areas = Object.entries(user.permissions ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  )

  return (
    <div className="flex flex-col gap-4">
      <UserStoreAccess user={user} shops={shops} shopNames={shopNames} onAsk={onAsk} />

      {areas.length === 0 ? (
        <DetailEmpty icon={ListChecksIcon}>
          No permissions listed for this user.
        </DetailEmpty>
      ) : (
        <DetailSection title="Permissions" count={areas.length} icon={ListChecksIcon}>
          {/* A plain table: the card around it already has the border. */}
          <div className="border-border-strong overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[320px] border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Area</th>
                  <th className={TH}>Can view</th>
                  <th className={TH}>Can manage</th>
                </tr>
              </thead>
              <tbody>
                {areas.map(([area, access]) => (
                  <tr
                    key={area}
                    className="border-border even:bg-surface border-b last:border-b-0"
                  >
                    <td className={`${TD} font-semibold`}>{areaLabel(area)}</td>
                    <td className={TD}>{yesNoBadge(access.view)}</td>
                    <td className={TD}>{yesNoBadge(access.manage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailSection>
      )}
    </div>
  )
}
