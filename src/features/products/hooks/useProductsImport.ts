import { useCsvImport, type CsvImportSource } from '../../../hooks/useCsvImport.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { summarizeImportCsv, type ImportSummary } from '../utils/importCsv.ts'

const PRODUCTS_IMPORT: CsvImportSource<ImportSummary> = {
  queryKey: 'product-import',
  noun: 'products',
  layout: 'Shopify’s product layout',
  summarize: summarizeImportCsv,
  send: (file, options) => api.products.import(file, options),
  status: (importId) => api.products.importStatus(importId),
}

/**
 * Importing products from a Shopify-format CSV: `POST /products/import`, followed with
 * `GET /products/import/{import_id}`. The flow is `useCsvImport`.
 */
export function useProductsImport(options: {
  /** The store used until another is chosen. */
  defaultShop: string
  /** The import has ended (done, failed or given up on): the products may have changed. */
  onFinished?: () => void
}) {
  return useCsvImport({ source: PRODUCTS_IMPORT, ...options })
}
