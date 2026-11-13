// Public surface of the `products` feature. Other code should only
// import from this file, never reach into `products/pages/...` directly.
export { ProductsPage } from './pages/ProductsPage.tsx'
export { ProductDetailsView } from './components/ProductDetailsView.tsx'
export { SyncProductsButton } from './components/SyncProductsButton.tsx'
export { ProductLightbox } from './components/ProductLightbox.tsx'
export type { LightboxSlide } from './utils/slides.ts'
export { TagsInput } from './components/edit/TagsSection.tsx'
export { useStoreTags } from './hooks/useStoreTags.ts'
export { mergeTags } from './utils/tagSuggestions.ts'
export { LockCustomerAccess } from './components/LockAccessPanel.tsx'
