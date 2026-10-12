import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorFallback } from './ErrorFallback.tsx'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: unknown
  hasError: boolean
}

/**
 * Last line of defence: catches a render crash anywhere below it (providers,
 * layouts, pages) and shows the friendly fallback instead of a blank screen.
 * Route-level crashes are handled by `RouteErrorPage`; this covers the rest.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null, hasError: false }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error, hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Nothing is logged to the console on purpose: a production console can
    // be read by anyone with the page open. Wire an error-reporting service
    // here (e.g. Sentry) if you adopt one.
  }

  render() {
    return this.state.hasError ? (
      <ErrorFallback error={this.state.error} />
    ) : (
      this.props.children
    )
  }
}
