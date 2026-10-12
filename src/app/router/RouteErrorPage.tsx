import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { ErrorFallback } from '../ErrorFallback.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

/**
 * `errorElement` for the route table. A genuine 404 shows "Page not found";
 * anything else (a page crashed while rendering) shows the generic fallback
 * instead of wrongly claiming the page doesn't exist.
 */
export function RouteErrorPage() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  return <ErrorFallback error={error} />
}
