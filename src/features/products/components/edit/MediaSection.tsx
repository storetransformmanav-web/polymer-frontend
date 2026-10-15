import { Badge } from '../../../../components/ui/Badge.tsx'
import { ChevronDownIcon } from '../../../../components/ui/icons.tsx'
import type { ImageDraft } from '../../utils/editDraft.ts'
import { ProductImage } from '../ProductImage.tsx'
import { EditField, FIELD_INPUT, ICON_BUTTON, type SectionProps } from './fields.tsx'

/**
 * The product's images: change the alt text and put them in order (the first is
 * the featured image). Adding and removing files are separate, immediate
 * actions in the Media tab ("Add media" and each image's Delete), so nothing
 * here can lose a file.
 */
export function MediaSection({ draft, errors, onChange }: SectionProps) {
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

  if (draft.images.length === 0) {
    return (
      <p className="text-text-muted text-[0.85rem]">This product has no images yet.</p>
    )
  }

  return (
    <ul aria-label="Images" className="flex flex-col gap-2.5">
      {draft.images.map((image, index) => (
        <li
          key={image.id}
          className="border-border flex items-start gap-3 rounded-xl border p-3"
        >
          <div className="h-14 w-14 shrink-0">
            <ProductImage src={image.url} alt={image.alt} size="thumb" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-text-muted text-[0.78rem] font-semibold">
                Image {index + 1}
              </span>
              {index === 0 && <Badge tone="success">Featured</Badge>}
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
                onChange={(event) => updateImage(index, { alt: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
          </div>

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
          </div>
        </li>
      ))}
    </ul>
  )
}
