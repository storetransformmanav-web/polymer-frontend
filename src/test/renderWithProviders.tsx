import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { createAppStore } from '../app/store/store.ts'

interface RenderWithProvidersOptions {
  route?: string
}

/**
 * Renders with a fresh Redux store, a fresh (retry-disabled) React
 * Query client, and a MemoryRouter — the context most components in
 * this app now depend on. A fresh store/client per call means tests
 * don't need to reset the app's shared singletons between runs.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/' }: RenderWithProvidersOptions = {},
) {
  const store = createAppStore()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </QueryClientProvider>
      </Provider>
    )
  }

  return { store, queryClient, ...render(ui, { wrapper: Wrapper }) }
}
