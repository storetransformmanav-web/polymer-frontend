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
      },
    ]
  })
}
