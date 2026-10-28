import type { ImportProblem } from '../../../../lib/api/productImport.ts'
import { countLabel, formatNumber } from './importFormat.ts'

/** Small rounded figures: "To create 1", "To update 3". */
export function CountChips({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
  if (entries.length === 0) return null
  return (
    <ul aria-label="Figures from the store" className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <li
          key={key}
          className="border-border bg-surface/60 text-text inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[0.8rem]"
        >
          <span className="text-text-muted">{countLabel(key)}</span>
          <strong>{formatNumber(value)}</strong>
        </li>
      ))}
    </ul>
  )
}

/**
 * The rows the import skipped (or would skip) and why: the first few, with a count of the rest.
 * The text is the backend's, shown as text only.
 */
export function ImportProblems({
  problems,
  title,
  max = 8,
}: {
  problems: readonly ImportProblem[]
  title: string
  max?: number
}) {
  if (problems.length === 0) return null
  const shown = problems.slice(0, max)
  const more = problems.length - shown.length
  return (
    <div
      role="group"
      aria-label={title}
      className="border-warning/40 bg-warning-bg text-text rounded-xl border px-4 py-3 text-[0.82rem]"
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {shown.map((problem, index) => (
          <li key={`${problem.row ?? 'x'}-${problem.handle ?? ''}-${index}`}>
            {(problem.row !== null || problem.handle) && (
              <strong>
                {[problem.row !== null ? `Row ${problem.row}` : null, problem.handle]
                  .filter(Boolean)
                  .join(' · ')}
                {' — '}
              </strong>
            )}
            {problem.message}
          </li>
        ))}
        {more > 0 && (
          <li className="text-text-muted">
            and {formatNumber(more)} more {more === 1 ? 'row' : 'rows'}
          </li>
        )}
      </ul>
    </div>
  )
}
