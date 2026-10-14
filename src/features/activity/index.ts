// Public surface of the `activity` feature. Other code should only
// import from this file, never reach into `activity/pages/...` directly.
export { ActivityPage } from './pages/ActivityPage.tsx'
export { usePrefetchActivity } from './hooks/usePrefetchActivity.ts'
