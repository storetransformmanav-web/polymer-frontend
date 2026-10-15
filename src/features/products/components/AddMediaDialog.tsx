import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { PlusIcon, SpinnerIcon, TrashIcon } from '../../../components/ui/icons.tsx'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import {
  MEDIA_TYPES,
  type MediaType,
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
import { EditField, FIELD_INPUT, ICON_BUTTON, TEXT_BUTTON } from './edit/fields.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

const TYPE_OPTIONS = MEDIA_TYPES.map((type) => ({
  value: type,
  label: type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' '),
}))

interface AddMediaDialogProps {
  product: ProductDetail
  onClose: () => void
  /** The files were accepted (the store is downloading them); `items` is what was sent. */
  onDone: (result: ProductWriteResult, items: ProductMediaInput[]) => void
}

/**
 * "Add media": one or more images or videos, each by a public https address —
 * the store downloads the file itself. Nothing is sent until "Add to product",
 * which is checked first (https only, the API's length limits, at most 20).
 */
export function AddMediaDialog({ product, onClose, onDone }: AddMediaDialogProps) {
  const { add, isAdding, error } = useProductMedia(product)
  const [rows, setRows] = useState<NewMediaDraft[]>(() => [blankMedia()])
  const [showErrors, setShowErrors] = useState(false)
  const problems = validateNewMedia(rows)
  const visible = showErrors ? problems : {}

  const update = (index: number, patch: Partial<NewMediaDraft>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )

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
        Add an image or video by its public web address. The store downloads the file, so
        it appears in the product a moment after you add it.
      </p>

      <div className="text-text flex flex-col gap-3">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="border-border flex items-start gap-3 rounded-xl border p-3"
          >
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[520px]:grid-cols-2">
              <div className="min-[520px]:col-span-2">
                <EditField
                  id={`add-media-url-${row.key}`}
                  label="Web address"
                  error={visible[`${index}.url`]}
                >
                  <input
                    id={`add-media-url-${row.key}`}
                    data-autofocus={index === 0 ? '' : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    value={row.url}
                    maxLength={LIMITS.mediaUrl + 100}
                    placeholder="https://…"
                    aria-invalid={visible[`${index}.url`] ? true : undefined}
                    onChange={(event) => update(index, { url: event.target.value })}
                    className={FIELD_INPUT}
                  />
                </EditField>
              </div>
              <EditField
                id={`add-media-alt-${row.key}`}
                label="Alt text"
                optional
                error={visible[`${index}.alt`]}
              >
                <input
                  id={`add-media-alt-${row.key}`}
                  autoComplete="off"
                  value={row.alt}
                  onChange={(event) => update(index, { alt: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
              <SelectField
                id={`add-media-type-${row.key}`}
                label="Type"
                value={row.mediaType}
                options={TYPE_OPTIONS}
                onChange={(mediaType) =>
                  update(index, { mediaType: mediaType as MediaType })
                }
              />
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                aria-label={`Remove file ${index + 1}`}
                onClick={() =>
                  setRows((current) => current.filter((_, i) => i !== index))
                }
                className={`${ICON_BUTTON} hover:text-danger`}
              >
                <TrashIcon width={16} height={16} />
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => setRows((current) => [...current, blankMedia()])}
          disabled={rows.length >= LIMITS.newMedia}
          className={`${TEXT_BUTTON} self-start disabled:pointer-events-none disabled:opacity-50`}
        >
          <PlusIcon width={14} height={14} />
          Add another file
        </button>
      </div>

      {visible.rows && <FormMessage tone="error">{visible.rows}</FormMessage>}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
