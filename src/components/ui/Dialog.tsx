import { useEffect, useRef, type ReactNode } from 'react'
import { XIcon } from './icons.tsx'

interface DialogProps {
  /** Heading, and the dialog's accessible name. */
  title: string
  onClose: () => void
  /** While true, Escape and the backdrop do nothing (e.g. a request is in flight). */
  closeDisabled?: boolean
  /** `alertdialog` (the default) for a confirmation; `dialog` for one that holds a form. */
  role?: 'alertdialog' | 'dialog'
  /** A roomier dialog, for forms. */
  wide?: boolean
  /** Wider still, for a dialog that shows a table or a preview. */
  extraWide?: boolean
  /** A round tile at the heading's left (an info icon for a question). */
  icon?: ReactNode
  /** A round ✕ at the heading's right (Escape and the backdrop close it either way). */
  closeButton?: boolean
  /**
   * A tinted header band running edge to edge (the icon, the heading with a line under it, a ✕),
   * and a footer set off by a rule — the look of the update questions. `title` is still the
   * dialog's accessible name.
   */
  banded?: boolean
  /** With `banded`: the heading shown instead of `title` (which stays the accessible name). */
  heading?: ReactNode
  /** With `banded`: the line under the heading (what the question is about). */
  subtitle?: ReactNode
  /** The action buttons, pinned under the content. */
  footer: ReactNode
  children: ReactNode
}

/**
 * A small centred dialog for confirming something. Closes on Escape or a click
 * on the backdrop, moves focus inside when it opens (to the element marked
 * `data-autofocus` — put it on the safe choice — else the first button) and
 * returns focus to whatever opened it.
 */
export function Dialog({
  title,
  onClose,
  closeDisabled = false,
  role = 'alertdialog',
  wide = false,
  extraWide = false,
  closeButton = false,
  icon,
  banded = false,
  heading,
  subtitle,
  footer,
  children,
}: DialogProps) {
  const panel = useRef<HTMLDivElement>(null)
  // Read from refs so the effect runs once (open / close) however often the parent re-renders.
  const disabledRef = useRef(closeDisabled)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    disabledRef.current = closeDisabled
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const target =
      panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.current?.querySelector<HTMLElement>('button')
    // Without scrolling: a long dialog (a preview, a table) must open at its top, not scrolled
    // down to the button that took the focus.
    target?.focus({ preventScroll: true })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !disabledRef.current) onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        disabled={closeDisabled}
        onClick={onClose}
        className="absolute inset-0 cursor-default border-none bg-black/40 transition-opacity duration-200 starting:opacity-0"
      />

      {/* `text-left whitespace-normal`: a dialog opened from inside a table cell would otherwise
          inherit the cell's right/centre alignment and `nowrap`, which is how its text ended up
          clipped and pushed to one side. */}
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-label={title}
        className={`bg-bg border-border relative flex max-h-[90svh] w-full flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-2xl border p-5 text-left whitespace-normal ${extraWide ? 'max-w-2xl' : wide ? 'max-w-xl' : 'max-w-md'} shadow-[0_10px_40px_rgba(0,0,0,0.2)] transition-all duration-200 motion-reduce:transition-none starting:scale-95 starting:opacity-0`}
      >
        {banded ? (
          <div className="border-border bg-accent-tint/60 -mx-5 -mt-5 flex items-center gap-3 border-b px-4 py-3">
            {icon}
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-[0.98rem] leading-tight font-semibold break-words">
                {heading ?? title}
              </h2>
              {subtitle && (
                <p className="text-text-muted m-0 mt-0.5 text-[0.8rem] leading-snug break-words">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label={`Close ${title}`}
              disabled={closeDisabled}
              onClick={onClose}
              className="text-text-muted hover:text-text inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              <XIcon width={16} height={16} />
            </button>
          </div>
        ) : closeButton || icon ? (
          <div className={`flex gap-3 ${icon ? 'items-center' : 'items-start'}`}>
            {icon}
            <h2 className="min-w-0 flex-1 text-[1.05rem] leading-snug font-semibold break-words">
              {title}
            </h2>
            {closeButton && (
              <button
                type="button"
                aria-label={`Close ${title}`}
                disabled={closeDisabled}
                onClick={onClose}
                className="border-border text-text hover:border-accent -mt-1 -mr-1 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border bg-transparent transition-colors disabled:pointer-events-none disabled:opacity-50"
              >
                <XIcon width={16} height={16} />
              </button>
            )}
          </div>
        ) : (
          <h2 className="text-[1.05rem] leading-snug font-semibold">{title}</h2>
        )}
        <div className="text-text-muted flex min-w-0 flex-col gap-3 text-[0.88rem] leading-relaxed">
          {children}
        </div>
        <div
          className={
            banded
              ? 'border-border -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t px-4 py-3'
              : 'flex flex-wrap justify-end gap-2 pt-1'
          }
        >
          {footer}
        </div>
      </div>
    </div>
  )
}
