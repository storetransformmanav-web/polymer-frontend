import { useId, useState, type ReactNode } from 'react'
import { ChevronDownIcon } from '../../../../components/ui/icons.tsx'

/**
 * One section of a window's accordion: a title row you click to fold or unfold, and its fields
 * under it. Every section is its own toggle (several can be open); `forceOpen` unfolds it for good
 * while something inside needs attention (a problem in a field), and never folds it again.
 */
export function DialogAccordion({
  title,
  defaultOpen = true,
  forceOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  forceOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const shown = open || forceOpen
  return (
    <section className="border-border-strong overflow-hidden rounded-lg border">
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={bodyId}
        onClick={() => setOpen(!shown)}
        className="bg-surface hover:bg-accent-tint/50 flex w-full cursor-pointer items-center justify-between gap-2 border-none px-3 py-2 text-left text-[0.8rem] font-semibold transition-colors"
      >
        {title}
        <ChevronDownIcon
          width={14}
          height={14}
          className={`text-text-muted shrink-0 transition-transform ${shown ? 'rotate-180' : ''}`}
        />
      </button>
      {shown && (
        <div
          id={bodyId}
          className="border-border-strong bg-bg flex flex-col gap-2.5 border-t p-3"
        >
          {children}
        </div>
      )}
    </section>
  )
}
