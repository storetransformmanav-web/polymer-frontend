import { useEffect, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
// The lightbox's own stylesheets (library CSS, not ours — the app's styling stays Tailwind).
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/counter.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import { ImageIcon } from '../../../components/ui/icons.tsx'
import type { LightboxSlide } from '../utils/slides.ts'

/** Space between the picture and its alt text card. */
const CARD_GAP = 16
/** Narrowest the card can be and still sit beside the picture; otherwise it stays at the window's edge. */
const CARD_MIN_WIDTH = 192
const CARD_MAX_WIDTH = 320

/**
 * The picture's alt text in a card. It sits just beside the picture, a small gap from
 * its right edge (found by measuring the shown picture, which the library fits to the
 * window), and falls back to the window's top-right corner when there is no room beside
 * it (a phone) or the picture can't be measured.
 */
function AltTextCard({ altText }: { altText: string }) {
  // Where the card's left edge goes, once the picture's position is known.
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    function measure() {
      const picture = document.querySelector('.yarl__slide_current .yarl__slide_image')
      const rect = picture?.getBoundingClientRect()
      if (!rect || rect.width === 0) return
      const x = Math.round(rect.right + CARD_GAP)
      setLeft(window.innerWidth - x - CARD_GAP >= CARD_MIN_WIDTH ? x : null)
    }
    // After the slide has settled (the carousel slides for a moment) and once a picture has loaded.
    const timers = [60, 400].map((delay) => window.setTimeout(measure, delay))
    window.addEventListener('resize', measure)
    document.addEventListener('load', measure, true)
    return () => {
      timers.forEach(window.clearTimeout)
      window.removeEventListener('resize', measure)
      document.removeEventListener('load', measure, true)
    }
  }, [altText])

  return (
    <aside
      aria-label="Image alt text"
      style={
        left === null
          ? undefined
          : {
              left,
              right: 'auto',
              maxWidth: Math.min(CARD_MAX_WIDTH, window.innerWidth - left - CARD_GAP),
            }
      }
      className="absolute top-16 right-4 z-10 flex max-w-[calc(100%-2rem)] min-w-48 items-start gap-3 rounded-2xl border border-white/15 bg-linear-to-br from-white/20 to-white/5 p-4 text-white shadow-2xl ring-1 ring-black/30 backdrop-blur-xl lg:top-24 lg:right-8 lg:max-w-80"
    >
      <span
        aria-hidden="true"
        className="bg-accent/90 text-accent-contrast flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm"
      >
        <ImageIcon width={16} height={16} />
      </span>
      <p className="min-w-0 pt-1 text-[0.9rem] leading-relaxed font-medium tracking-[0.005em] break-words">
        {altText.trim() || (
          <span className="font-normal text-white/60 italic">No alt text</span>
        )}
      </p>
    </aside>
  )
}

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
  const [current, setCurrent] = useState(index)
  const altText = slides[current]?.altText

  return (
    <Lightbox
      open
      index={index}
      on={{ view: ({ index: viewed }) => setCurrent(viewed) }}
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
      render={{
        ...(slides.length < 2 ? { buttonPrev: () => null, buttonNext: () => null } : {}),
        // The picture's alt text, top right, beside the picture.
        controls: () =>
          altText === undefined ? null : <AltTextCard altText={altText} />,
      }}
    />
  )
}
