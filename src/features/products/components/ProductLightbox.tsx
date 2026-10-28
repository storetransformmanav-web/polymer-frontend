import { lazy, Suspense } from 'react'
import type { AltTextEditor, LightboxSlide } from '../utils/slides.ts'

const LightboxView = lazy(() => import('./ProductLightboxView.tsx'))

interface ProductLightboxProps {
  slides: LightboxSlide[]
  /** The slide to open on, or null while the lightbox is closed. */
  index: number | null
  onClose: () => void
  /** When given, each product image's alt text can be edited from its information card. */
  altEditor?: AltTextEditor
}

/** Full-screen image viewer with zoom, thumbnails and a counter. Loads on first open. */
export function ProductLightbox({
  slides,
  index,
  onClose,
  altEditor,
}: ProductLightboxProps) {
  if (index === null || slides.length === 0) return null

  return (
    <Suspense fallback={null}>
      <LightboxView
        slides={slides}
        index={Math.min(index, slides.length - 1)}
        onClose={onClose}
        altEditor={altEditor}
      />
    </Suspense>
  )
}
