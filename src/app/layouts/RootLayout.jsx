import { Outlet } from 'react-router-dom'
import './RootLayout.css'

/**
 * Shared page shell rendered around every route via <Outlet />.
 * Feature pages should not re-implement chrome like headers/nav —
 * add it here once the app needs it.
 */
export function RootLayout() {
  return (
    <div className="root-layout">
      <header className="root-layout__header">
        <span className="root-layout__brand">Polymer CRM</span>
      </header>
      <main className="root-layout__content">
        <Outlet />
      </main>
    </div>
  )
}
