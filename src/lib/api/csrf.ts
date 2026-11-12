/**
 * The CSRF token of this session. It comes with the sign-in answer (`csrf_token`) and from
 * `GET /auth/csrf` after a reload, and is the same for the whole session. It is kept in this
 * variable only — never in localStorage, sessionStorage, a cookie or the Redux state — so a page
 * reload forgets it and asks for it again (see `restoreSession`). `client.ts` sends it as
 * `X-CSRF-Token` on every request that changes something.
 */
let csrfToken: string | null = null

export function setCsrfToken(token: string | null) {
  csrfToken = token
}

export function getCsrfToken(): string | null {
  return csrfToken
}

/** Where the current CSRF token is read from. */
export const CSRF_PATH = '/auth/csrf'
