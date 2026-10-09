import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { env } from '../../config/env.ts'
import { ApiError } from './ApiError.ts'

/**
 * Thin Axios wrapper: a shared instance with the API base URL, a
 * consistent error shape via `ApiError`, and one place to add
 * cross-cutting concerns later (auth headers, retries, request
 * cancellation) as the app grows.
 *
 * Feature `api/` modules should call this instead of using `axios` or
 * `fetch` directly, e.g.:
 *
 *   // features/contacts/api/getContacts.ts
 *   export function getContacts() {
 *     return apiClient.get<Contact[]>('/contacts')
 *   }
 */
const axiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  headers: { Accept: 'application/json' },
  timeout: 15_000,
})

// The bearer token is pushed in from the Redux store (see store.ts) rather
// than read from it here, so this module never imports the store.
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

// Called when a request made *with* a session token comes back 401 (expired
// or revoked). The store registers a handler that clears the session.
let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

axiosInstance.interceptors.request.use((config) => {
  if (accessToken && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

/** Error body shared by every non-2xx response from the backend. */
export interface ErrorBody {
  message?: string
  errors?: { field?: string; message?: string }[]
}

/**
 * Picks the most useful human-readable message out of a failed request:
 * the first field error for 422s (e.g. "Enter a valid email address"),
 * otherwise the backend's own `message`, otherwise a friendly network
 * message when no response arrived at all.
 */
export function getErrorMessage(error: AxiosError<ErrorBody>): string {
  const body = error.response?.data
  const fieldMessage = body?.errors?.[0]?.message?.replace(/^Value error,\s*/i, '')

  if (fieldMessage) return fieldMessage
  if (body?.message) return body.message
  if (!error.response) {
    return error.code === 'ECONNABORTED'
      ? 'The request timed out. Please try again.'
      : 'Unable to reach the server. Check your connection and try again.'
  }

  // A response with no usable message (an HTML error page from a proxy or
  // host, say) — say something readable instead of Axios's raw text.
  const { status } = error.response
  if (status === 404) {
    return 'The service could not be reached (404). Please try again later.'
  }
  if (status >= 500) {
    return `The server ran into a problem (${status}). Please try again shortly.`
  }
  return `The request could not be completed (${status}).`
}

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => {
    // Only a 401 on an authenticated request means "session is dead"; a 401
    // from sign-in itself (e.g. a bad Google token) has no token attached.
    if (error.response?.status === 401 && accessToken) unauthorizedHandler?.()

    return Promise.reject(
      new ApiError(getErrorMessage(error), {
        status: error.response?.status,
        data: error.response?.data,
      }),
    )
  },
)

async function request<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await axiosInstance.request<T>({ url: path, ...config })
  return response.data
}

export const apiClient = {
  get: <T>(path: string, config?: AxiosRequestConfig) =>
    request<T>(path, { ...config, method: 'GET' }),
  post: <T>(path: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>(path, { ...config, method: 'POST', data: body }),
  put: <T>(path: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>(path, { ...config, method: 'PUT', data: body }),
  patch: <T>(path: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>(path, { ...config, method: 'PATCH', data: body }),
  delete: <T>(path: string, config?: AxiosRequestConfig) =>
    request<T>(path, { ...config, method: 'DELETE' }),
}
