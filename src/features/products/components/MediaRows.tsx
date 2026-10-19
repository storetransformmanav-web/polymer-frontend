import { useEffect, useState } from 'react'
import { PlusIcon, TrashIcon } from '../../../components/ui/icons.tsx'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import { MEDIA_TYPES, type MediaType } from '../../../lib/api/endpoints.ts'
import {
  blankMedia,
  LIMITS,
  type DraftErrors,
  type NewMediaDraft,
} from '../utils/editDraft.ts'
import { safeUrl, svgImageWarning } from '../utils/format.ts'
import { EditField, FIELD_INPUT, ICON_BUTTON, TEXT_BUTTON } from './edit/fields.tsx'

/**
 * Shows the image an address points to, once typing has paused — so a link that
 * doesn't work is seen here, before the product is created, instead of the store
 * silently failing to download it. Only a hint: a link the browser can't show can
 * still be one the store can fetch, so it never blocks anything.
 */
function UrlPreview({ url }: { url: string }) {
  const [settled, setSettled] = useState('')
  const [broken, setBroken] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(url.trim()), 600)
    return () => window.clearTimeout(timer)
  }, [url])

  const src = /^https:\/\/\S+$/i.test(settled) ? safeUrl(settled) : null
  if (!src) return null

  if (broken === src) {
    return (
      <p role="status" className="text-warning text-[0.78rem] leading-snug">
        Couldn&apos;t show this address as an image. The store needs a direct, public link
        to an image file — a web page or a private link won&apos;t work.
      </p>
    )
  }
  const svg = svgImageWarning(src)
  return (
    <div className="flex flex-col gap-1.5">
      <img
        src={src}
        alt="Preview of this image"
        referrerPolicy="no-referrer"
        onError={() => setBroken(src)}
        className="border-border bg-surface h-16 w-16 rounded-lg border object-cover"
      />
      {svg && (
        <p role="status" className="text-warning text-[0.78rem] leading-snug">
          {svg}
        </p>
      )}
    </div>
  )
}

const TYPE_OPTIONS = MEDIA_TYPES.map((type) => ({
  value: type,
  label: type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' '),
}))

interface MediaRowsProps {
  rows: NewMediaDraft[]
  onChange: (rows: NewMediaDraft[]) => void
  /** Problems, keyed `<prefix><row>.url` / `<prefix><row>.alt`. */
  errors: DraftErrors
  prefix?: string
  /** The most files that can be listed. */
  max: number
  /** Gives each row's inputs distinct ids. */
  idPrefix: string
  /** Put the cursor in the first address when the rows appear. */
  autoFocusFirst?: boolean
  /** Rows can be removed down to this many (a form that needs none can go to 0). */
  minRows?: number
}

/**
 * Images or videos to attach, one row per file: a public https address, alt
 * text and a type. Used by "Add media" on a product and by the new-product form.
 */
export function MediaRows({
  rows,
  onChange,
  errors,
  prefix = '',
  max,
  idPrefix,
  autoFocusFirst = false,
  minRows = 1,
}: MediaRowsProps) {
  const update = (index: number, patch: Partial<NewMediaDraft>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  return (
    <div className="text-text flex flex-col gap-3">
      {rows.map((row, index) => (
        <div
          key={row.key}
          className="border-border flex items-start gap-3 rounded-xl border p-3"
        >
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[520px]:grid-cols-2">
            <div className="min-[520px]:col-span-2">
              <EditField
                id={`${idPrefix}-url-${row.key}`}
                label="Web address"
                error={errors[`${prefix}${index}.url`]}
                hint="A direct, public link to the image file (ending in .jpg, .png, .webp…), starting with https://"
              >
                <input
                  id={`${idPrefix}-url-${row.key}`}
                  data-autofocus={autoFocusFirst && index === 0 ? '' : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  value={row.url}
                  maxLength={LIMITS.mediaUrl + 100}
                  placeholder="https://…"
                  aria-invalid={errors[`${prefix}${index}.url`] ? true : undefined}
                  onChange={(event) => update(index, { url: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
              {row.mediaType === 'IMAGE' && <UrlPreview url={row.url} />}
            </div>
            <EditField
              id={`${idPrefix}-alt-${row.key}`}
              label="Alt text"
              optional
              error={errors[`${prefix}${index}.alt`]}
            >
              <input
                id={`${idPrefix}-alt-${row.key}`}
                autoComplete="off"
                value={row.alt}
                onChange={(event) => update(index, { alt: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
            <SelectField
              id={`${idPrefix}-type-${row.key}`}
              label="Type"
              value={row.mediaType}
              options={TYPE_OPTIONS}
              onChange={(mediaType) =>
                update(index, { mediaType: mediaType as MediaType })
              }
            />
          </div>
          {rows.length > minRows && (
            <button
              type="button"
              aria-label={`Remove file ${index + 1}`}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              className={`${ICON_BUTTON} hover:text-danger`}
            >
              <TrashIcon width={16} height={16} />
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...rows, blankMedia()])}
        disabled={rows.length >= max}
        className={`${TEXT_BUTTON} self-start disabled:pointer-events-none disabled:opacity-50`}
      >
        <PlusIcon width={14} height={14} />
        {rows.length === 0 ? 'Add an image or video' : 'Add another file'}
      </button>
    </div>
  )
}
