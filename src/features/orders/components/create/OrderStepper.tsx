import { CheckIcon } from '../../../../components/ui/icons.tsx'
import { ORDER_STEPS, type OrderStepId } from '../../utils/orderDraft.ts'

/**
 * The wizard's progress row: a small numbered circle and a label per step, joined by short
 * lines. The current step's circle is filled and its label bold, a finished step shows a tick, a
 * step with a problem is red. A step already reached can be pressed to go back to it; the ones
 * ahead wait for **Next**. On a phone only the current step keeps its label.
 */
export function OrderStepper({
  current,
  furthest,
  problemSteps,
  onGo,
}: {
  current: number
  /** The furthest step the person has reached (steps up to it can be pressed). */
  furthest: number
  problemSteps: ReadonlySet<OrderStepId>
  onGo: (index: number) => void
}) {
  return (
    <nav aria-label="Order steps" className="border-border border-b px-4 py-3 sm:px-6">
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-2 p-0">
        {ORDER_STEPS.map((step, index) => {
          const isCurrent = index === current
          const reachable = index <= furthest
          const done = reachable && !isCurrent
          const problem = problemSteps.has(step.id) && !isCurrent
          const last = index === ORDER_STEPS.length - 1
          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex items-center gap-3"
            >
              <button
                type="button"
                disabled={!reachable || isCurrent}
                onClick={() => onGo(index)}
                aria-label={`Step ${index + 1}: ${step.label}${
                  problem ? ' (needs attention)' : done ? ' (done)' : ''
                }`}
                className="flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 enabled:hover:opacity-80 disabled:cursor-default"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold transition-colors ${
                    problem
                      ? 'bg-danger-bg text-danger'
                      : isCurrent
                        ? 'bg-accent text-accent-contrast'
                        : done
                          ? 'bg-accent-tint text-accent'
                          : 'bg-surface text-text-muted'
                  }`}
                >
                  {problem ? (
                    '!'
                  ) : done ? (
                    <CheckIcon width={13} height={13} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`text-[0.82rem] font-semibold whitespace-nowrap ${
                    isCurrent ? 'text-text' : 'text-text-muted hidden sm:inline'
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {!last && (
                <span
                  aria-hidden="true"
                  className={`h-px w-6 sm:w-10 ${index < furthest ? 'bg-accent' : 'bg-border'}`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
