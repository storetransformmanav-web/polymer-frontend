import { Badge } from '../../../../components/ui/Badge.tsx'
import { ChevronDownIcon, PlusIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import { MEDIA_TYPES, type MediaType } from '../../../../lib/api/endpoints.ts'
import {
  blankMedia,
  LIMITS,
  type ImageDraft,
  type NewMediaDraft,
} from '../../utils/editDraft.ts'
import { ProductImage } from '../ProductImage.tsx'
import {
  EditField,
  FIELD_INPUT,
  ICON_BUTTON,
  TEXT_BUTTON,
  type SectionProps,
} from './fields.tsx'

const TYPE_OPTIONS = MEDIA_TYPES.map((type) => ({
  value: type,
  label: type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' '),
}))

/**
 * The product's images: change alt text, put them in order (the first is the
 * featured image), remove them, or attach more by a public https address — the
 * store downloads the file from that address.
 */
export function MediaSection({ draft, errors, onChange }: SectionProps) {
  const featured = draft.images.findIndex((image) => !image.removed)

  const updateImage = (index: number, patch: Partial<ImageDraft>) =>
    onChange({
      images: draft.images.map((image, i) =>
        i === index ? { ...image, ...patch } : image,
      ),
    })

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= draft.images.length) return
    const images = [...draft.images]
    ;[images[index], images[target]] = [images[target], images[index]]
    onChange({ images })
  }

  const updateNew = (index: number, patch: Partial<NewMediaDraft>) =>
    onChange({
      newMedia: draft.newMedia.map((media, i) =>
        i === index ? { ...media, ...patch } : media,
      ),
    })

  return (
    <div className="flex flex-col gap-4">
      {draft.images.length === 0 && draft.newMedia.length === 0 && (
        <p className="text-text-muted text-[0.85rem]">This product has no images yet.</p>
      )}

      {draft.images.length > 0 && (
        <ul aria-label="Images" className="flex flex-col gap-2.5">
          {draft.images.map((image, index) => (
            <li
              key={image.id}
              className={`border-border flex items-start gap-3 rounded-xl border p-3 ${image.removed ? 'opacity-60' : ''}`}
            >
              <div className="h-14 w-14 shrink-0">
                <ProductImage src={image.url} alt={image.alt} size="thumb" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {image.removed ? (
                  <div className="flex items-center gap-2">
                    <Badge tone="danger">Will be removed</Badge>
                    <button
                      type="button"
                      className={TEXT_BUTTON}
                      onClick={() => updateImage(index, { removed: false })}
                    >
                      Undo
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted text-[0.78rem] font-semibold">
                        Image {index + 1}
                      </span>
                      {index === featured && <Badge tone="success">Featured</Badge>}
                    </div>
                    <EditField
                      id={`edit-image-alt-${image.id}`}
                      label="Alt text"
                      error={errors[`images.${index}.alt`]}
                    >
                      <input
                        id={`edit-image-alt-${image.id}`}
                        autoComplete="off"
                        value={image.alt}
                        placeholder="Describe the image"
                        onChange={(event) =>
                          updateImage(index, { alt: event.target.value })
                        }
                        className={FIELD_INPUT}
                      />
                    </EditField>
                  </>
                )}
              </div>

              {!image.removed && (
                <div className="flex shrink-0 flex-col items-center">
                  <button
                    type="button"
                    aria-label={`Move image ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className={ICON_BUTTON}
                  >
                    <ChevronDownIcon width={16} height={16} className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move image ${index + 1} down`}
                    disabled={index === draft.images.length - 1}
                    onClick={() => move(index, 1)}
                    className={ICON_BUTTON}
                  >
                    <ChevronDownIcon width={16} height={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove image ${index + 1}`}
                    onClick={() => updateImage(index, { removed: true })}
                    className={`${ICON_BUTTON} hover:text-danger`}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {errors.newMedia && (
        <p role="alert" className="text-danger text-[0.82rem] font-medium">
          {errors.newMedia}
        </p>
      )}

      {draft.newMedia.length > 0 && (
        <ul aria-label="Files to add" className="flex flex-col gap-2.5">
          {draft.newMedia.map((media, index) => (
            <li
              key={media.key}
              className="border-accent/40 bg-accent-tint/40 flex items-start gap-3 rounded-xl border p-3"
            >
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                <div className="min-[480px]:col-span-2">
                  <EditField
                    id={`edit-media-url-${media.key}`}
                    label="Web address"
                    error={errors[`newMedia.${index}.url`]}
                  >
                    <input
                      id={`edit-media-url-${media.key}`}
                      autoComplete="off"
                      spellCheck={false}
                      value={media.url}
                      placeholder="https://…"
                      aria-invalid={errors[`newMedia.${index}.url`] ? true : undefined}
                      onChange={(event) => updateNew(index, { url: event.target.value })}
                      className={FIELD_INPUT}
                    />
                  </EditField>
                </div>
                <EditField
                  id={`edit-media-alt-${media.key}`}
                  label="Alt text"
                  optional
                  error={errors[`newMedia.${index}.alt`]}
                >
                  <input
                    id={`edit-media-alt-${media.key}`}
                    autoComplete="off"
                    value={media.alt}
                    onChange={(event) => updateNew(index, { alt: event.target.value })}
                    className={FIELD_INPUT}
                  />
                </EditField>
                <SelectField
                  id={`edit-media-type-${media.key}`}
                  label="Type"
                  value={media.mediaType}
                  options={TYPE_OPTIONS}
                  onChange={(mediaType) =>
                    updateNew(index, { mediaType: mediaType as MediaType })
                  }
                />
              </div>
              <button
                type="button"
                aria-label={`Don't add file ${index + 1}`}
                onClick={() =>
                  onChange({ newMedia: draft.newMedia.filter((_, i) => i !== index) })
                }
                className={`${ICON_BUTTON} hover:text-danger`}
              >
                <TrashIcon width={16} height={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => onChange({ newMedia: [...draft.newMedia, blankMedia()] })}
        disabled={draft.newMedia.length >= LIMITS.newMedia}
        className={`${TEXT_BUTTON} self-start disabled:pointer-events-none disabled:opacity-50`}
      >
        <PlusIcon width={14} height={14} />
        Add an image or video by web address
      </button>
    </div>
  )
}
