import Lightbox from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
// The lightbox's own stylesheets (library CSS, not ours — the app's styling stays Tailwind).
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/counter.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import type { LightboxSlide } from '../utils/slides.ts'

interface ProductLightboxViewProps {
  slides: LightboxSlide[]
  index: number
  onClose: () => void
}

/**
 * The actual lightbox (yet-another-react-lightbox). Kept in its own module so
 * ProductLightbox can load it on demand — the library and its CSS only
 * download the first time someone opens an image.
 */
export default function ProductLightboxView({
  slides,
  index,
  onClose,
}: ProductLightboxViewProps) {
  return (
    <Lightbox
      open
      index={index}
      close={onClose}
      slides={slides}
      plugins={[Counter, Thumbnails, Zoom]}
      // Same rule as ProductImage: the image host never learns which CRM page it was shown on.
      carousel={{
        imageProps: { referrerPolicy: 'no-referrer' },
        finite: slides.length < 2,
      }}
      thumbnails={{ imageFit: 'contain', vignette: false }}
      controller={{ closeOnBackdropClick: true }}
      // With a single image there is nothing to page through.
      render={
        slides.length < 2 ? { buttonPrev: () => null, buttonNext: () => null } : undefined
      }
    />
  )
}
