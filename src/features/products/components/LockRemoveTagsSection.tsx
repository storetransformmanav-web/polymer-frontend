import { useState } from 'react'
import { TagIcon, TrashIcon } from '../../../components/ui/icons.tsx'
import type { AccessLock, LockCustomer } from '../../../lib/api/endpoints.ts'
import { findOwnTag, withoutOwnTag } from '../../../lib/lockOwnTag.ts'

const BUTTON =
  'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

const lower = (value: string) => value.trim().toLowerCase()

/**
 * **Remove tags**, the dropdown beside Add tags: the tags the ticked customers hold (never the
 * lock's own `lock-…` tag), each with a tick box and how many of them hold it. **Remove** hands
 * the ticked tags over (the page asks before anything is sent).
 */
export function LockRemoveTagsSection({
  lock,
  customers,
  busy,
  onCancel,
  onRemove,
}: {
  lock: AccessLock
  /** The customers ticked in the table: the tags are taken from all of them. */
  customers: LockCustomer[]
  busy: boolean
  onCancel: () => void
  onRemove: (tags: string[]) => void
}) {
  const ownTag = findOwnTag(lock.tags, lock.handle)
  const [chosen, setChosen] = useState<string[]>([])
  const chosenSet = new Set(chosen.map(lower))

  // Every tag the ticked customers hold, with how many of them hold it.
  const counts = new Map<string, { tag: string; count: number }>()
  for (const customer of customers) {
    for (const tag of withoutOwnTag(customer.tags, ownTag)) {
      const entry = counts.get(lower(tag))
      if (entry) entry.count += 1
      else counts.set(lower(tag), { tag, count: 1 })
    }
  }
  const tags = [...counts.values()].sort((a, b) => a.tag.localeCompare(b.tag))

  function toggle(tag: string) {
    setChosen((current) =>
      current.some((item) => lower(item) === lower(tag))
        ? current.filter((item) => lower(item) !== lower(tag))
        : [...current, tag],
    )
  }

  return (
    <div className="flex w-[24rem] max-w-[85vw] flex-col gap-3 p-2">
      <div className="flex items-center gap-2">
        <TagIcon width={16} height={16} className="text-danger shrink-0" />
        <h3 className="m-0 text-[0.88rem] font-bold">
          Remove tags from{' '}
          {customers.length === 1
            ? (customers[0].name ?? customers[0].email ?? '1 customer')
            : `${customers.length} customers`}
        </h3>
      </div>

      {tags.length === 0 ? (
        <p className="text-text-muted m-0 text-[0.82rem]">
          The ticked customers hold no tags to remove.
        </p>
      ) : (
        <ul className="border-border m-0 max-h-56 list-none overflow-y-auto rounded-lg border p-0">
          {tags.map((item) => (
            <li key={item.tag} className="border-border border-b last:border-b-0">
              <label className="hover:bg-danger-bg/40 flex cursor-pointer items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={chosenSet.has(lower(item.tag))}
                  onChange={() => toggle(item.tag)}
                  className="accent-accent h-4 w-4"
                />
                <span className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold">
                  {item.tag}
                </span>
                {customers.length > 1 && (
                  <span className="text-text-muted text-[0.72rem]">
                    {item.count} of {customers.length}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || chosen.length === 0}
          onClick={() => onRemove(chosen)}
          className={`${BUTTON} bg-danger border-transparent text-white hover:opacity-90`}
        >
          <TrashIcon width={14} height={14} />
          {chosen.length > 0
            ? `Remove ${chosen.length} ${chosen.length === 1 ? 'tag' : 'tags'}`
            : 'Remove'}
        </button>
      </div>
    </div>
  )
}
