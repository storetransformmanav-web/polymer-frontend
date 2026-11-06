import { useState } from 'react'
import { shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { DetailSection } from '../../../components/ui/DetailSection.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import { CheckIcon, PencilIcon, StoreIcon, XIcon } from '../../../components/ui/icons.tsx'
import type { Shop, UserDetail } from '../../../lib/api/endpoints.ts'
import { isAdminRole } from '../utils/format.ts'
import { buildUserUpdateBody } from '../utils/userEdit.ts'
import type { UserUpdateRequest } from './UserUpdateDialog.tsx'

/** Asks "Are you sure?"; `onSaved` runs once the update went through (the edit then closes). */
type Ask = (request: UserUpdateRequest, onSaved?: () => void) => void

const namesOf = (keys: string[], shopNames: Record<string, string>) =>
  keys.length === 0 ? 'No stores' : keys.map((key) => shopNames[key] ?? key).join(', ')

/**
 * The "Store access" card of the Access tab. Viewing, it lists the stores (administrators see
 * every store, so there is nothing to change). The card's small pencil turns the list into one
 * checkbox per store; ✓ Save asks "Are you sure?" with the old stores → the new ones and sends
 * `shop_keys`, ✕ Discard (or Escape) sends nothing.
 */
export function UserStoreAccess({
  user,
  shops,
  shopNames,
  onAsk,
}: {
  user: UserDetail
  /** Every store the signed-in user can see — what this user can be given. */
  shops: Shop[]
  /** Store key → display name. */
  shopNames: Record<string, string>
  onAsk: Ask
}) {
  const isAdmin = isAdminRole(user.role)
  const [draft, setDraft] = useState<string[] | null>(null)
  const editing = draft !== null

  function toggle(key: string) {
    setDraft((current) =>
      (current ?? []).includes(key)
        ? (current ?? []).filter((value) => value !== key)
        : [...(current ?? []), key],
    )
  }

  function save() {
    if (draft === null) return
    const same =
      draft.length === user.shop_keys.length &&
      draft.every((key) => user.shop_keys.includes(key))
    if (same) {
      setDraft(null)
      return
    }
    onAsk(
      {
        change: {
          label: 'Store access',
          from: namesOf(user.shop_keys, shopNames),
          to: namesOf(draft, shopNames),
        },
        body: buildUserUpdateBody(user, { shopKeys: draft }),
      },
      () => setDraft(null),
    )
  }

  const actions = isAdmin ? undefined : editing ? (
    <>
      <IconAction
        label="Save"
        accessibleLabel="Save store access"
        icon={CheckIcon}
        tone="primary"
        onClick={save}
      />
      <IconAction
        label="Discard"
        accessibleLabel="Discard store access"
        icon={XIcon}
        onClick={() => setDraft(null)}
      />
    </>
  ) : (
    <IconAction
      label="Edit"
      accessibleLabel="Edit store access"
      icon={PencilIcon}
      onClick={() => setDraft([...user.shop_keys])}
    />
  )

  return (
    <DetailSection
      title="Store access"
      count={isAdmin ? undefined : user.shop_keys.length}
      icon={StoreIcon}
      actions={actions}
    >
      {isAdmin ? (
        <p className="text-[0.9rem]">Administrators can see every store.</p>
      ) : editing ? (
        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape') setDraft(null)
          }}
        >
          {shops.length === 0 ? (
            <p className="text-text-muted text-[0.9rem]">No stores available.</p>
          ) : (
            <ul className="border-border divide-border flex max-w-md flex-col divide-y overflow-hidden rounded-lg border">
              {shops.map((shop) => {
                const key = shopValue(shop)
                return (
                  <li key={shop.id}>
                    <label className="hover:bg-surface flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[0.88rem]">
                      <input
                        type="checkbox"
                        checked={draft.includes(key)}
                        onChange={() => toggle(key)}
                        className="accent-accent h-4 w-4 shrink-0 cursor-pointer"
                      />
                      <span className="min-w-0 truncate font-medium">
                        {shopLabel(shop)}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : user.shop_keys.length === 0 ? (
        <p className="text-text-muted text-[0.9rem]">No stores have been given.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {user.shop_keys.map((key) => (
            <li
              key={key}
              title={key}
              className="bg-accent-tint text-accent rounded-full px-2.5 py-0.5 text-xs font-semibold"
            >
              {shopNames[key] ?? key}
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  )
}
