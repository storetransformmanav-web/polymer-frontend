import { useEffect, useRef, useState } from 'react'
import { UploadIcon } from '../../../../components/ui/icons.tsx'
import { toUserMessage } from '../../../../lib/api/ApiError.ts'
import { uploadFileToProduct } from '../../hooks/useFileUpload.ts'
import { checkFile, previewOf, releasePreview } from '../../utils/mediaFiles.ts'
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

/** The product an image chosen from the folder is uploaded to (its store key goes as `shop=`). */
export interface FolderTarget {
  productId: string
  shop?: string | null
}

const IMAGE_ACCEPT = '.jpg,.jpeg,.jfif,.jpe,.png,.webp,.gif,.svg,.heic,.tif,.tiff,.bmp'

/**
 * **From folder**: an image chosen from the computer is uploaded to the store's file storage at
 * once and its address (`resource_url`) is handed to `onUploaded`, so it follows the same path as
 * a web address — it is added to the product's media and the variant shows it once the store has it.
 */
function FolderChoice({
  target,
  onUploaded,
}: {
  target: FolderTarget
  onUploaded: (url: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<{
    name: string
    preview: string
    status: 'uploading' | 'done'
  } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const preview = state?.preview ?? ''
  useEffect(() => () => releasePreview(preview), [preview])

  async function choose(file: File | undefined) {
    if (!file) return
    const checked = checkFile(file)
    if ('problem' in checked) {
      setProblem(checked.problem)
      return
    }
    if (checked.type !== 'IMAGE') {
      setProblem('Choose an image file.')
      return
    }
    setProblem(null)
    setState({ name: file.name, preview: previewOf(file), status: 'uploading' })
    try {
      const url = await uploadFileToProduct(target.productId, target.shop, file, 'IMAGE')
      setState((current) => (current ? { ...current, status: 'done' } : current))
      onUploaded(url)
    } catch (error) {
      setState(null)
      setProblem(toUserMessage(error))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        aria-label="Image from folder"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void choose(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={state?.status === 'uploading'}
        onClick={() => input.current?.click()}
        className="border-border bg-bg text-text hover:border-accent inline-flex h-8 cursor-pointer items-center gap-1.5 self-start rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <UploadIcon width={14} height={14} />
        {state ? 'Choose another image' : 'Choose an image'}
      </button>
      {state && (
        <div className="flex items-center gap-2">
          {state.preview && (
            <img
              src={state.preview}
              alt=""
              className="border-border h-12 w-12 rounded-md border object-cover"
            />
          )}
          <span className="text-text-muted min-w-0 truncate text-[0.78rem]">
            {state.name} · {state.status === 'uploading' ? 'Uploading…' : 'Ready'}
          </span>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-danger m-0 text-[0.76rem]">
          {problem}
        </p>
      )}
    </div>
  )
}

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
  folder,
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
  /** Offers **From folder**: an image from the computer, uploaded to this product. */
  folder?: FolderTarget
}) {
  const [source, setSource] = useState<'media' | 'url' | 'folder'>(
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
        {folder && (
          <button
            type="button"
            aria-pressed={source === 'folder'}
            onClick={() => setSource('folder')}
            className={`${SOURCE} ${
              source === 'folder'
                ? 'border-accent bg-accent-tint/50 text-text'
                : 'border-border bg-bg text-text hover:border-accent'
            }`}
          >
            From folder
          </button>
        )}
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
      ) : source === 'folder' && folder ? (
        <FolderChoice target={folder} onUploaded={onUrl} />
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
