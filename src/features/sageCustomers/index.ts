// Public surface of the `sageCustomers` feature (Sage 50 → Customers). Other code should only import
// from this file, never reach into `sageCustomers/pages/...` directly.
export { SageCustomersPage } from './pages/SageCustomersPage.tsx'
// One Sage customer's details page, for another Sage 50 page that opens a customer as a tab of its own.
export { SageCustomerDetailsView } from './components/SageCustomerDetailsView.tsx'
