import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon, TrashIcon } from '../../../components/ui/icons.tsx'
import { useCollectionDeleteCheck, useDeleteCollection } from '../hooks/useCollections.ts'
import { count } from '../utils/ui.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** The collection the question is about. */
export interface CollectionToDelete {
  /** CRM id (the API also takes the Shopify id or the handle). */
  id: string
  title: string
  /** The collection's store key (sent as `shop=`), when known. */
  shop: string | null
  /** How many products it holds, as far as the page knows. */
  productsCount: number | null
}

/**
 * "Delete “X”?" — asked before a collection is deleted (`DELETE /collections/{ref}`), laid out like
 * the other delete questions: it says plainly that the collection is also deleted in Shopify, that
 * this can't be undone, and — from `GET …/delete-check`, read when the question opens — what it
 * affects: the products are **not** deleted, they are only taken out of the collection. **Cancel**
 * is focused; nothing is sent until **Delete**.
 *
 * A collection marked "Do not delete" (the check says so, or the API answers 409) needs a second,
 * deliberate step: a box to tick ("I understand…") before **Delete** is on, and only then is
 * `force=true` sent. Whatever the backend answers is shown inside the question, which then stays open.
 */
export function CollectionDeleteDialog({
  collection,
  onClose,
  onDone,
}: {
  collection: CollectionToDelete
  onClose: () => void
  /** The delete went through; `message` is the backend's own words. */
  onDone: (message: string) => void
}) {
  const { check, isChecking, failed } = useCollectionDeleteCheck(
    collection.id,
    collection.shop ?? '',
  )
  const { remove, isDeleting, error, conflict, clearError } = useDeleteCollection()
  const [understood, setUnderstood] = useState(false)

  // Marked "Do not delete": told by the check up front, or by the API's 409 on a first try.
  const protectedCollection = check?.protected === true || conflict
  const products = check?.productsCount ?? collection.productsCount

  async function confirm() {
    clearError()
    try {
      const result = await remove({
        id: collection.id,
        shop: collection.shop,
        // `force` only after the person has ticked the box for a protected collection.
        force: protectedCollection && understood,
      })
      onDone(result.message)
    } catch {
      // Shown from `error`; a 409 turns the question into the "Do not delete" step.
    }
  }

  return (
    <Dialog
      title={`Delete “${collection.title}”?`}
      onClose={onClose}
      closeDisabled={isDeleting}
      icon={
        <span
          aria-hidden="true"
          className="bg-danger-bg text-danger flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        >
          <TrashIcon width={18} height={18} />
        </span>
      }
      footer={
        <>
          <button
            type="button"
            data-autofocus
            disabled={isDeleting}
            onClick={onClose}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting || (protectedCollection && !understood)}
            onClick={() => void confirm()}
            className={`${BUTTON} bg-danger text-bg border-transparent hover:opacity-90`}
          >
            {isDeleting && (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            )}
            {isDeleting ? 'Deleting…' : 'Yes, delete'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2 text-[0.85rem]">
        <p className="m-0 font-semibold">
          Are you sure you want to delete this collection?
        </p>
        <p className="text-text-muted m-0">
          It will also be deleted in Shopify. This can&apos;t be undone.
        </p>
      </div>

      <div className="border-border bg-surface flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-[0.82rem]">
        <p className="text-text-muted m-0 text-[0.7rem] font-bold tracking-wide uppercase">
          What this affects
        </p>
        {isChecking ? (
          <p className="text-text-muted m-0 flex items-center gap-2">
            <SpinnerIcon width={13} height={13} className="animate-spin" />
            Checking…
          </p>
        ) : (
          <>
            <p className="m-0">
              {products === null
                ? 'The products in it are taken out of it.'
                : `${count(products)} ${products === 1 ? 'product is' : 'products are'} taken out of this collection.`}{' '}
              <strong>The products themselves are not deleted</strong>, and their edit
              page stops listing this collection.
            </p>
            {check?.message && <p className="text-text-muted m-0">{check.message}</p>}
            {failed && (
              <p className="text-text-muted m-0">
                Couldn&apos;t check what it affects — you can still delete it.
              </p>
            )}
          </>
        )}
      </div>

      {protectedCollection && (
        <div className="bg-danger-bg text-danger flex flex-col gap-2 rounded-lg px-3 py-2.5 text-[0.82rem]">
          <p className="m-0 font-semibold">This collection is marked “Do not delete”.</p>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={understood}
              disabled={isDeleting}
              onChange={(event) => setUnderstood(event.target.checked)}
              className="accent-danger mt-0.5 h-4 w-4"
            />
            <span>I understand, delete it anyway.</span>
          </label>
        </div>
      )}

      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
