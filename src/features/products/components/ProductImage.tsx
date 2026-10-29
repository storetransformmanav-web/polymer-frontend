import { useState } from 'react'
import { useAppSelector } from '../../../app/store/hooks.ts'
import { ProductsIcon } from '../../../components/ui/icons.tsx'
import { safeUrl } from '../utils/format.ts'

interface ProductImageProps {
  src: string | null
  alt: string
  size?: 'sm' | 'thumb' | 'lg' | 'xl'
  /**
   * The product this picture stands for. While the store has no picture for it yet but the user
   * has just chosen one from their computer, that file's own in-memory preview is shown instead
   * — so a new product has its picture the moment it exists, not once the upload and the store
   * have finished.
   */
  productId?: string
}

/**
 * The first picture the user chose from their computer for this product that is still on its
 * way to the store (an object URL this app made itself — never an address from the API).
 */
function useChosenPicture(productId: string | undefined): string | null {
  return useAppSelector((state) => {
    if (!productId) return null
    const item = state.products.localMedia[productId]?.items.find(
      (candidate) =>
        candidate.mediaType === 'IMAGE' &&
        candidate.status !== 'failed' &&
        candidate.previewUrl.startsWith('blob:'),
    )
    return item?.previewUrl ?? null
  })
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
export function ProductImage({ src, alt, size = 'sm', productId }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const { box, icon, fit } = SIZES[size]
  // The store's own picture when there is one, else the file just chosen.
  const chosen = useChosenPicture(productId)
  const safeSrc = safeUrl(src) ?? chosen

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
