import { useState } from 'react'
import { createPortal } from 'react-dom'
import { PillSelect, type PillOption } from '../../../components/ui/PillSelect.tsx'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { flagWord } from '../utils/lockOptions.ts'
import { LockChangeConfirm, type PendingLockChange } from './LockChangeConfirm.tsx'

const OPTIONS: PillOption[] = [
  { value: 'active', label: flagWord('enabled', true), tone: 'success' },
  { value: 'inactive', label: flagWord('enabled', false), tone: 'neutral' },
]

/**
 * A lock's status in the list: **Enabled** or **Disabled**, read from the API's `enabled` flag
 * (true / false), as a dropdown pill (the same control as a product's status). Picking the other
 * one asks "Are you sure?" and only then sends the change (`POST /access/locks` with `enabled` —
 * see `useSaveLockOptions`); the row changes at once and goes back if the backend refuses. The
 * question is drawn on the page body, so the table's `whitespace-nowrap` cells never squeeze it.
 */
export function LockStatusSelect({ lock, shop }: { lock: AccessLock; shop: string }) {
  const [pending, setPending] = useState<PendingLockChange | null>(null)

  return (
    <>
      <PillSelect
        label={`Status of ${lock.title}: ${flagWord('enabled', lock.enabled)}`}
        menuLabel={`Status of ${lock.title}`}
        options={OPTIONS}
        value={lock.enabled ? 'active' : 'inactive'}
        onChange={(next) =>
          setPending({
            lock,
            change: { enabled: next === 'active' },
            lines: [
              {
                label: 'Status',
                from: flagWord('enabled', lock.enabled),
                to: flagWord('enabled', next === 'active'),
              },
            ],
          })
        }
      />
      {pending &&
        createPortal(
          <LockChangeConfirm
            pending={pending}
            shop={shop}
            onClose={() => setPending(null)}
          />,
          document.body,
        )}
    </>
  )
}
