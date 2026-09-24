/**
 * Normalized error shape for every failure coming out of `apiClient`,
 * so callers can branch on `status`/`data` instead of parsing
 * `Response`/`fetch` errors themselves in every feature.
 */
export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}
