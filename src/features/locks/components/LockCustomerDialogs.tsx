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
import { MAX_ITEMS, parseCustomerRefs } from '../utils/lockDraft.ts'
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
 * "Give access" — to new customers (the box takes emails or ids, separated by commas, spaces or
 * new lines; `initialText` fills it, e.g. with the customer that was just checked) or, with
 * `editing`, to one customer who is already in the list: **Edit** then offers the lock's other tags
 * that customer does not hold yet. A tag is chosen only when the lock has several (`tag` is sent
 * only then). The dialog is the question: it names the tag and, when other locked products share
 * it, how many; only "Give access" sends `{ add, tag? }`. A customer who already has the access
 * is refused by the backend, and its message shows inside the dialog, which stays open.
 */
export function AddCustomersDialog({
  lock,
  shop,
  product,
  sharedTags,
  editing = null,
  initialText = '',
  onClose,
  onDone,
}: DialogProps & { editing?: LockCustomer | null; initialText?: string }) {
  const { set } = useSetLockCustomers()
  const [text, setText] = useState(initialText)
  const choices = editing ? missingKeys(lock.tags, editing.tags) : lock.tags
  const several = lock.tags.length > 1
  const [tag, setTag] = useState(choices[0] ?? '')
  const refs = editing ? [customerRef(editing)] : parseCustomerRefs(text)
  const tooMany = refs.length > MAX_ITEMS
  const given = several ? [tag] : lock.tags
  const note = sharedTagsNote(sharedTags, given)

  return (
    <LockConfirmDialog
      title={editing ? `Edit access of ${customerName(editing)}` : 'Add new customer'}
      confirmLabel="Give access"
      confirmDisabled={refs.length === 0 || tooMany || (several && !tag)}
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
        {editing
          ? `Give ${customerName(editing)} another key to “${lock.title}”.`
          : `These customers will be able to open “${lock.title}”.`}{' '}
        These changes will also be updated in Shopify.
      </p>
      {editing ? (
        <p className="mt-3 text-[0.85rem]">
          <span className="text-text-muted">Customer: </span>
          <strong>{editing.email ?? editing.id}</strong>
          {editing.tags.length > 0 && (
            <span className="text-text-muted"> · holds {editing.tags.join(', ')}</span>
          )}
        </p>
      ) : (
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[0.78rem] font-semibold">Customers (emails or ids)</span>
          <textarea
            rows={3}
            aria-label="Customers to add"
            placeholder="buyer@example.com, 7012345678901"
            value={text}
            autoFocus
            onChange={(event) => setText(event.target.value)}
            className="border-border bg-surface text-text placeholder:text-text-muted focus:border-accent focus:outline-accent-tint min-h-20 w-full resize-y rounded-lg border px-3 py-2 text-[0.88rem] outline-none focus:outline-2"
          />
          <span
            className={`text-[0.78rem] ${tooMany ? 'text-danger' : 'text-text-muted'}`}
          >
            {tooMany
              ? `At most ${MAX_ITEMS} customers at a time.`
              : refs.length === 0
                ? 'Separate them with commas, spaces or new lines.'
                : `${refs.length} ${refs.length === 1 ? 'customer' : 'customers'}`}
          </span>
        </label>
      )}
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
