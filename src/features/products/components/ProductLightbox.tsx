import { lazy, Suspense } from 'react'
import type { LightboxSlide } from '../utils/slides.ts'

const LightboxView = lazy(() => import('./ProductLightboxView.tsx'))

interface ProductLightboxProps {
  slides: LightboxSlide[]
  /** The slide to open on, or null while the lightbox is closed. */
  index: number | null
  onClose: () => void
}

/** Full-screen image viewer with zoom, thumbnails and a counter. Loads on first open. */
export function ProductLightbox({ slides, index, onClose }: ProductLightboxProps) {
  if (index === null || slides.length === 0) return null

  return (
    <Suspense fallback={null}>
      <LightboxView
        slides={slides}
        index={Math.min(index, slides.length - 1)}
        onClose={onClose}
      />
    </Suspense>
  )
}
