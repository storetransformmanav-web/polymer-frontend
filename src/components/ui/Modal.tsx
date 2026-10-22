import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  /** The dialog's accessible name. */
  label: string
  onClose: () => void
  /** The whole content — the caller lays it out (this only provides the frame). */
  children: ReactNode
  /** A wide frame, for a two-column layout. */
  wide?: boolean
}

/**
 * A large centred dialog frame for a form-like layout (the export dialog). Closes on
 * Escape or a click on the backdrop, moves focus inside when it opens (to the element
 * marked `data-autofocus`, else the first control) and returns it to whatever opened it.
 * For a short confirmation use `Dialog` instead.
 */
export function Modal({ label, onClose, children, wide = false }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const target =
      panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.current?.querySelector<HTMLElement>('button, input, select, textarea')
    target?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default border-none bg-black/40 transition-opacity duration-200 starting:opacity-0"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`bg-bg border-border relative flex max-h-[94svh] w-full flex-col overflow-hidden rounded-2xl border shadow-[0_10px_40px_rgba(0,0,0,0.2)] transition-all duration-200 motion-reduce:transition-none starting:scale-95 starting:opacity-0 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}
      >
        {children}
      </div>
    </div>
  )
}
