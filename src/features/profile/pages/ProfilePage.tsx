import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailSection, DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import { DoubleClickEdit } from '../../../components/ui/DoubleClickEdit.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { ROW_ACTION, ROW_ACTION_ICON } from '../../../components/ui/rowActions.ts'
import {
  DetailsHeader,
  HeaderChip,
  HeaderTile,
  StatusPill,
} from '../../../components/ui/DetailsHeader.tsx'
import {
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  TagIcon,
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UserCogIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import {
  formatDate,
  formatDateTimeAmPm,
  initials as initialsOf,
} from '../../../lib/format.ts'
import type { PinAction, ProfileUpdateField } from '../../../lib/api/endpoints.ts'
import {
  ProfileUpdateDialog,
  type ProfileUpdateRequest,
} from '../components/ProfileUpdateDialog.tsx'
import { RevealedPin, type ViewedPin } from '../components/RevealedPin.tsx'
import { SecurityPinDialog } from '../components/SecurityPinDialog.tsx'
import { useProfile } from '../hooks/useProfile.ts'

/** How long the "saved" line stays. */
const NOTICE_MS = 6000

const date = (value: string | null | undefined) => (value ? formatDate(value) : '')
/** A header chip's fact with its name in front of it ("Role: Administrator"). */
const labelled = (label: string, value: ReactNode) => (
  <span className="flex min-w-0 items-center gap-1.5">
    <span aria-hidden="true" className="text-text-muted font-normal">
      {label}:
    </span>
    <span className="min-w-0 font-semibold">{value}</span>
  </span>
)

const dateTime = (value: string | null | undefined) =>
  value ? formatDateTimeAmPm(value) : ''

/** One line of a card: a muted label and its value on the same row (a dash when empty). */
function Row({
  label,
  children,
  wrap = false,
}: {
  label: string
  children: ReactNode
  /** A long value may wrap; otherwise it stays on one line and is cut with "…". */
  wrap?: boolean
}) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className="border-border flex items-start gap-3 border-t py-2.5 text-[0.85rem] first:border-t-0 first:pt-0 last:pb-0">
      <dt className="text-text-muted w-32 shrink-0">{label}</dt>
      <dd
        className={`m-0 min-w-0 flex-1 font-semibold ${wrap ? 'break-words' : 'truncate'}`}
        title={typeof children === 'string' ? children : undefined}
      >
        {empty ? <span className="text-text-muted font-normal">—</span> : children}
      </dd>
    </div>
  )
}

/** What a set PIN looks like: always the same, so it doesn't give away the PIN's length. */
const PIN_MASK = '******'
/** The PIN's View and Edit buttons: a list's row action (the product list's size and hover). */
const PIN_BUTTON = `${ROW_ACTION} -my-1 shrink-0 disabled:pointer-events-none disabled:opacity-50`

/**
 * **Update profile** (the account menu): the signed-in person's own profile from
 * `GET /hr/profile` — a header with their name, role, status, email, phone and employee code,
 * then cards for personal details, address, emergency contact, employment, tax and National
 * Insurance, and the security PIN (shown as asterisks; its View and Edit buttons open a window
 * that emails a code first; a viewed PIN shows here, on the page, for as long as the backend
 * allows). Every value is the
 * backend's; an empty one is a dash. A value the profile's `editable_fields` names has a small
 * pencil: one click turns it into a box as wide as the value's own place (Enter or leaving the box
 * keeps it, Escape puts the old one back), and "Yes, update" then sends just that field with
 * `PUT /hr/profile`.
 */
export function ProfilePage() {
  const navigate = useNavigate()
  const { profile, isPending, isRefreshing, error, retry } = useProfile()
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
  const [asking, setAsking] = useState<ProfileUpdateRequest | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** Which PIN window is open, if any. */
  const [pinAction, setPinAction] = useState<PinAction | null>(null)
  /** The PIN while it is on screen, after its code was verified. Gone when the page is left. */
  const [viewed, setViewed] = useState<ViewedPin | null>(null)
  const hidePin = useCallback(() => setViewed(null), [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (error) {
    return (
      <section className="border-border bg-bg flex flex-col items-center gap-3 rounded-2xl border px-4 py-16 text-center">
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="font-semibold">Couldn&apos;t load your profile</p>
          <p className="text-text-muted text-[0.9rem]">{error}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={retry}
            className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={back}
            className="border-border bg-bg text-text-muted hover:text-text cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            Back
          </button>
        </div>
      </section>
    )
  }

  if (isPending || !profile) return <DetailSkeleton />

  const employee = profile.employee
  const name =
    profile.full_name?.trim() ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
    'Your profile'
  const code = profile.employee_code || employee?.employee_code || ''
  const address = employee?.address
  const pin = employee?.security_pin
  const userId = profile.user_id?.trim() ?? ''
  const manager = employee?.manager

  // A value the backend lists as editable gets the pencil; the rest are plain text.
  const editable = new Set(profile.editable_fields ?? [])
  const edit = (
    field: ProfileUpdateField,
    label: string,
    value: string | null | undefined,
  ): ReactNode => {
    if (!editable.has(field)) return value
    return (
      <DoubleClickEdit
        value={value ?? ''}
        label={label}
        showIcon
        rowActionIcon
        busy={asking !== null && field in asking.body}
        display={
          value ? (
            <span className="break-words">{value}</span>
          ) : (
            <span className="text-text-muted font-normal">—</span>
          )
        }
        onCommit={(next) => {
          setNotice(null)
          setAsking({
            label,
            from: value || 'Empty',
            to: next || 'Empty',
            body: { [field]: next },
          })
        }}
      />
    )
  }

  return (
    <article
      aria-label={`Profile of ${name}`}
      className="border-border bg-bg flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
    >
      <DetailsHeader
        visual={<HeaderTile>{profile.initials || initialsOf(name) || '?'}</HeaderTile>}
        title={name}
        status={
          <>
            {profile.is_active !== null && profile.is_active !== undefined && (
              <StatusPill
                label={`Status: ${profile.is_active ? 'Active' : 'Inactive'}`}
                tone={profile.is_active ? 'success' : 'neutral'}
              />
            )}
            {isRefreshing && (
              <span className="text-text-muted text-[0.75rem]" role="status">
                Updating…
              </span>
            )}
          </>
        }
        chips={
          <>
            {(profile.role_label || profile.role) && (
              <HeaderChip icon={UserCogIcon} label="Role">
                {labelled('Role', profile.role_label || profile.role)}
              </HeaderChip>
            )}
            {code && (
              <HeaderChip icon={TagIcon} label="Employee code">
                {labelled('Employee code', code)}
              </HeaderChip>
            )}
            {profile.created_at && (
              <HeaderChip icon={CalendarIcon} label="Account created">
                {labelled('Account created', dateTime(profile.created_at))}
              </HeaderChip>
            )}
            {profile.last_login_at && (
              <HeaderChip icon={ClockIcon} label="Last login">
                {labelled('Last login', dateTime(profile.last_login_at))}
              </HeaderChip>
            )}
            {profile.phone && (
              <HeaderChip icon={PhoneIcon} label="Phone">
                {labelled(
                  'Phone',
                  <span className="whitespace-nowrap">{profile.phone}</span>,
                )}
              </HeaderChip>
            )}
            {profile.email && (
              <HeaderChip icon={MailIcon} label="Email">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="text-text-muted font-normal">
                    Email:
                  </span>
                  <span className="font-semibold break-all">{profile.email}</span>
                  <CopyButton value={profile.email} label="Copy email" />
                </span>
              </HeaderChip>
            )}
          </>
        }
        onBack={back}
        backLabel="Back"
      />

      <div className="bg-surface border-border border-t p-3 sm:p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {notice && (
          <div className="mb-3">
            <FormMessage tone="success">{notice}</FormMessage>
          </div>
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <DetailSection title="Personal details" icon={UserCogIcon} compact>
              <dl className="m-0">
                <Row label="First name" wrap>
                  {edit('first_name', 'First name', profile.first_name)}
                </Row>
                <Row label="Last name" wrap>
                  {edit('last_name', 'Last name', profile.last_name)}
                </Row>
                <Row label="Phone" wrap>
                  {edit('phone', 'Phone', profile.phone)}
                </Row>
              </dl>
            </DetailSection>

            <DetailSection title="Address" icon={MapPinIcon} compact>
              <dl className="m-0">
                <Row label="Address line 1" wrap>
                  {edit('address_line1', 'Address line 1', address?.line1)}
                </Row>
                <Row label="Address line 2" wrap>
                  {edit('address_line2', 'Address line 2', address?.line2)}
                </Row>
              </dl>
              <dl className="border-border m-0 grid border-t pt-1.5 md:grid-cols-2">
                <div className="min-w-0 md:pr-4">
                  <Row label="City" wrap>
                    {edit('city', 'City', address?.city)}
                  </Row>
                </div>
                <div className="border-border min-w-0 md:border-l md:pl-4">
                  <Row label="Postcode" wrap>
                    {edit('postcode', 'Postcode', address?.postcode)}
                  </Row>
                </div>
              </dl>
            </DetailSection>

            <DetailSection title="Emergency contact" icon={PhoneIcon} compact>
              <dl className="m-0">
                <Row label="Name" wrap>
                  {edit(
                    'emergency_name',
                    'Emergency contact name',
                    employee?.emergency_contact?.name,
                  )}
                </Row>
                <Row label="Phone" wrap>
                  {edit(
                    'emergency_phone',
                    'Emergency contact phone',
                    employee?.emergency_contact?.phone,
                  )}
                </Row>
              </dl>
            </DetailSection>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <DetailSection title="Employment" icon={UsersIcon} compact>
              <dl className="m-0 grid md:grid-cols-2">
                <div className="min-w-0 md:pr-4">
                  <Row label="Status">{employee?.employment_status}</Row>
                  <Row label="Position">{employee?.position}</Row>
                  <Row label="Department">{employee?.department}</Row>
                  <Row label="Manager">
                    {manager?.full_name
                      ? `${manager.full_name}${manager.employee_code ? ` · ${manager.employee_code}` : ''}`
                      : null}
                  </Row>
                </div>
                <div className="border-border min-w-0 border-t pt-1.5 md:border-t-0 md:border-l md:pt-0 md:pl-4">
                  <Row label="Joining date">{date(employee?.joining_date)}</Row>
                  <Row label="Leaving date">{date(employee?.leaving_date)}</Row>
                  <Row label="Shift starts">
                    {employee?.shift_start
                      ? `${employee.shift_start}${
                          employee.late_grace_minutes != null
                            ? ` · ${employee.late_grace_minutes} min grace`
                            : ''
                        }`
                      : null}
                  </Row>
                </div>
              </dl>
            </DetailSection>

            <DetailSection title="Tax & National Insurance" icon={FileTextIcon} compact>
              <dl className="m-0 grid md:grid-cols-2">
                <div className="min-w-0 md:pr-4">
                  <Row label="Tax code">{employee?.tax_code}</Row>
                  <Row label="NI number">{employee?.ni_number}</Row>
                </div>
                <div className="border-border min-w-0 border-t pt-1.5 md:border-t-0 md:border-l md:pt-0 md:pl-4">
                  <Row label="NI category">{employee?.ni_category}</Row>
                  <Row label="Date of birth">{date(employee?.date_of_birth)}</Row>
                </div>
              </dl>
            </DetailSection>

            <DetailSection title="Security PIN" icon={ShieldCheckIcon} compact>
              <dl className="m-0 grid md:grid-cols-2">
                <div className="min-w-0 md:pr-4">
                  <Row label="PIN" wrap>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {viewed ? (
                        <RevealedPin viewed={viewed} onExpire={hidePin} />
                      ) : pin?.is_set == null ? (
                        <span className="text-text-muted font-normal">—</span>
                      ) : pin.is_set ? (
                        <span className="tracking-widest">{PIN_MASK}</span>
                      ) : (
                        'Not set'
                      )}
                      {viewed ? (
                        <button
                          type="button"
                          aria-label="Hide security PIN"
                          title="Hide PIN"
                          onClick={hidePin}
                          className={PIN_BUTTON}
                        >
                          <EyeOffIcon width={ROW_ACTION_ICON} height={ROW_ACTION_ICON} />
                        </button>
                      ) : (
                        pin?.is_set !== false && (
                          <button
                            type="button"
                            aria-label="View security PIN"
                            title="View PIN"
                            disabled={!userId}
                            onClick={() => setPinAction('view')}
                            className={PIN_BUTTON}
                          >
                            <EyeIcon width={ROW_ACTION_ICON} height={ROW_ACTION_ICON} />
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        aria-label="Edit security PIN"
                        title="Change PIN"
                        disabled={!userId}
                        onClick={() => {
                          setNotice(null)
                          hidePin()
                          setPinAction('change')
                        }}
                        className={PIN_BUTTON}
                      >
                        <PencilIcon width={ROW_ACTION_ICON} height={ROW_ACTION_ICON} />
                      </button>
                    </span>
                  </Row>
                  {viewed?.changeRequired && (
                    <p className="text-text m-0 py-1.5 text-[0.8rem] font-semibold">
                      This PIN needs to be changed. Use the pencil to set a new one.
                    </p>
                  )}
                  <Row label="Last set">{dateTime(pin?.set_at)}</Row>
                  <Row label="Set by">{pin?.set_by}</Row>
                </div>
                <div className="border-border min-w-0 border-t pt-1.5 md:border-t-0 md:border-l md:pt-0 md:pl-4">
                  <Row label="Failed attempts">
                    {pin?.failed_attempts == null ? null : String(pin.failed_attempts)}
                  </Row>
                  <Row label="Locked until">{dateTime(pin?.locked_until)}</Row>
                </div>
              </dl>
            </DetailSection>
          </div>
        </div>
      </div>

      {/* Outside the cards, so an Escape in the question never reaches an edit around it. */}
      {asking && (
        <ProfileUpdateDialog
          request={asking}
          onClose={() => setAsking(null)}
          onDone={(message) => {
            setAsking(null)
            setNotice(message || 'Your profile was updated.')
          }}
        />
      )}
      {pinAction && (
        <SecurityPinDialog
          action={pinAction}
          userId={userId}
          email={profile.email ?? ''}
          onClose={() => setPinAction(null)}
          onViewed={(result) => {
            setPinAction(null)
            setViewed(result)
          }}
          onChanged={(message) => {
            setPinAction(null)
            setNotice(message || 'Your security PIN was updated.')
          }}
        />
      )}
    </article>
  )
}
