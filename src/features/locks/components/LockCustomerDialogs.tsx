import { useState } from 'react'
import type {
  AccessLock,
  LockCustomer,
  LockCustomerTag,
} from '../../../lib/api/endpoints.ts'
import { useSetLockCustomers, useUpdateAccessTags } from '../hooks/useLockWrites.ts'
import {
  customerName,
  customerRef,
  missingKeys,
  sharedTagsNote,
} from '../utils/format.ts'
import { LockConfirmDialog } from './LockConfirmDialog.tsx'

interface DialogProps {
  lock: AccessLock
  shop: string
  /** What the API is asked about: the product's handle, else its id. */
  product: string
  /** The lock's tags with how many locked products share each (from the customers answer). */
  sharedTags: LockCustomerTag[]
  onClose: () => void
  /** The backend's message, shown once the change is saved. */
  onDone: (message: string) => void
}

const NOTE = 'bg-warning-bg text-warning mt-3 rounded-lg px-3 py-2 text-[0.82rem]'

/**
 * The lock's keys as tick boxes, so a customer can be given several at once. Each is a pill that
 * is tinted while ticked; the caller disables its button while none is ticked.
 */
export function KeyChoices({
  label,
  keys,
  chosen,
  onChange,
}: {
  label: string
  keys: readonly string[]
  chosen: readonly string[]
  onChange: (next: string[]) => void
}) {
  const on = new Set(chosen)
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-none p-0">
      <legend className="text-text-muted float-left mr-1 text-[0.78rem] font-semibold">
        {label}
      </legend>
      {keys.map((key) => {
        const ticked = on.has(key)
        return (
          <label
            key={key}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.78rem] font-semibold transition-colors ${
              ticked
                ? 'border-accent bg-accent-tint text-text'
                : 'border-border bg-bg text-text-muted hover:border-accent'
            }`}
          >
            <input
              type="checkbox"
              checked={ticked}
              onChange={() =>
                onChange(
                  ticked
                    ? chosen.filter((item) => item !== key)
                    : keys.filter((item) => item === key || on.has(item)),
                )
              }
              className="accent-accent m-0 h-3.5 w-3.5 cursor-pointer"
            />
            {key}
          </label>
        )
      })}
    </fieldset>
  )
}

/**
 * "Edit access" — gives one customer who is already in the list another of the lock's keys: it
 * offers only the keys that customer does not hold yet. A tag is chosen only when the lock has
 * several (`tag` is sent only then); several keys can be ticked, and then they all go in one
 * `PUT /access/tags` (`customers` + `tags_add`). The dialog is the question: it names the tag and, when other
 * locked products share it, how many; only "Give access" sends `{ add, tag? }`. (Adding new
 * customers has no window: the Customer Access tab does it at once.) An error from the backend
 * shows inside the dialog, which stays open.
 */
export function AddCustomersDialog({
  lock,
  shop,
  product,
  sharedTags,
  editing,
  onClose,
  onDone,
}: DialogProps & { editing: LockCustomer }) {
  const { set } = useSetLockCustomers()
  const { update } = useUpdateAccessTags()
  const choices = missingKeys(lock.tags, editing.tags)
  const several = lock.tags.length > 1
  const [chosen, setChosen] = useState<string[]>(choices.slice(0, 1))
  const refs = [customerRef(editing)]
  const given = several ? chosen : lock.tags
  const note = sharedTagsNote(sharedTags, given)

  return (
    <LockConfirmDialog
      title={`Edit access of ${customerName(editing)}`}
      confirmLabel="Give access"
      confirmDisabled={several && chosen.length === 0}
      onClose={onClose}
      onConfirm={async () => {
        // One key: the lock's own customers call. Several: `PUT /access/tags`, which gives a
        // customer several tags in one call (the customers call takes only one `tag`).
        const result =
          several && chosen.length > 1
            ? await update({ shop, customers: [editing.id], tags_add: chosen })
            : await set({
                product,
                body: { shop, add: refs, ...(several ? { tag: chosen[0] } : {}) },
              })
        onDone(result.message)
        onClose()
      }}
    >
      <p className="text-text-muted text-[0.85rem]">
        {`Give ${customerName(editing)} another key to “${lock.title}”.`} These changes
        will also be updated in Shopify.
      </p>
      <p className="mt-3 text-[0.85rem]">
        <span className="text-text-muted">Customer: </span>
        <strong>{editing.email ?? editing.id}</strong>
        {editing.tags.length > 0 && (
          <span className="text-text-muted"> · holds {editing.tags.join(', ')}</span>
        )}
      </p>
      {several ? (
        <div className="mt-3">
          <KeyChoices
            label="Tags to give"
            keys={choices}
            chosen={chosen}
            onChange={setChosen}
          />
        </div>
      ) : (
        <p className="mt-3 text-[0.85rem]">
          <span className="text-text-muted">Tag given: </span>
          <strong>{lock.tags[0]}</strong>
        </p>
      )}
      {note && (
        <p role="note" className={NOTE}>
          {note}
        </p>
      )}
    </LockConfirmDialog>
  )
}

/**
 * "Remove access": takes away every lock tag of this product the customer holds (`{ remove }`).
 * Says which tags those are and — when they are shared — that the customer loses access to the
 * other products using them too.
 */
export function RemoveCustomerDialog({
  customer,
  lock,
  shop,
  product,
  sharedTags,
  onClose,
  onDone,
}: DialogProps & { customer: LockCustomer }) {
  const { set } = useSetLockCustomers()
  const held = customer.tags.length > 0 ? customer.tags : lock.tags
  const note = sharedTagsNote(sharedTags, held)
  const name = customerName(customer)

  return (
    <LockConfirmDialog
      title={`Remove access of ${name}?`}
      confirmLabel="Remove access"
      danger
      onClose={onClose}
      onConfirm={async () => {
        const result = await set({
          product,
          body: { shop, remove: [customerRef(customer)] },
        })
        onDone(result.message)
        onClose()
      }}
    >
      <p className="text-[0.95rem] font-semibold">
        Are you sure you want to update this?
      </p>
      <p className="text-text-muted mt-1 text-[0.85rem]">
        {customer.email ?? name} will no longer be able to open “{lock.title}”. These
        changes will also be updated in Shopify.
      </p>
      {held.length > 0 && (
        <p className="mt-3 text-[0.85rem]">
          <span className="text-text-muted">Tags taken away: </span>
          <strong>{held.join(', ')}</strong>
        </p>
      )}
      {note && (
        <p role="note" className={NOTE}>
          {note}
        </p>
      )}
    </LockConfirmDialog>
  )
}
