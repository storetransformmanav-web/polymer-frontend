/**
 * Composes all app-wide context providers in one place (theme, auth,
 * server-state cache, etc.) so `App.jsx` doesn't accumulate provider
 * nesting as the app grows.
 *
 * There are no global providers yet — add them here as they're needed,
 * e.g.:
 *
 *   <QueryClientProvider client={queryClient}>
 *     <AuthProvider>{children}</AuthProvider>
 *   </QueryClientProvider>
 */
export function AppProviders({ children }) {
  return children
}
