import { useCallback } from 'react'
import { useCsvExport } from '../../../hooks/useCsvExport.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { exportFilename, type ProductsExportRequest } from '../utils/exportRequest.ts'

/** Exporting products through `GET /products/export`; the rest is `useCsvExport`. */
export function useProductsExport() {
  const { state, start: run, cancel, dismiss } = useCsvExport()

  const start = useCallback(
    (request: ProductsExportRequest) =>
      run({
        read: (signal) => api.products.export(request.params, signal),
        filename: () => exportFilename(request.params.shop),
        format: request.format,
        summary: request.summary,
      }),
    [run],
  )

  return { state, start, cancel, dismiss }
}
