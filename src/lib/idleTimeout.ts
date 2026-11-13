/**
 * How long a signed-in person may do nothing before the app signs them out. **The backend decides**:
 * it sends `idle_timeout_minutes` with the sign-in answers (`POST /auth/otp/verify`,
 * `POST /auth/google`) and with `GET /auth/csrf` (asked for after every page reload). Nothing in the
 * app hard-codes a number of minutes except the fallback below, for an answer that says nothing.
 */
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 1440

/** The longest limit that is believed (a year): a nonsense value falls back to the default. */
const MAX_IDLE_TIMEOUT_MINUTES = 365 * 24 * 60

/** `idle_timeout_minutes` from an answer: a positive number of minutes, else null (not sent / unusable). */
export function readIdleTimeoutMinutes(value: unknown): number | null {
  const minutes = typeof value === 'string' ? Number(value) : value
  return typeof minutes === 'number' &&
    Number.isFinite(minutes) &&
    minutes > 0 &&
    minutes <= MAX_IDLE_TIMEOUT_MINUTES
    ? minutes
    : null
}

/** The idle limit in milliseconds for a session's `idleTimeoutMinutes` (the default when it has none). */
export const idleTimeoutMs = (minutes: number | null | undefined): number =>
  (readIdleTimeoutMinutes(minutes) ?? DEFAULT_IDLE_TIMEOUT_MINUTES) * 60_000
