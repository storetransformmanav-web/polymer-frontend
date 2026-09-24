import { env } from '../../config/env.js'
import { ApiError } from './ApiError.js'

/**
 * Thin fetch wrapper: JSON in/out, a consistent error shape via
 * `ApiError`, and one place to add cross-cutting concerns later
 * (auth headers, retries, request cancellation) as the app grows.
 *
 * Feature `api/` modules should call this instead of using `fetch`
 * directly, e.g.:
 *
 *   // features/contacts/api/getContacts.js
 *   export function getContacts() {
 *     return apiClient.get('/contacts')
 *   }
 */
async function request(path, { method = 'GET', body, headers, ...rest } = {}) {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  })

  const data = await safeParseJson(response)

  if (!response.ok) {
    throw new ApiError(data?.message ?? response.statusText, {
      status: response.status,
      data,
    })
  }

  return data
}

async function safeParseJson(response) {
  if (response.status === 204) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}
