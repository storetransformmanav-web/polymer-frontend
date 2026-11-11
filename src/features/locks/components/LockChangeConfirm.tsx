import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { useSaveLockOptions } from '../hooks/useLockWrites.ts'
import type { LockOptionChange } from '../utils/lockOptions.ts'
import { LockConfirmDialog } from './LockConfirmDialog.tsx'

/** One setting about to change: what it is called, and the words before and after. */
export interface LockChangeLine {
  /** "Status", "Hidden from lists"… */
  label: string
  from: string
  to: string
}

/** The settings of a lock about to change, sent together in one request. */
export interface PendingLockChange {
  lock: AccessLock
  change: LockOptionChange
  /** What the question lists, one line per setting. */
  lines: LockChangeLine[]
}

/**
 * "Are you sure?" before a lock's settings are changed, because they are also pushed to the store:
 * the lock's name, what changes (one `label  from → to` line each) and Cancel / Yes, update. Nothing is sent until
 * "Yes, update"; the screen then changes at once (see `useSaveLockOptions`), and a refusal puts it
 * back and shows the backend's message inside the dialog, which stays open.
 */
export function LockChangeConfirm({
  pending,
  shop,
  onClose,
  onSaved,
}: {
  pending: PendingLockChange
  shop: string
  onClose: () => void
  /** The backend accepted the change. */
  onSaved?: () => void
}) {
  const { save } = useSaveLockOptions()
  const { lock, change, lines } = pending

  return (
    <LockConfirmDialog
      title={`Update “${lock.title}”?`}
      confirmLabel="Yes, update"
      onClose={onClose}
      onConfirm={async () => {
        await save({ lock, shop, change })
        onSaved?.()
        onClose()
      }}
    >
      <p className="text-[0.95rem] font-semibold">
        Are you sure you want to update this?
      </p>
      <p className="text-text-muted mt-1 text-[0.85rem]">
        These changes will also be updated in Shopify.
      </p>
      <ul className="border-accent bg-surface mt-3 flex list-none flex-col gap-2.5 rounded-lg border-l-4 px-3 py-2.5 text-[0.85rem]">
        {lines.map(({ label, from, to }) => (
          <li key={label}>
            <div className="text-text-muted text-[0.72rem] font-bold uppercase">
              {label}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 break-words">
              <span className="text-text-muted line-through">{from}</span>
              <span aria-hidden="true" className="text-accent font-bold">
                →
              </span>
              <strong>{to}</strong>
            </div>
          </li>
        ))}
      </ul>
    </LockConfirmDialog>
  )
}
