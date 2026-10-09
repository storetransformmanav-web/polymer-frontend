import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { getErrorMessage, type ErrorBody } from './client.ts'

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
})
