import { useEffect, useRef, type ReactNode } from 'react'

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
    target?.focus()

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

      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-label={title}
        className={`bg-bg border-border relative flex max-h-[90svh] w-full flex-col gap-4 overflow-y-auto rounded-2xl border p-5 ${wide ? 'max-w-xl' : 'max-w-md'} shadow-[0_10px_40px_rgba(0,0,0,0.2)] transition-all duration-200 motion-reduce:transition-none starting:scale-95 starting:opacity-0`}
      >
        <h2 className="text-[1.05rem] leading-snug font-semibold">{title}</h2>
        <div className="text-text-muted flex flex-col gap-3 text-[0.88rem] leading-relaxed">
          {children}
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-1">{footer}</div>
      </div>
    </div>
  )
}
