import { useEffect, useRef, type ReactNode } from 'react'
import { XIcon } from './icons.tsx'

interface SidePanelProps {
  /** Small uppercase heading in the panel's header bar. */
  title: string
  /** Accessible name of the dialog. */
  label: string
  onClose: () => void
  /** While true, Escape, the backdrop and the ✕ button do nothing (e.g. a save is in flight). */
  closeDisabled?: boolean
  /** Pinned to the bottom of the panel (action buttons). */
  footer?: ReactNode
  children: ReactNode
}

/**
 * Right-hand slide-over dialog. Closes on Escape, the backdrop or the ✕
 * button, moves focus inside when it opens (to a field marked `autoFocus`,
 * else the ✕ button) and returns focus to whatever opened it.
 */
export function SidePanel({
  title,
  label,
  onClose,
  closeDisabled = false,
  footer,
  children,
}: SidePanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const disabledRef = useRef(closeDisabled)
  useEffect(() => {
    disabledRef.current = closeDisabled
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    if (!panelRef.current?.contains(document.activeElement)) closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !disabledRef.current) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (opener?.isConnected) opener.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button
        type="button"
        aria-label={`Close ${label}`}
        tabIndex={-1}
        disabled={closeDisabled}
        onClick={onClose}
        className="absolute inset-0 cursor-default border-none bg-black/40 transition-opacity duration-300 starting:opacity-0"
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="bg-bg border-border relative flex h-full w-full flex-col border-l shadow-[0_0_40px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out motion-reduce:transition-none sm:max-w-md starting:translate-x-full"
      >
        <header className="border-border flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-text-muted text-xs font-bold tracking-wider uppercase">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            disabled={closeDisabled}
            onClick={onClose}
            className="text-text-muted hover:text-text hover:bg-surface inline-flex cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-1.5 transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <XIcon />
          </button>
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>

        {footer && <footer className="border-border border-t p-4">{footer}</footer>}
      </aside>
    </div>
  )
}
