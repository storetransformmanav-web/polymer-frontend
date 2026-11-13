import { InfoIcon } from '../../components/ui/icons.tsx'

/**
 * A short notice at the very top of every page of the app (above the top bar): the team is
 * working on the system, and a refresh is the first thing to try after an interruption.
 */
export function SystemNote() {
  return (
    <div
      role="note"
      className="bg-red-50 text-red-700 border border-red-300 flex shrink-0 items-center justify-center gap-2 px-3 py-1.5 text-center text-[0.78rem] leading-snug font-semibold sm:px-6"
    >
      <InfoIcon width={14} height={14} className="shrink-0" />
      <span>
        Note: The team is continuously working on the system. If you experience any
        interruptions, please refresh the page and continue.
      </span>
    </div>
  )
}
