import { useState } from 'react'
import { EditField, FIELD_INPUT } from './fields.tsx'
import { ProductImage } from '../ProductImage.tsx'

/** The choice that takes the picture off the variant (the update API's `remove_image`). */
export const NO_PICTURE = 'none'

interface PickableImage {
  id: string
  url: string
  alt?: string | null
}

const SOURCE =
  'cursor-pointer rounded-md border px-3 py-1 text-[0.78rem] font-semibold transition-colors'

/**
 * How a variant gets its picture, with the two ways shown before anything is chosen: **From
 * media** (the product's own pictures, as a grid — the one now chosen is marked — plus **No image**
 * for a variant that shows one) and **Web address** (a public https link to a new picture). Both
 * are one tap away, side by side; it opens on the web address when it already holds one, else on the
 * media. Only describes the choice: the caller keeps it (`onMedia`, `onNone`, `onUrl`).
 */
export function ImagePicker({
  idPrefix,
  images,
  selected,
  canRemove = false,
  onMedia,
  onNone,
  url,
  onUrl,
  error,
  hint,
}: {
  idPrefix: string
  images: PickableImage[]
  /** The id of the chosen picture, `NO_PICTURE`, or '' (none chosen / an address is typed). */
  selected: string
  /** Offers "No image" (a variant that shows a picture now). */
  canRemove?: boolean
  onMedia: (image: PickableImage) => void
  onNone?: () => void
  url: string
  onUrl: (url: string) => void
  error?: string
  hint?: string
}) {
  const [source, setSource] = useState<'media' | 'url'>(
    url.trim() !== '' || images.length === 0 ? 'url' : 'media',
  )
  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label="Where the picture comes from"
        className="flex gap-1.5"
      >
        <button
          type="button"
          aria-pressed={source === 'media'}
          onClick={() => setSource('media')}
          className={`${SOURCE} ${
            source === 'media'
              ? 'border-accent bg-accent-tint/50 text-text'
              : 'border-border bg-bg text-text hover:border-accent'
          }`}
        >
          From media
        </button>
        <button
          type="button"
          aria-pressed={source === 'url'}
          onClick={() => setSource('url')}
          className={`${SOURCE} ${
            source === 'url'
              ? 'border-accent bg-accent-tint/50 text-text'
              : 'border-border bg-bg text-text hover:border-accent'
          }`}
        >
          Web address
        </button>
      </div>

      {source === 'media' ? (
        <>
          {images.length > 0 ? (
            <ul
              aria-label="Product media"
              className="m-0 grid list-none grid-cols-5 gap-2 p-0 min-[480px]:grid-cols-6"
            >
              {images.map((image, position) => (
                <li key={image.id}>
                  <button
                    type="button"
                    aria-label={`Image ${position + 1}`}
                    aria-pressed={selected === image.id}
                    onClick={() => onMedia(image)}
                    className={`block w-full cursor-pointer overflow-hidden rounded-md border-2 bg-transparent p-0 transition-colors ${
                      selected === image.id
                        ? 'border-accent'
                        : 'border-border hover:border-accent/60'
                    }`}
                  >
                    <ProductImage
                      src={image.url}
                      alt={image.alt || `Image ${position + 1}`}
                      size="thumb"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted m-0">
              This product has no media yet. Use a web address.
            </p>
          )}
          {canRemove && onNone && (
            <button
              type="button"
              aria-pressed={selected === NO_PICTURE}
              onClick={onNone}
              className={`${SOURCE} self-start ${
                selected === NO_PICTURE
                  ? 'border-accent bg-accent-tint/50 text-text'
                  : 'border-border bg-bg text-text hover:border-accent'
              }`}
            >
              No image
            </button>
          )}
        </>
      ) : (
        <EditField
          id={`${idPrefix}-image-url`}
          label="Picture web address"
          optional
          error={error}
          hint={
            hint ??
            "A public https:// link. It is added to the product's media, and the variant shows it once the store has downloaded it."
          }
        >
          <input
            id={`${idPrefix}-image-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://"
            value={url}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onUrl(event.target.value)}
            className={FIELD_INPUT}
          />
        </EditField>
      )}
    </div>
  )
}
