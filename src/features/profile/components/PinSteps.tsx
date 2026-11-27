import { CheckIcon } from '../../../components/ui/icons.tsx'

/**
 * The numbered steps across the top of the security PIN window: the current one filled, the ones
 * already done ticked, joined by lines.
 */
export function PinSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Steps" className="m-0 flex list-none items-start p-0">
      {steps.map((label, index) => {
        const done = index < current
        const active = index === current
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            {/* The line back to the step before, between the two circles. */}
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute top-4 right-[calc(50%+1.35rem)] left-[calc(-50%+1.35rem)] h-0.5 ${
                  index <= current ? 'bg-accent' : 'bg-border'
                }`}
              />
            )}
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-[0.82rem] font-bold ${
                active
                  ? 'bg-accent text-accent-contrast border-transparent'
                  : done
                    ? 'bg-accent-tint text-accent border-accent'
                    : 'bg-bg text-text-muted border-border'
              }`}
            >
              {done ? <CheckIcon width={15} height={15} /> : index + 1}
            </span>
            <span
              className={`text-center text-[0.76rem] ${
                active ? 'text-text font-semibold' : 'text-text-muted font-medium'
              }`}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
