import { useEffect, useState, type ReactNode } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
// The lightbox's own stylesheets (library CSS, not ours — the app's styling stays Tailwind).
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/counter.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  CheckIcon,
  InfoIcon,
  PencilIcon,
  SpinnerIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { LIMITS } from '../utils/editDraft.ts'
import type { AltTextEditor, LightboxSlide } from '../utils/slides.ts'

/** Space between the picture and its information card. */
const CARD_GAP = 16
/** Narrowest the card can be and still sit beside the picture; otherwise it stays at the window's edge. */
const CARD_MIN_WIDTH = 224
const CARD_MAX_WIDTH = 320

const VALUE_BOX =
  'rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[0.82rem] leading-snug break-words'

function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-[0.78rem] font-semibold text-white/90">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  )
}

const SMALL_BUTTON =
  'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/25 disabled:pointer-events-none disabled:opacity-50'

/**
 * The alt text, with a pencil that turns it into a box: ✓ saves and ✕ discards (Escape
 * discards too). Saving asks first — "Are you sure…" — because the change is also sent to
 * Shopify; the question sits inside the card, since a dialog would open behind the
 * lightbox. Only the alt text is sent (`media_update`); the card's other fields are not
 * editable.
 */
function AltTextField({
  imageId,
  altText,
  editor,
}: {
  imageId: string
  altText: string
  editor: AltTextEditor
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const { save, isSaving, error, clearError } = editor
  const changed = draft !== null && draft.trim() !== altText.trim()

  function begin() {
    clearError()
    setConfirming(false)
    setDraft(altText)
  }
  function discard() {
    if (isSaving) return
    clearError()
    setConfirming(false)
    setDraft(null)
  }
  async function confirm() {
    if (draft === null) return
    setConfirming(false)
    if (await save(imageId, draft)) setDraft(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.78rem] font-semibold text-white/90">Alt text</span>
        {draft === null ? (
          <button
            type="button"
            onClick={begin}
            aria-label="Edit alt text"
            title="Edit alt text"
            className={SMALL_BUTTON}
          >
            <PencilIcon width={14} height={14} />
          </button>
        ) : (
          <span className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!changed || isSaving || confirming}
              aria-label="Save alt text"
              title="Save"
              className={SMALL_BUTTON}
            >
              {isSaving ? (
                <SpinnerIcon width={14} height={14} className="animate-spin" />
              ) : (
                <CheckIcon width={14} height={14} />
              )}
            </button>
            <button
              type="button"
              onClick={discard}
              disabled={isSaving}
              aria-label="Discard alt text changes"
              title="Discard"
              className={SMALL_BUTTON}
            >
              <XIcon width={14} height={14} />
            </button>
          </span>
        )}
      </div>

      {draft === null ? (
        <p className={`${VALUE_BOX} m-0`}>
          {altText.trim() || (
            <span className="font-normal text-white/60 italic">No alt text</span>
          )}
        </p>
      ) : (
        <>
          <textarea
            autoFocus
            rows={3}
            maxLength={LIMITS.mediaAlt}
            value={draft}
            disabled={isSaving}
            aria-label="Alt text"
            placeholder="Describe the picture"
            onChange={(event) => {
              setDraft(event.target.value)
              if (error) clearError()
            }}
            onKeyDown={(event) => {
              // Escape ends the edit; it must not also close the lightbox.
              if (event.key === 'Escape') discard()
            }}
            className={`${VALUE_BOX} w-full resize-y outline-none placeholder:text-white/40 focus:border-white/50`}
          />
          {confirming && (
            <div
              role="alertdialog"
              aria-label="Update alt text?"
              className="flex flex-col gap-2 rounded-lg border border-white/20 bg-black/40 p-2.5 text-[0.78rem] leading-snug"
            >
              <p className="m-0 font-semibold">Update the alt text?</p>
              <p className="m-0 text-white/75">
                Are you sure you want to update this? These changes will also be updated
                in Shopify.
              </p>
              <span className="flex gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirming(false)}
                  className="h-8 cursor-pointer rounded-md border border-white/25 bg-white/10 px-3 text-[0.78rem] font-semibold text-white hover:bg-white/25"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirm()}
                  className="h-8 cursor-pointer rounded-md border-none bg-white px-3 text-[0.78rem] font-semibold text-black hover:bg-white/85"
                >
                  Yes, update
                </button>
              </span>
            </div>
          )}
          {error && (
            <p role="alert" className="m-0 text-[0.78rem] text-red-300">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * The picture's information, in a card: its file name, alt text, type and size in pixels,
 * and its id — all from the product's image record. It sits just beside the picture, a
 * small gap from its right edge (found by measuring the shown picture, which the library
 * fits to the window), and falls back to the window's top-right corner when there is no
 * room beside it (a phone) or the picture can't be measured.
 */
function ImageInfoCard({
  slide,
  altEditor,
}: {
  slide: LightboxSlide
  altEditor?: AltTextEditor
}) {
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
  }, [slide.src])

  const altText = slide.altText?.trim() ?? ''
  const size = slide.width && slide.height ? `${slide.width} × ${slide.height} px` : ''
  const details = [slide.fileType, size].filter(Boolean).join(' · ')

  return (
    <aside
      aria-label="Image information"
      // Typing, clicking and scrolling in the card must not page, drag or close the lightbox.
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      style={
        left === null
          ? undefined
          : {
              left,
              right: 'auto',
              maxWidth: Math.min(CARD_MAX_WIDTH, window.innerWidth - left - CARD_GAP),
            }
      }
      className="absolute top-16 right-4 z-10 flex max-w-[calc(100%-2rem)] min-w-56 flex-col gap-4 rounded-2xl border border-white/15 bg-linear-to-br from-white/20 to-white/5 p-4 text-white shadow-2xl ring-1 ring-black/30 backdrop-blur-xl lg:top-24 lg:right-8 lg:max-w-80"
    >
      <h2 className="m-0 flex items-center gap-2 text-[0.95rem] font-semibold">
        <InfoIcon width={18} height={18} className="shrink-0 text-white/80" />
        Information
      </h2>

      <dl className="m-0 flex flex-col gap-3.5">
        {slide.fileName && (
          <InfoField label="Name">
            <p className={`${VALUE_BOX} m-0 break-all`}>{slide.fileName}</p>
          </InfoField>
        )}
        {altEditor && slide.id ? (
          // Keyed by the image, so paging to another picture starts from its own text.
          <AltTextField
            key={slide.id}
            imageId={slide.id}
            altText={slide.altText ?? ''}
            editor={altEditor}
          />
        ) : (
          <InfoField label="Alt text">
            <p className={`${VALUE_BOX} m-0`}>
              {altText || (
                <span className="font-normal text-white/60 italic">No alt text</span>
              )}
            </p>
          </InfoField>
        )}
        {details && (
          <InfoField label="Details">
            <p className="m-0 text-[0.82rem] text-white/80">{details}</p>
          </InfoField>
        )}
        {slide.id && (
          <InfoField label="ID">
            <div className="flex items-start gap-2">
              <p className="m-0 min-w-0 flex-1 font-mono text-[0.74rem] leading-snug break-all text-white/80">
                {slide.id}
              </p>
              <CopyButton value={slide.id} label="Copy image ID" />
            </div>
          </InfoField>
        )}
      </dl>
    </aside>
  )
}

interface ProductLightboxViewProps {
  slides: LightboxSlide[]
  index: number
  onClose: () => void
  altEditor?: AltTextEditor
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
  altEditor,
}: ProductLightboxViewProps) {
  const [current, setCurrent] = useState(index)
  const slide = slides[current]

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
        // The picture's information, top right, beside the picture.
        controls: () =>
          slide?.altText === undefined ? null : (
            <ImageInfoCard slide={slide} altEditor={altEditor} />
          ),
      }}
    />
  )
}
