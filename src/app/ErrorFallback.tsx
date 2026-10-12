import { env } from '../config/env.ts'

interface ErrorFallbackProps {
  /** The caught error. Its text is only ever shown in development. */
  error?: unknown
}

/**
 * Full-page "something went wrong" screen shown when rendering crashes.
 * In production it says nothing technical (no messages, no stack traces —
 * those can reveal internals); in development the error text is shown to
 * help debugging. Plain `<a>`/`<button>` only, so it works even if the
 * router or providers are what failed.
 */
export function ErrorFallback({ error }: ErrorFallbackProps) {
  const details =
    env.isDev && error ? (error instanceof Error ? error.message : String(error)) : null

  return (
    <div
      role="alert"
      className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-text-muted max-w-md">
        An unexpected error stopped this page from loading. Your data is safe — try
        reloading, or go back to the start.
      </p>
      {details && (
        <pre className="border-border bg-surface text-text-muted max-w-xl overflow-auto rounded-lg border p-3 text-left text-xs whitespace-pre-wrap">
          {details}
        </pre>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-accent text-accent-contrast hover:bg-accent-hover cursor-pointer rounded-md border-none px-4 py-2 font-medium"
        >
          Reload page
        </button>
        <a
          href="/"
          className="border-border text-text rounded-md border px-4 py-2 font-medium no-underline"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  )
}
