import { useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import type { Shop } from '../../../lib/api/endpoints.ts'
import {
  DETAIL_TD as TD,
  DETAIL_TH as TH,
  DetailSection,
  DetailSkeleton,
} from '../../../components/ui/DetailSection.tsx'
import {
  FileTextIcon,
  ListChecksIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { Switch } from '../../../components/ui/Switch.tsx'
import type { UserDetail } from '../../../lib/api/endpoints.ts'
import { formatDateTime } from '../../../lib/format.ts'
import { areaLabel } from '../utils/format.ts'
import { buildUserEmployeeBody, buildUserUpdateBody } from '../utils/userEdit.ts'
import { UserTextCell, type AskUserUpdate } from './UserEditCells.tsx'
import { UserEmployeeCell, UserManagerCell, UserPinCell } from './UserEmployeeCells.tsx'
import { UserStoreAccess } from './UserStoreAccess.tsx'
import type { UserUpdateRequest } from './UserUpdateDialog.tsx'

const dateTimeOrNull = (value: string | null | undefined) =>
  value ? formatDateTime(value) : null

/** One line of a card: a muted label and its value (or its small pencil) on the same row. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex items-start gap-3 border-t py-1.5 text-[0.85rem] first:border-t-0 first:pt-0 last:pb-0">
      <dt className="text-text-muted w-36 shrink-0 pt-0.5">{label}</dt>
      <dd className="m-0 min-w-0 flex-1 font-semibold break-words">{children}</dd>
    </div>
  )
}

type EmployeeFieldName = Parameters<typeof UserEmployeeCell>[0]['field']

// --- Overview -----------------------------------------------------------------

interface OverviewProps {
  user: UserDetail | null
  /** Asks "Are you sure?" for a change made with a small pencil. */
  onAsk: AskUserUpdate
}

/**
 * The account, employment, personal details, address and emergency contact — every value with a
 * small pencil. The role, last login, "user since" and employee code are in the header.
 */
export function UserOverviewPanel({ user, onAsk }: OverviewProps) {
  if (!user) return <DetailSkeleton />
  const cell = (
    field: EmployeeFieldName,
    label: string,
    kind?: 'text' | 'date' | 'time' | 'number',
  ) => (
    <UserEmployeeCell user={user} field={field} label={label} kind={kind} onAsk={onAsk} />
  )

  return (
    // Three columns from `lg` (two from `md`, one on a phone). Cards are as tall as their
    // content, except the first row: Profile & Account and the Personal details + Tax stack grow to
    // end level with Employment. Row 1: Profile & Account, Employment, and Personal details with Tax and National
    // Insurance stacked in the third column. Row 2 starts below the tallest of those, so Address
    // (the first two columns) and Emergency contact (the third) share one top edge.
    <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col md:self-stretch [&>section]:grow [&>section[data-state=closed]]:grow-0">
        <DetailSection title="Profile & Account" icon={UsersIcon} compact>
          <dl className="m-0">
            <Row label="First name">
              <UserTextCell user={user} field="firstName" onAsk={onAsk} />
            </Row>
            <Row label="Last name">
              <UserTextCell user={user} field="lastName" onAsk={onAsk} />
            </Row>
            <Row label="Email">
              <UserTextCell
                user={user}
                field="email"
                onAsk={onAsk}
                after={<CopyButton value={user.email} label="Copy email" />}
              />
            </Row>
            <Row label="Phone">
              <UserTextCell user={user} field="phone" onAsk={onAsk} />
            </Row>
            <Row label="Sign-in">
              {user.google_linked ? (
                <Badge tone="default">Google</Badge>
              ) : (
                <Badge tone="neutral">Email code</Badge>
              )}
            </Row>
            <Row label="User ID">
              <span className="flex items-center gap-1.5 font-mono text-[0.78rem] break-all">
                {user.id}
                <CopyButton value={user.id} label="Copy user ID" />
              </span>
            </Row>
          </dl>
        </DetailSection>
      </div>

      <div className="flex min-w-0 flex-col md:self-stretch [&>section]:grow [&>section[data-state=closed]]:grow-0">
        <DetailSection title="Employment" icon={UsersIcon} compact>
          <dl className="m-0">
            <Row label="Employment status">{user.employee?.employment_status ?? '—'}</Row>
            <Row label="Position">{cell('position', 'Position')}</Row>
            <Row label="Department">{cell('department', 'Department')}</Row>
            <Row label="Manager">
              <UserManagerCell user={user} onAsk={onAsk} />
            </Row>
            <Row label="Joining date">{cell('joining_date', 'Joining date', 'date')}</Row>
            <Row label="Leaving date">{cell('leaving_date', 'Leaving date', 'date')}</Row>
            <Row label="Shift starts">{cell('shift_start', 'Shift starts', 'time')}</Row>
            <Row label="Late grace (min)">
              {cell('late_grace_minutes', 'Late grace (minutes)', 'number')}
            </Row>
          </dl>
        </DetailSection>
      </div>

      <div className="flex min-w-0 flex-col gap-3 md:col-span-2 lg:col-span-1 lg:self-stretch [&>section]:grow [&>section[data-state=closed]]:grow-0">
        <DetailSection title="Personal details" icon={FileTextIcon} compact>
          <dl className="m-0">
            <Row label="Date of birth">
              {cell('date_of_birth', 'Date of birth', 'date')}
            </Row>
          </dl>
        </DetailSection>

        <DetailSection title="Tax and National Insurance" icon={FileTextIcon} compact>
          <dl className="m-0">
            <Row label="Tax code">{cell('tax_code', 'Tax code')}</Row>
            <Row label="NI number">{cell('ni_number', 'NI number')}</Row>
            <Row label="NI category">{cell('ni_category', 'NI category')}</Row>
          </dl>
        </DetailSection>
      </div>

      <div className="min-w-0 md:col-span-2 lg:col-span-2">
        <DetailSection title="Address" icon={MapPinIcon} compact>
          <dl className="m-0 grid grid-cols-2 gap-y-3 sm:grid-cols-4">
            {(
              [
                ['address_line1', 'Address line 1'],
                ['address_line2', 'Address line 2'],
                ['city', 'City'],
                ['postcode', 'Postcode'],
              ] as const
            ).map(([field, label], index) => (
              <div
                key={field}
                className={`min-w-0 px-3 sm:px-4 ${
                  index === 0 ? 'sm:pl-0' : 'sm:border-border-strong sm:border-l'
                }`}
              >
                <dt className="text-text-muted text-[0.78rem]">{label}</dt>
                <dd className="m-0 mt-0.5 text-[0.88rem] font-semibold break-words">
                  {cell(field, label)}
                </dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      </div>

      <div className="min-w-0 md:col-span-2 lg:col-span-1">
        <DetailSection title="Emergency contact" icon={PhoneIcon} compact>
          <dl className="m-0">
            <Row label="Contact name">{cell('emergency_name', 'Contact name')}</Row>
            <Row label="Contact phone">{cell('emergency_phone', 'Contact phone')}</Row>
          </dl>
        </DetailSection>
      </div>
    </div>
  )
}

// --- Security & Access --------------------------------------------------------

interface SecurityAccessProps {
  user: UserDetail | null
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

/**
 * The security PIN (full width, two columns, "Set / Update PIN" in its header), then store access
 * and reminder emails side by side, then the permissions. Role and status are in the header, so
 * they are not repeated here.
 */
export function UserSecurityAccessPanel({
  user,
  shops,
  shopNames,
  onAsk,
}: SecurityAccessProps) {
  const [pinEditing, setPinEditing] = useState(false)
  if (!user) return <DetailSkeleton />

  const pin = user.employee?.security_pin
  const areas = Object.entries(user.permissions ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  )

  return (
    <div className="flex flex-col gap-3">
      <DetailSection
        title="Security PIN"
        icon={ShieldCheckIcon}
        compact
        actions={
          <button
            type="button"
            onClick={() => setPinEditing(true)}
            className="border-accent text-accent hover:bg-accent-tint inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-transparent px-3 text-[0.8rem] font-semibold transition-colors"
          >
            <PencilIcon width={13} height={13} />
            Set / Update PIN
          </button>
        }
      >
        <dl className="m-0 grid md:grid-cols-2">
          <div className="min-w-0 md:pr-6">
            <Row label="PIN">
              {pin?.is_set == null ? '—' : pin.is_set ? 'Set' : 'Not set'}
            </Row>
            <Row label="Last set">{dateTimeOrNull(pin?.set_at) ?? '—'}</Row>
            <Row label="Set by">{pin?.set_by ?? '—'}</Row>
          </div>
          <div className="border-border min-w-0 border-t pt-1.5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <Row label="Failed attempts">
              {pin?.failed_attempts == null ? '—' : String(pin.failed_attempts)}
            </Row>
            <Row label="Locked until">{dateTimeOrNull(pin?.locked_until) ?? '—'}</Row>
            <Row label="New PIN">
              <UserPinCell
                user={user}
                onAsk={onAsk}
                editing={pinEditing}
                onEditingChange={setPinEditing}
              />
            </Row>
          </div>
        </dl>
        {pin?.is_set && (
          <div className="border-border mt-2 flex items-center gap-3 border-t pt-2">
            <p className="text-text-muted m-0 min-w-0 flex-1 text-[0.8rem]">
              Make sure a locked PIN can be used straight away.
            </p>
            <button
              type="button"
              onClick={() =>
                onAsk({
                  change: {
                    label: 'Security PIN lock',
                    from: dateTimeOrNull(pin.locked_until) ? 'Locked' : 'Not locked',
                    to: 'Unlocked',
                  },
                  body: buildUserEmployeeBody(user, { unlock_security_pin: true }),
                })
              }
              className="border-border bg-bg text-text hover:border-accent shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-[0.8rem] font-semibold transition-colors"
            >
              Unlock PIN
            </button>
          </div>
        )}
      </DetailSection>

      <div className="grid gap-3 md:grid-cols-2 [&>section]:h-full [&>section[data-state=closed]]:h-auto [&>section[data-state=closed]]:self-start">
        <UserStoreAccess user={user} shops={shops} shopNames={shopNames} onAsk={onAsk} />

        <DetailSection title="Reminder Emails" icon={MailIcon} compact>
          <div className="flex items-center gap-3">
            <p className="text-text-muted m-0 min-w-0 flex-1 text-[0.85rem]">
              Send this person the regular reminder emails.
            </p>
            <Switch
              label={user.reminder_emails ? 'On' : 'Off'}
              checked={Boolean(user.reminder_emails)}
              onChange={(on) =>
                onAsk({
                  change: {
                    label: 'Reminder emails',
                    from: user.reminder_emails ? 'On' : 'Off',
                    to: on ? 'On' : 'Off',
                  },
                  body: buildUserUpdateBody(user, { reminderEmails: on }),
                })
              }
            />
          </div>
        </DetailSection>
      </div>

      <DetailSection
        title="Permissions"
        count={areas.length > 0 ? areas.length : undefined}
        icon={ListChecksIcon}
        compact
      >
        {areas.length === 0 ? (
          <p className="text-text-muted m-0 flex items-center justify-center gap-2 py-2 text-[0.85rem]">
            <ListChecksIcon width={18} height={18} />
            No permissions listed for this user.
          </p>
        ) : (
          /* A plain table: the card around it already has the border. */
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
        )}
      </DetailSection>
    </div>
  )
}
