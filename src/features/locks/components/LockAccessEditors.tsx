import { useState } from 'react'
import { DetailSection } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import { CheckIcon, PencilIcon, UsersIcon, XIcon } from '../../../components/ui/icons.tsx'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { useUpdateAccessTags } from '../hooks/useLockWrites.ts'
import { diffTags, MAX_ITEMS, MAX_TAGS, parseCustomerRefs } from '../utils/lockDraft.ts'
import { LockConfirmDialog } from './LockConfirmDialog.tsx'
import { TagPicker } from './TagPicker.tsx'

/** A tag chip: the same pill as a product's tags. */
const TAG_CHIP =
  'bg-surface text-text border-border rounded-md border px-2.5 py-1 text-[0.8rem] font-medium'

/** What `PUT /access/tags` takes to name the product: its handle (the id also works). */
const productRef = (lock: AccessLock) => lock.handle ?? lock.product_id

const SHOPIFY_NOTE = 'These changes will also be updated in Shopify.'

/**
 * The lock's **keys** (its tags), under the Protected product fields: chips while viewing, with a
 * pencil. The pencil turns them into the tag picker (the store's tags from `GET /access/tags`,
 * a new one typed); ✓ Save asks "Are you sure?" with what will be added and removed, and then
 * sends one `PUT /access/tags` for this product with `tags_add` / `tags_remove` — nothing else.
 * ✕ Discard drops the edit.
 */
export function LockKeysSection({ lock, shop }: { lock: AccessLock; shop: string }) {
  const [draft, setDraft] = useState<string[] | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { update } = useUpdateAccessTags()
  const editing = draft !== null
  const change = diffTags(lock.tags, draft ?? lock.tags)
  const changed = change.add.length > 0 || change.remove.length > 0
  const full = (draft?.length ?? 0) >= MAX_TAGS

  function save() {
    if (changed) setConfirming(true)
    else setDraft(null)
  }

  return (
    <section aria-labelledby="lock-keys-heading" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 id="lock-keys-heading" className="text-[0.95rem] font-semibold">
          Keys (tags)
        </h3>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <IconAction
                label="Save"
                accessibleLabel="Save keys"
                icon={CheckIcon}
                tone="primary"
                disabled={!changed}
                onClick={save}
              />
              <IconAction
                label="Discard"
                accessibleLabel="Discard keys"
                icon={XIcon}
                onClick={() => setDraft(null)}
              />
            </>
          ) : (
            <IconAction
              label="Edit"
              accessibleLabel="Edit keys"
              icon={PencilIcon}
              onClick={() => {
                setNotice(null)
                setDraft([...lock.tags])
              }}
            />
          )}
        </div>
      </div>

      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      {editing ? (
        <div className="flex flex-col gap-2">
          <TagPicker
            shop={shop}
            selected={draft}
            onAdd={(tags) =>
              setDraft((current) =>
                [...(current ?? []), ...tags]
                  .filter(
                    (tag, index, all) =>
                      all.findIndex(
                        (other) => other.toLowerCase() === tag.toLowerCase(),
                      ) === index,
                  )
                  .slice(0, MAX_TAGS),
              )
            }
            onRemove={(tag) =>
              setDraft((current) =>
                (current ?? []).filter(
                  (other) => other.toLowerCase() !== tag.toLowerCase(),
                ),
              )
            }
          />
          <p className="text-text-muted text-[0.78rem]">
            {full
              ? `A lock has at most ${MAX_TAGS} keys.`
              : draft.length === 0
                ? 'With no keys, any signed-in customer can open the product.'
                : 'A customer with any of these tags can open the product.'}
          </p>
        </div>
      ) : lock.tags.length > 0 ? (
        <ul
          aria-label="Keys"
          className="border-border bg-bg flex flex-wrap gap-1.5 rounded-xl border p-2.5"
        >
          {lock.tags.map((tag) => (
            <li key={tag} className={TAG_CHIP}>
              {tag}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-border bg-bg text-text-muted rounded-xl border p-2.5 text-[0.85rem]">
          No keys: any signed-in customer can open this product.
        </p>
      )}

      {confirming && draft && (
        <LockConfirmDialog
          title={`Update the keys of “${lock.title}”?`}
          confirmLabel="Yes, update"
          danger={change.remove.length > 0 && change.add.length === 0}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            const result = await update({
              shop,
              products: [productRef(lock)],
              tags_add: change.add,
              tags_remove: change.remove,
            })
            setNotice(result.message)
            setConfirming(false)
            setDraft(null)
          }}
        >
          <p className="text-[0.95rem] font-semibold">
            Are you sure you want to update this?
          </p>
          <p className="text-text-muted mt-1 text-[0.85rem]">{SHOPIFY_NOTE}</p>
          <dl className="mt-3 flex flex-col gap-2 text-[0.85rem]">
            {change.add.length > 0 && (
              <div>
                <dt className="text-text-muted text-[0.72rem] font-bold uppercase">
                  Keys to add
                </dt>
                <dd className="text-accent m-0 font-semibold">{change.add.join(', ')}</dd>
              </div>
            )}
            {change.remove.length > 0 && (
              <div>
                <dt className="text-text-muted text-[0.72rem] font-bold uppercase">
                  Keys to remove
                </dt>
                <dd className="text-danger m-0 font-semibold">
                  {change.remove.join(', ')}
                </dd>
              </div>
            )}
          </dl>
        </LockConfirmDialog>
      )}
    </section>
  )
}

type AccessMode = 'give' | 'remove'

/**
 * Who has the lock's keys. Viewing: how many customers can open the product. The pencil opens a
 * small form — **Give access** or **Remove access**, and the customers (emails or ids, separated
 * by commas, spaces or new lines) — and ✓ Save asks first, then sends one `PUT /access/tags` with
 * `customers` and the lock's keys as `tags_add` (give) or `tags_remove` (remove). Needs at least
 * one key on the lock.
 */
export function LockCustomersSection({ lock, shop }: { lock: AccessLock; shop: string }) {
  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState<AccessMode>('give')
  const [text, setText] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { update } = useUpdateAccessTags()
  const customers = parseCustomerRefs(text)
  const hasKeys = lock.tags.length > 0
  const tooMany = customers.length > MAX_ITEMS
  const ready = hasKeys && customers.length > 0 && !tooMany

  function close() {
    setEditing(false)
    setText('')
    setMode('give')
    setConfirming(false)
  }

  const count = lock.customers_with_access ?? undefined

  return (
    <DetailSection
      title="Customer access"
      icon={UsersIcon}
      count={count}
      actions={
        editing ? (
          <>
            <IconAction
              label="Save"
              accessibleLabel="Save customer access"
              icon={CheckIcon}
              tone="primary"
              disabled={!ready}
              onClick={() => setConfirming(true)}
            />
            <IconAction
              label="Discard"
              accessibleLabel="Discard customer access"
              icon={XIcon}
              onClick={close}
            />
          </>
        ) : (
          <IconAction
            label="Edit"
            accessibleLabel="Edit customer access"
            icon={PencilIcon}
            onClick={() => {
              setNotice(null)
              setEditing(true)
            }}
          />
        )
      }
    >
      <div className="flex flex-col gap-3">
        {notice && <FormMessage tone="success">{notice}</FormMessage>}

        {!editing ? (
          <p className="text-text-muted text-[0.85rem]">
            {hasKeys
              ? `Customers who carry ${lock.tags.length === 1 ? 'the key' : 'one of the keys'} (${lock.tags.join(', ')}) can open this product. Use the pencil to give access to a customer or take it away.`
              : 'This lock has no keys, so any signed-in customer can open the product. Add a key first to give access to particular customers.'}
          </p>
        ) : (
          <>
            {!hasKeys && (
              <FormMessage tone="info">
                Add a key to this lock first — access is given by tagging customers with
                its keys.
              </FormMessage>
            )}
            <fieldset className="m-0 flex flex-wrap gap-4 border-none p-0">
              <legend className="sr-only">What to do</legend>
              {(
                [
                  ['give', 'Give access'],
                  ['remove', 'Remove access'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 text-[0.88rem] font-semibold"
                >
                  <input
                    type="radio"
                    name="lock-access-mode"
                    className="accent-accent h-4 w-4 cursor-pointer"
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.78rem] font-semibold">
                Customers (emails or ids)
              </span>
              <textarea
                rows={3}
                aria-label="Customers"
                placeholder="buyer@example.com, other@example.com"
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="border-border bg-surface text-text placeholder:text-text-muted focus:border-accent focus:outline-accent-tint min-h-20 w-full resize-y rounded-lg border px-3 py-2 text-[0.88rem] outline-none focus:outline-2"
              />
              <span
                className={`text-[0.78rem] ${tooMany ? 'text-danger' : 'text-text-muted'}`}
              >
                {tooMany
                  ? `At most ${MAX_ITEMS} customers at a time.`
                  : customers.length === 0
                    ? 'Separate them with commas, spaces or new lines.'
                    : `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}`}
              </span>
            </label>
          </>
        )}
      </div>

      {confirming && (
        <LockConfirmDialog
          title={
            mode === 'give'
              ? `Give access to ${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}?`
              : `Remove access from ${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}?`
          }
          confirmLabel={mode === 'give' ? 'Yes, give access' : 'Yes, remove access'}
          danger={mode === 'remove'}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            const result = await update({
              shop,
              customers,
              ...(mode === 'give' ? { tags_add: lock.tags } : { tags_remove: lock.tags }),
            })
            close()
            setNotice(result.message)
          }}
        >
          <p className="text-[0.95rem] font-semibold">
            Are you sure you want to update this?
          </p>
          <p className="text-text-muted mt-1 text-[0.85rem]">{SHOPIFY_NOTE}</p>
          <dl className="mt-3 flex flex-col gap-2 text-[0.85rem]">
            <div>
              <dt className="text-text-muted text-[0.72rem] font-bold uppercase">
                {mode === 'give' ? 'Keys they will get' : 'Keys they will lose'}
              </dt>
              <dd className="m-0 flex flex-wrap gap-1.5 pt-1">
                {lock.tags.map((tag) => (
                  <span key={tag} className={TAG_CHIP}>
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted text-[0.72rem] font-bold uppercase">
                Customers
              </dt>
              <dd className="m-0 font-semibold break-words">{customers.join(', ')}</dd>
            </div>
          </dl>
        </LockConfirmDialog>
      )}
    </DetailSection>
  )
}
