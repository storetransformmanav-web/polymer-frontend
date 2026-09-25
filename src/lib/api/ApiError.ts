interface ApiErrorOptions {
  status?: number
  data?: unknown
}

/**
 * Normalized error shape for every failure coming out of `apiClient`,
 * so callers can branch on `status`/`data` instead of parsing
 * Axios/fetch errors themselves in every feature.
 */
export class ApiError extends Error {
  status?: number
  data?: unknown

  constructor(message: string, { status, data }: ApiErrorOptions = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}
