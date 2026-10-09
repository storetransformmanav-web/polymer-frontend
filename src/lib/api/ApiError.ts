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

/**
 * Message safe to show in the UI for anything thrown by an API call.
 * Failures from `apiClient` are always ApiErrors carrying the backend's
 * message; anything else (e.g. a response that fails schema validation)
 * gets a generic fallback rather than leaking internals.
 */
export function toUserMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Something went wrong. Please try again.'
}
