import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import { scrubAddressBar } from './lib/urlSecurity.ts'
import './styles/globals.css'

// A credential that arrived in the address (a pasted link, a redirect) is removed from the
// address bar and its history entry before anything else runs — see lib/urlSecurity.ts.
scrubAddressBar()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element (#root) not found — check index.html.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
