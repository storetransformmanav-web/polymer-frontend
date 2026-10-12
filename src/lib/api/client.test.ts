import {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './ApiError.ts'
import {
  apiClient,
  getErrorMessage,
  setAccessToken,
  setUnauthorizedHandler,
  type ErrorBody,
} from './client.ts'

/** An AxiosError as the interceptor sees it; `data` may be a JSON body or raw HTML. */
function failure(status: number | null, data?: unknown, code?: string) {
  const error = new AxiosError<ErrorBody>(
    'Request failed with status code ' + status,
    code,
  )
  if (status !== null) {
    error.response = { status, data } as AxiosResponse<ErrorBody>
  }
  return error
}

describe('getErrorMessage', () => {
  it("uses the backend's own message", () => {
    expect(
      getErrorMessage(failure(401, { message: 'Google sign-in could not be verified.' })),
    ).toBe('Google sign-in could not be verified.')
  })

  it('prefers the first field error and drops pydantic’s "Value error," prefix', () => {
    expect(
      getErrorMessage(
        failure(422, {
          message: 'Some fields are invalid -- see errors.',
          errors: [
            { field: 'email', message: 'Value error, Enter a valid email address' },
          ],
        }),
      ),
    ).toBe('Enter a valid email address')
  })

  it('explains network failures and timeouts', () => {
    expect(getErrorMessage(failure(null))).toMatch(/Unable to reach the server/)
    expect(getErrorMessage(failure(null, undefined, 'ECONNABORTED'))).toMatch(/timed out/)
  })

  it('replaces raw Axios text when the response has no usable message (e.g. an HTML 404)', () => {
    const html = '<!doctype html><title>404: NOT_FOUND</title>'
    expect(getErrorMessage(failure(404, html))).toBe(
      'The service could not be reached (404). Please try again later.',
    )
    expect(getErrorMessage(failure(502, html))).toBe(
      'The server ran into a problem (502). Please try again shortly.',
    )
    expect(getErrorMessage(failure(418, html))).toBe(
      'The request could not be completed (418).',
    )
  })

  it('has readable fallbacks for 403 and 429, but still prefers the backend message', () => {
    expect(getErrorMessage(failure(403, '<html>'))).toBe(
      "You don't have permission to do that.",
    )
    expect(getErrorMessage(failure(429, '<html>'))).toBe(
      'Too many requests. Please wait a moment and try again.',
    )
    expect(getErrorMessage(failure(429, { message: 'Slow down for 30s.' }))).toBe(
      'Slow down for 30s.',
    )
  })
})

/**
 * Drives the real `apiClient` with a scripted fake network: each entry is
 * what one attempt should do ('network' drop, an HTTP status, or success).
 */
type Step = 'ok' | 'network' | 'timeout' | number

function scriptedAdapter(steps: Step[]) {
  const calls: InternalAxiosRequestConfig[] = []

  const adapter: AxiosRequestConfig['adapter'] = (config) => {
    calls.push(config)
    const step = steps[Math.min(calls.length - 1, steps.length - 1)]

    if (step === 'ok') {
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse)
    }
    if (step === 'network') {
      return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config))
    }
    if (step === 'timeout') {
      return Promise.reject(new AxiosError('timeout', 'ECONNABORTED', config))
    }
    const response = {
      data: { message: `status ${step}` },
      status: step,
      statusText: '',
      headers: {},
      config,
    } as AxiosResponse
    return Promise.reject(
      new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response),
    )
  }

  return { adapter, calls }
}

/** Runs a request while fake timers skip the retry backoff, and returns its outcome. */
async function settle<T>(promise: Promise<T>) {
  const outcome = promise.then(
    (value) => ({ value, error: undefined as unknown }),
    (error: unknown) => ({ value: undefined, error }),
  )
  await vi.advanceTimersByTimeAsync(5_000)
  return outcome
}

describe('apiClient requests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    setAccessToken(null)
    setUnauthorizedHandler(null)
  })

  describe('retries', () => {
    it('retries a GET after a dropped connection and returns the eventual result', async () => {
      const { adapter, calls } = scriptedAdapter(['network', 'network', 'ok'])

      const { value, error } = await settle(apiClient.get('/x', { adapter }))

      expect(error).toBeUndefined()
      expect(value).toEqual({ ok: true })
      expect(calls).toHaveLength(3)
    })

    it('retries a GET on 502/503/504, then gives up after two retries', async () => {
      const { adapter, calls } = scriptedAdapter([503])

      const { error } = await settle(apiClient.get('/x', { adapter }))

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(503)
      expect(calls).toHaveLength(3) // first try + 2 retries
    })

    it.each([400, 401, 403, 404, 422, 429, 500])(
      'does not retry a GET that got a real %i answer',
      async (status) => {
        const { adapter, calls } = scriptedAdapter([status])

        const { error } = await settle(apiClient.get('/x', { adapter }))

        expect((error as ApiError).status).toBe(status)
        expect(calls).toHaveLength(1)
      },
    )

    it('does not retry a timeout (it already waited the full time)', async () => {
      const { adapter, calls } = scriptedAdapter(['timeout'])

      const { error } = await settle(apiClient.get('/x', { adapter }))

      expect((error as ApiError).message).toMatch(/timed out/)
      expect(calls).toHaveLength(1)
    })

    it.each(['post', 'put', 'patch', 'delete'] as const)(
      'never retries a %s, even on a network drop or 503',
      async (method) => {
        for (const step of ['network', 503] as const) {
          const { adapter, calls } = scriptedAdapter([step, 'ok'])

          const call =
            method === 'delete'
              ? apiClient.delete('/x', { adapter })
              : apiClient[method]('/x', { a: 1 }, { adapter })
          const { error } = await settle(call)

          expect(error).toBeInstanceOf(ApiError)
          expect(calls).toHaveLength(1) // repeating a write could duplicate it
        }
      },
    )

    it('does not send (or retry) a request that has been cancelled', async () => {
      const controller = new AbortController()
      const { adapter, calls } = scriptedAdapter(['network'])

      controller.abort()
      const { error } = await settle(
        apiClient.get('/x', { adapter, signal: controller.signal }),
      )

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).code).toBe('ERR_CANCELED')
      expect(calls).toHaveLength(0)
    })

    it('stops retrying if the request is cancelled while waiting to retry', async () => {
      const controller = new AbortController()
      const { adapter, calls } = scriptedAdapter(['network'])

      const outcome = apiClient
        .get('/x', { adapter, signal: controller.signal })
        .then(() => undefined)
        .catch((error: unknown) => error)
      await vi.advanceTimersByTimeAsync(0) // first attempt fails, backoff starts
      controller.abort()
      await vi.advanceTimersByTimeAsync(5_000) // backoff ends; the retry must not go out
      const error = await outcome

      expect(error).toBeInstanceOf(ApiError)
      expect(calls).toHaveLength(1) // no second attempt after the abort
    })
  })

  describe('authentication and secrets', () => {
    it('sends the bearer token, and an explicit Authorization header wins', async () => {
      setAccessToken('session-token')
      const first = scriptedAdapter(['ok'])
      await settle(apiClient.get('/x', { adapter: first.adapter }))
      expect(first.calls[0].headers.get('Authorization')).toBe('Bearer session-token')

      const second = scriptedAdapter(['ok'])
      await settle(
        apiClient.get('/x', {
          adapter: second.adapter,
          headers: { Authorization: 'Bearer explicit' },
        }),
      )
      expect(second.calls[0].headers.get('Authorization')).toBe('Bearer explicit')
    })

    it('never puts the token into the error that callers (and the UI) see', async () => {
      setAccessToken('super-secret-token')
      const { adapter } = scriptedAdapter([500])

      const { error } = await settle(apiClient.get('/x', { adapter }))
      const apiError = error as ApiError

      expect(apiError).toBeInstanceOf(ApiError)
      // Only these plain fields — no request config, headers or Axios internals.
      expect(Object.keys(apiError).sort()).toEqual(['code', 'data', 'name', 'status'])
      expect(JSON.stringify(apiError)).not.toContain('super-secret-token')
      expect(String(apiError.message)).not.toContain('super-secret-token')
      expect((apiError as unknown as { config?: unknown }).config).toBeUndefined()
    })

    it('treats a 401 on an authenticated request as a dead session (once, no retry)', async () => {
      const onUnauthorized = vi.fn()
      setUnauthorizedHandler(onUnauthorized)
      setAccessToken('expired-token')
      const { adapter, calls } = scriptedAdapter([401])

      await settle(apiClient.get('/x', { adapter }))

      expect(onUnauthorized).toHaveBeenCalledTimes(1)
      expect(calls).toHaveLength(1)
    })

    it('ignores a 401 when no session token was sent (e.g. a bad Google token)', async () => {
      const onUnauthorized = vi.fn()
      setUnauthorizedHandler(onUnauthorized)
      const { adapter } = scriptedAdapter([401])

      await settle(apiClient.post('/auth/google', { credential: 'x' }, { adapter }))

      expect(onUnauthorized).not.toHaveBeenCalled()
    })
  })
})
