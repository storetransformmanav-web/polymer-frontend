import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { env } from '../../config/env.ts'
import { readIdleTimeoutMinutes } from '../idleTimeout.ts'
import { findSensitiveParams } from '../urlSecurity.ts'
import { ApiError } from './ApiError.ts'
import { CSRF_PATH, getCsrfToken, setCsrfToken } from './csrf.ts'

/**
 * Thin Axios wrapper: a shared instance with the API base URL, a
 * consistent error shape via `ApiError`, and one place to add
 * cross-cutting concerns later (retries, request cancellation) as the app grows.
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
  // The session is the backend's own HttpOnly cookie: the browser attaches it (to the `/api`
  // proxy, or to the backend itself when it is called directly) and no script ever holds a token.
  withCredentials: true,
})

// Whether the app thinks someone is signed in, pushed in from the Redux store (see store.ts)
// rather than read from it here, so this module never imports the store.
let signedIn = false

export function setSessionActive(active: boolean) {
  signedIn = active
}

const CSRF_HEADER = 'X-CSRF-Token'
const SAFE_METHODS = new Set(['get', 'head', 'options'])

// Every request that changes something carries the token; reads do not.
axiosInstance.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase()
  const csrfToken = getCsrfToken()
  if (csrfToken && !SAFE_METHODS.has(method) && !config.headers.has(CSRF_HEADER)) {
    config.headers.set(CSRF_HEADER, csrfToken)
  }
  return config
})

/**
 * Asks the backend for this session's CSRF token (`GET /auth/csrf`) and keeps it. Used after a
 * reload, and when the backend says the token we hold is missing or stale.
 */
export async function refreshCsrfToken(): Promise<string> {
  return (await refreshCsrfSession()).token
}

/**
 * The same call, also returning the session's idle limit (`idle_timeout_minutes`, null when the
 * answer has none): the backend's own number, which the app's idle timer follows.
 */
export async function refreshCsrfSession(): Promise<{
  token: string
  idleTimeoutMinutes: number | null
}> {
  const response = await axiosInstance.get<{
    csrf_token?: unknown
    idle_timeout_minutes?: unknown
  }>(CSRF_PATH)
  const token = response.data?.csrf_token
  if (typeof token !== 'string' || token === '') {
    throw new ApiError('The server did not send a security token.', {
      status: response.status,
    })
  }
  setCsrfToken(token)
  return {
    token,
    idleTimeoutMinutes: readIdleTimeoutMinutes(response.data?.idle_timeout_minutes),
  }
}

/** A 403 whose message names the CSRF header: the token is missing or stale. */
function isCsrfRejection(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    /x-csrf-token/i.test(error.message)
  )
}

// Called when a request made while signed in comes back 401 (the session expired, was revoked, or
// the server ended it after its idle limit) with the API's own message, if it sent one. The store
// registers a handler that clears the user and opens the login page with that message.
let unauthorizedHandler: ((message?: string) => void) | null = null

export function setUnauthorizedHandler(handler: ((message?: string) => void) | null) {
  unauthorizedHandler = handler
}

// When the last request left. The server counts a session's idle time in requests, not in mouse
// and keyboard activity, so the session guard asks `lastRequestAt()` whether the server has heard
// from this browser lately (see `useSessionGuard`).
let lastRequest = Date.now()

export function lastRequestAt(): number {
  return lastRequest
}

axiosInstance.interceptors.request.use((config) => {
  lastRequest = Date.now()
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
  if (status === 403) return "You don't have permission to do that."
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
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
    // Only a 401 while signed in means "session is dead"; a 401 from sign-in itself (e.g. a bad
    // Google token, a wrong code) happens with no session.
    if (error.response?.status === 401 && signedIn) {
      const message = error.response.data?.message
      unauthorizedHandler?.(typeof message === 'string' && message ? message : undefined)
    }

    return Promise.reject(
      // Deliberately a *new* error carrying only the status, body and code:
      // an AxiosError holds the full request config, which must never travel into logs or UI.
      new ApiError(getErrorMessage(error), {
        status: error.response?.status,
        data: error.response?.data,
        code: error.code,
      }),
    )
  },
)

// Transient failures worth retrying — but only for GET (see `request`).
const RETRY_DELAYS_MS = [400, 1200]
const RETRYABLE_STATUSES = new Set([502, 503, 504])

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** A dropped connection or a gateway hiccup — not a real answer from the API. */
function isTransient(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'ERR_NETWORK' ||
      (error.status !== undefined && RETRYABLE_STATUSES.has(error.status)))
  )
}

/**
 * Sends the request. A change refused for a missing or stale CSRF token is sent once more with a
 * fresh token (see `isCsrfRejection`). GETs are retried a couple of times (with a short
 * backoff) on network drops and 502/503/504, so a blip doesn't surface as
 * an error. Writes (POST/PUT/PATCH/DELETE) are never retried: repeating one
 * could create or delete something twice. Timeouts, 4xx and 401s are never
 * retried either, and a cancelled request stops immediately.
 *
 * A request whose URL would carry a credential (`?token=…`, a `token`/`access_token`/… entry in
 * `params`) is refused before anything is sent: a URL is logged, kept in history and passed on in
 * the `Referer`. The session is a cookie, anything else secret goes in the body. See
 * `lib/urlSecurity.ts`.
 */
async function request<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const inUrl = findSensitiveParams(path, config?.params)
  if (inUrl.length > 0) {
    // Names only — never the value.
    throw new ApiError(
      `Refused to send “${inUrl[0]}” in the URL. Credentials go in the request body, never in the address.`,
      { code: 'ERR_CREDENTIAL_IN_URL' },
    )
  }

  const isRead = (config?.method ?? 'GET').toUpperCase() === 'GET'
  let csrfRetried = false

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await axiosInstance.request<T>({ url: path, ...config })
      return response.data
    } catch (error) {
      // The backend refused a change because our CSRF token is missing or stale: nothing was
      // done, so fetch the token again and send the same request once more (a write is never
      // retried otherwise).
      if (!isRead && !csrfRetried && isCsrfRejection(error) && !config?.signal?.aborted) {
        csrfRetried = true
        try {
          await refreshCsrfToken()
        } catch {
          throw error
        }
        continue
      }
      const canRetry =
        isRead &&
        attempt < RETRY_DELAYS_MS.length &&
        isTransient(error) &&
        !config?.signal?.aborted
      if (!canRetry) throw error
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
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
