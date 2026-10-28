import type { ProductImage } from '../../../lib/api/endpoints.ts'
import { safeUrl } from './format.ts'

/** One picture in the lightbox. `src` is always an http(s) URL (see `toSlides`). */
export interface LightboxSlide {
  src: string
  alt: string
  /** The image's own alt text (`alt_text`), empty when it has none; unset for a slide that isn't a product image. */
  altText?: string
  width?: number
  height?: number
  /** The image's CRM id (`id`) — set for a product image, with the fields below. */
  id?: string
  /** The file's name, taken from its address. */
  fileName?: string
  /** The file type, e.g. "JPG" (from `mime_type`, else `media_type`). */
  fileType?: string
}

/** What the lightbox needs to change an image's alt text (see `useImageAltSave`). */
export interface AltTextEditor {
  /** Saves the alt text of the image with this id; true once the server has confirmed. */
  save: (imageId: string, alt: string) => Promise<boolean>
  isSaving: boolean
  /** The backend's message when the last save failed. */
  error: string | null
  clearError: () => void
}

/** "…/files/photo-1.jpg?v=179" → "photo-1.jpg". */
export function fileNameOf(url: string): string {
  try {
    const name = new URL(url).pathname.split('/').filter(Boolean).pop() ?? ''
    return decodeURIComponent(name)
  } catch {
    return ''
  }
}

/** "image/jpeg" → "JPG", "image/png" → "PNG", "video/mp4" → "MP4"; else the media type, capitalised. */
export function fileTypeOf(
  mimeType: string | null | undefined,
  mediaType: string | null | undefined,
): string {
  const subtype = mimeType?.split('/')[1]?.split('+')[0]?.toLowerCase()
  if (subtype) return subtype === 'jpeg' ? 'JPG' : subtype.toUpperCase()
  const type = mediaType?.toLowerCase() ?? ''
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : ''
}

/**
 * Product images → lightbox slides. API URLs only count if they're plain
 * http(s) links, so an image with an unsafe URL is left out (and so is its
 * thumbnail).
 */
export function toSlides(images: ProductImage[], title: string): LightboxSlide[] {
  return images.flatMap((image) => {
    const src = safeUrl(image.url)
    if (!src) return []
    return [
      {
        src,
        alt: image.alt_text ?? title,
        altText: image.alt_text ?? '',
        width: image.width ?? undefined,
        height: image.height ?? undefined,
        id: image.id,
        fileName: fileNameOf(src),
        fileType: fileTypeOf(image.mime_type, image.media_type),
      },
    ]
  })
}
