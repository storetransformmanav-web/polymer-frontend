import { useState } from 'react'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import type {
  AccessLock,
  LockCustomer,
  LockCustomerTag,
} from '../../../lib/api/endpoints.ts'
import { useSetLockCustomers } from '../hooks/useLockWrites.ts'
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
 * "Edit access" — gives one customer who is already in the list another of the lock's keys: it
 * offers only the keys that customer does not hold yet. A tag is chosen only when the lock has
 * several (`tag` is sent only then). The dialog is the question: it names the tag and, when other
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
  const choices = missingKeys(lock.tags, editing.tags)
  const several = lock.tags.length > 1
  const [tag, setTag] = useState(choices[0] ?? '')
  const refs = [customerRef(editing)]
  const given = several ? [tag] : lock.tags
  const note = sharedTagsNote(sharedTags, given)

  return (
    <LockConfirmDialog
      title={`Edit access of ${customerName(editing)}`}
      confirmLabel="Give access"
      confirmDisabled={several && !tag}
      onClose={onClose}
      onConfirm={async () => {
        const result = await set({
          product,
          body: { shop, add: refs, ...(several ? { tag } : {}) },
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
          <SelectField
            compact
            id="lock-customers-give-tag"
            label="Tag to give"
            value={tag}
            options={choices.map((item) => ({ value: item, label: item }))}
            onChange={setTag}
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
