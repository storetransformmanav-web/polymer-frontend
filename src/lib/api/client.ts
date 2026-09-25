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
})

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    return Promise.reject(
      new ApiError(error.response?.data?.message ?? error.message, {
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
