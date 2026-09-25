import { AppProviders } from './providers/AppProviders.tsx'
import { AppRouter } from './router/AppRouter.tsx'

/**
 * Composition root: wires global providers around the router.
 * Keep this file free of business logic — it only wires things together.
 */
export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}
