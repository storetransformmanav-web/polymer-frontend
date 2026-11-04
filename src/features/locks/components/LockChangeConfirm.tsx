import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { useSaveLockOptions } from '../hooks/useLockWrites.ts'
import type { LockOptionChange } from '../utils/lockOptions.ts'
import { LockConfirmDialog } from './LockConfirmDialog.tsx'

/** One setting of a lock about to change: what it is called, and the words before and after. */
export interface PendingLockChange {
  lock: AccessLock
  change: LockOptionChange
  /** "Lock", "Hidden from lists", "Message"… */
  label: string
  from: string
  to: string
}

/**
 * "Are you sure?" before a lock's setting is changed, because it is also pushed to the store: the
 * lock's name, what changes (`label  from → to`) and Cancel / Yes, update. Nothing is sent until
 * "Yes, update"; the screen then changes at once (see `useSaveLockOptions`), and a refusal puts it
 * back and shows the backend's message inside the dialog, which stays open.
 */
export function LockChangeConfirm({
  pending,
  shop,
  onClose,
}: {
  pending: PendingLockChange
  shop: string
  onClose: () => void
}) {
  const { save } = useSaveLockOptions()
  const { lock, change, label, from, to } = pending

  return (
    <LockConfirmDialog
      title={`Update “${lock.title}”?`}
      confirmLabel="Yes, update"
      onClose={onClose}
      onConfirm={async () => {
        await save({ lock, shop, change })
        onClose()
      }}
    >
      <p className="text-[0.95rem] font-semibold">
        Are you sure you want to update this?
      </p>
      <p className="text-text-muted mt-1 text-[0.85rem]">
        These changes will also be updated in Shopify.
      </p>
      <div className="border-accent bg-surface mt-3 rounded-lg border-l-4 px-3 py-2.5 text-[0.85rem]">
        <div className="text-text-muted text-[0.72rem] font-bold uppercase">{label}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 break-words">
          <span className="text-text-muted line-through">{from}</span>
          <span aria-hidden="true" className="text-accent font-bold">
            →
          </span>
          <strong>{to}</strong>
        </div>
      </div>
    </LockConfirmDialog>
  )
}
