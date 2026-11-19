// Public surface of the `invoices` feature (Sage 50 → Invoices). Other code should only import
// from this file, never reach into `invoices/pages/...` directly.
export { InvoicesPage } from './pages/InvoicesPage.tsx'
// One invoice's details page, for another Sage 50 page that opens an invoice as a tab of its own.
export { InvoiceDetailsView } from './components/InvoiceDetailsView.tsx'
