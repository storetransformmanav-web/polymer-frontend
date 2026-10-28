import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import {
  type ProductDetail,
  type ProductMediaInput,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { useProductMedia } from '../hooks/useProductMedia.ts'
import {
  blankMedia,
  buildMediaItems,
  LIMITS,
  validateNewMedia,
  type NewMediaDraft,
} from '../utils/editDraft.ts'
import { MediaRows } from './MediaRows.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface AddMediaDialogProps {
  product: ProductDetail
  onClose: () => void
  /** The files were accepted (the store is downloading them); `items` is what was sent. */
  onDone: (result: ProductWriteResult, items: ProductMediaInput[]) => void
}

/**
 * "Add media": images and videos by a public https address (the store downloads them
 * itself). Nothing is sent until "Add to product", which checks the addresses first (https
 * only, the API's length limits) and attaches them in one request (at most 20).
 */
export function AddMediaDialog({ product, onClose, onDone }: AddMediaDialogProps) {
  const { add, isAdding, error } = useProductMedia(product)
  const [rows, setRows] = useState<NewMediaDraft[]>(() => [blankMedia()])
  const [showErrors, setShowErrors] = useState(false)

  const problems = validateNewMedia(rows)
  const visible = showErrors ? problems : {}

  async function submit() {
    setShowErrors(true)
    if (Object.keys(problems).length > 0) return
    const items = buildMediaItems(rows)
    const result = await add(items)
    if (result) onDone(result, items)
  }

  return (
    <Dialog
      title="Add media"
      role="dialog"
      wide
      onClose={onClose}
      closeDisabled={isAdding}
      footer={
        <>
          <button
            type="button"
            disabled={isAdding}
            onClick={onClose}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isAdding}
            onClick={() => void submit()}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent shadow-sm`}
          >
            {isAdding && <SpinnerIcon width={14} height={14} className="animate-spin" />}
            Add to product
          </button>
        </>
      }
    >
      <p>
        Add an image or video by its public web address. The store processes the files, so
        they appear in the product a moment after you add them.
      </p>

      <MediaRows
        rows={rows}
        onChange={setRows}
        errors={visible}
        max={LIMITS.newMedia}
        idPrefix="add-media"
        autoFocusFirst
      />

      {visible.rows && <FormMessage tone="error">{visible.rows}</FormMessage>}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
