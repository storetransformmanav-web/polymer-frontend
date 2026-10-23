import { useState } from 'react'
import { ProductsIcon } from '../../../components/ui/icons.tsx'
import { safeUrl } from '../utils/format.ts'

interface ProductImageProps {
  src: string | null
  alt: string
  size?: 'sm' | 'thumb' | 'lg' | 'xl'
}

const SIZES = {
  sm: { box: 'h-8 w-8 rounded-md', icon: 18, fit: 'object-cover' },
  // A square that fills its grid cell — gallery thumbnails.
  thumb: { box: 'aspect-square w-full rounded-lg', icon: 22, fit: 'object-cover' },
  lg: { box: 'h-48 w-full rounded-xl sm:h-56', icon: 40, fit: 'object-cover' },
  // Detail page hero: square, whole product visible.
  xl: { box: 'aspect-square w-full rounded-xl', icon: 56, fit: 'object-contain' },
}

/**
 * Product thumbnail that never leaves a broken-image icon behind: a
 * missing or failing image falls back to a neutral product glyph. Images
 * load lazily so long lists don't compete with the data for bandwidth.
 *
 * The URL comes from the API, so it's only used if it's a plain http(s)
 * link, and the request sends no referrer (the image host doesn't need to
 * know which CRM page it was shown on).
 */
export function ProductImage({ src, alt, size = 'sm' }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const { box, icon, fit } = SIZES[size]
  const safeSrc = safeUrl(src)

  if (!safeSrc || failedSrc === safeSrc) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={`border-border bg-accent-tint text-accent flex shrink-0 items-center justify-center border ${box}`}
      >
        <ProductsIcon width={icon} height={icon} />
      </span>
    )
  }

  return (
    <img
      src={safeSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(safeSrc)}
      className={`border-border bg-surface shrink-0 border ${fit} ${box}`}
    />
  )
}
