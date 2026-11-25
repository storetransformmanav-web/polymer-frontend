import { useState } from 'react'
import { ChoiceEdit } from '../../../components/ui/ChoiceEdit.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import { DoubleClickEdit } from '../../../components/ui/DoubleClickEdit.tsx'
import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import type { UserCreateEmployee, UserDetail } from '../../../lib/api/endpoints.ts'
import { formatDate } from '../../../lib/format.ts'
import { useManagerOptions } from '../hooks/useManagerOptions.ts'
import { buildUserEmployeeBody, validateMinutes } from '../utils/userEdit.ts'
import type { AskUserUpdate } from './UserEditCells.tsx'

/** The employee details that are one line of text (or a date, a time or a number of minutes). */
export type EmployeeField =
  | 'position'
  | 'department'
  | 'joining_date'
  | 'leaving_date'
  | 'date_of_birth'
  | 'shift_start'
  | 'late_grace_minutes'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'postcode'
  | 'tax_code'
  | 'ni_number'
  | 'ni_category'
  | 'emergency_name'
  | 'emergency_phone'

type Kind = 'text' | 'date' | 'time' | 'number'

/** What the details answer holds for one of those fields ('' when it has nothing). */
function readEmployee(user: UserDetail, field: EmployeeField): string {
  const e = user.employee
  const text = (value: string | null | undefined) => (value ?? '').trim()
  switch (field) {
    case 'position':
      return text(e?.position)
    case 'department':
      return text(e?.department)
    case 'joining_date':
      return text(e?.joining_date).slice(0, 10)
    case 'leaving_date':
      return text(e?.leaving_date).slice(0, 10)
    case 'date_of_birth':
      return text(e?.date_of_birth).slice(0, 10)
    case 'shift_start':
      return text(e?.shift_start)
    case 'late_grace_minutes':
      return e?.late_grace_minutes == null ? '' : String(e.late_grace_minutes)
    case 'address_line1':
      return text(e?.address?.line1)
    case 'address_line2':
      return text(e?.address?.line2)
    case 'city':
      return text(e?.address?.city)
    case 'postcode':
      return text(e?.address?.postcode)
    case 'tax_code':
      return text(e?.tax_code)
    case 'ni_number':
      return text(e?.ni_number)
    case 'ni_category':
      return text(e?.ni_category)
    case 'emergency_name':
      return text(e?.emergency_contact?.name)
    case 'emergency_phone':
      return text(e?.emergency_contact?.phone)
  }
}

const show = (value: string, kind: Kind) =>
  value === '' ? '—' : kind === 'date' ? formatDate(value) : value

/**
 * One of a user's employee details, changed where it is shown: the small pencil (or a double-click,
 * or Enter on it) turns it into a box — a date box opens its calendar on a click — and Enter or
 * leaving it asks "Are you sure?" with old → new; only "Yes, update" sends it, as the `employee`
 * block of `PUT /users/{user_id}` holding just this field. Escape sends nothing.
 */
export function UserEmployeeCell({
  user,
  field,
  label,
  kind = 'text',
  onAsk,
  maxLength = 120,
}: {
  user: UserDetail
  field: EmployeeField
  label: string
  kind?: Kind
  onAsk: AskUserUpdate
  maxLength?: number
}) {
  const saved = readEmployee(user, field)

  return (
    <DoubleClickEdit
      value={saved}
      showActions
      label={label}
      showIcon
      maxLength={kind === 'number' ? 4 : maxLength}
      inputType={kind === 'text' ? undefined : kind}
      validate={field === 'late_grace_minutes' ? validateMinutes : undefined}
      onCommit={(next) => {
        const employee: UserCreateEmployee =
          field === 'late_grace_minutes'
            ? { late_grace_minutes: Number(next) }
            : { [field]: next }
        onAsk({
          change: {
            label,
            from: show(saved, kind),
            to: show(next, kind),
          },
          body: buildUserEmployeeBody(user, employee),
        })
      }}
      display={
        <span className={`break-all ${saved === '' ? 'text-text-muted' : ''}`}>
          {show(saved, kind)}
        </span>
      }
    />
  )
}

/** The manager, chosen from the other users (a dropdown that opens on a double-click or its pencil). */
export function UserManagerCell({
  user,
  onAsk,
}: {
  user: UserDetail
  onAsk: AskUserUpdate
}) {
  const manager = user.employee?.manager
  const current = manager?.user_id ?? ''
  const { managers } = useManagerOptions(true)
  const name = (id: string) =>
    id === '' ? 'No manager' : (managers.find((person) => person.id === id)?.label ?? id)

  const display = (
    <span className={manager?.full_name ? '' : 'text-text-muted'}>
      {manager?.full_name
        ? `${manager.full_name}${manager.employee_code ? ` · ${manager.employee_code}` : ''}`
        : '—'}
    </span>
  )
  // The people list hasn't arrived (or failed): show the manager, nothing to choose from.
  if (managers.length === 0) return display

  return (
    <ChoiceEdit
      value={current}
      label="Manager"
      display={display}
      options={[
        { value: '', label: 'No manager' },
        ...managers
          .filter((person) => person.id !== user.id)
          .map((person) => ({ value: person.id, label: person.label })),
      ]}
      onCommit={(next) =>
        onAsk({
          change: {
            label: 'Manager',
            from: manager?.full_name ?? 'No manager',
            to: name(next),
          },
          body: buildUserEmployeeBody(user, { manager_user_id: next }),
        })
      }
    />
  )
}

/**
 * Sets a new security PIN: the box hides what is typed, the current PIN is never shown, and the
 * question shows dots. It opens from its own pencil or from the card's "Set / Update PIN" button
 * (`editing` is held by the card). Enter or ✓ asks "Are you sure?", Escape or ✕ sends nothing. The
 * backend checks the PIN and says why if it refuses it.
 */
export function UserPinCell({
  user,
  onAsk,
  editing,
  onEditingChange,
}: {
  user: UserDetail
  onAsk: AskUserUpdate
  editing: boolean
  onEditingChange: (editing: boolean) => void
}) {
  const [draft, setDraft] = useState('')
  const [reveal, setReveal] = useState(false)
  const isSet = user.employee?.security_pin?.is_set

  function close() {
    setDraft('')
    setReveal(false)
    onEditingChange(false)
  }

  function commit() {
    const next = draft.trim()
    close()
    if (!next) return
    onAsk({
      change: { label: 'Security PIN', from: isSet ? 'Set' : 'Not set', to: '••••' },
      body: buildUserEmployeeBody(user, { security_pin: next }),
    })
  }

  if (!editing) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="text-text-muted font-normal">
          {isSet ? 'Set — enter a new PIN to replace it' : 'Not set — enter a PIN'}
        </span>
        <button
          type="button"
          aria-label="Edit New security PIN"
          onClick={() => onEditingChange(true)}
          className="text-text-muted hover:text-accent inline-flex shrink-0 cursor-pointer border-none bg-transparent p-0.5 opacity-70 transition-colors hover:opacity-100"
        >
          <PencilIcon width={12} height={12} />
        </button>
      </span>
    )
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <input
        autoFocus
        type={reveal ? 'text' : 'password'}
        autoComplete="new-password"
        inputMode="numeric"
        maxLength={20}
        aria-label="New security PIN"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
          }
        }}
        className="border-accent bg-bg text-text focus:outline-accent-tint h-8 w-full min-w-0 rounded-lg border px-2 text-[0.8rem] font-medium outline-none focus:outline-2"
      />
      <button
        type="button"
        aria-label={reveal ? 'Hide new security PIN' : 'Show new security PIN'}
        aria-pressed={reveal}
        onClick={() => setReveal((value) => !value)}
        className="text-text-muted hover:text-accent inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent transition-colors"
      >
        {reveal ? (
          <EyeOffIcon width={16} height={16} />
        ) : (
          <EyeIcon width={16} height={16} />
        )}
      </button>
      <IconAction
        label="Save"
        accessibleLabel="Save new security PIN"
        icon={CheckIcon}
        tone="primary"
        onClick={commit}
      />
      <IconAction
        label="Discard"
        accessibleLabel="Discard new security PIN"
        icon={XIcon}
        onClick={close}
      />
    </span>
  )
}
