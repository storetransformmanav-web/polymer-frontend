import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit'
import { ApiError, toUserMessage } from '../../lib/api/ApiError.ts'
import { getCsrfToken } from '../../lib/api/csrf.ts'
import {
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  readIdleTimeoutMinutes,
} from '../../lib/idleTimeout.ts'
import { api, type AuthUser } from '../../lib/api/endpoints.ts'

export const SESSION_STORAGE_KEY = 'polymer-crm:session'
/** When the signed-in person last did something, shared by every tab (see useSessionGuard). */
export const SESSION_ACTIVITY_KEY = 'polymer-crm:last-activity'

/**
 * The signed-in person. There is no token here: the session is the backend's own HttpOnly cookie,
 * which the page cannot read. What is kept (and stored in localStorage) is the user's profile, so
 * the app can draw itself at once; whether the session is still good is asked of `GET /auth/me`
 * every time the page loads (`restoreSession`).
 */
export interface Session {
  /** When the app ends this session: the backend's expiry, or sooner (see `sessionExpiry`). */
  expiresAt: string
  user: AuthUser
  /**
   * How many minutes without activity the session lasts — the backend's `idle_timeout_minutes`
   * (sent when signing in with a code or Google, and by `GET /auth/csrf` after a reload). The idle
   * timer follows it (`useSessionGuard`); a session without it uses the default (1440).
   */
  idleTimeoutMinutes?: number
}

const DAY_MS = 24 * 60 * 60 * 1000
/** "Remember me" ticked: the session lasts 30 days (the backend issues a 30-day token). */
export const SESSION_DAYS = 30
/** "Remember me" not ticked: the default session — one day (the backend's default token). */
export const DEFAULT_SESSION_DAYS = 1

/**
 * When the app ends a session that starts now: after 30 days with "Remember me" (1 day
 * without), or when the backend's token runs out if that is sooner.
 */
export function sessionExpiry(
  backendExpiresAt: string | null | undefined,
  now = Date.now(),
  rememberMe = true,
): string {
  const limit = now + (rememberMe ? SESSION_DAYS : DEFAULT_SESSION_DAYS) * DAY_MS
  const backend = Date.parse(backendExpiresAt ?? '')
  return new Date(
    Number.isFinite(backend) ? Math.min(backend, limit) : limit,
  ).toISOString()
}

function buildSession(
  response: {
    expires_at?: string | null
    idle_timeout_minutes?: unknown
    user: AuthUser
  },
  rememberMe: boolean,
): Session {
  // Anything else in the answer — a token, if the backend still sends one — is dropped here.
  return {
    expiresAt: sessionExpiry(response.expires_at, Date.now(), rememberMe),
    user: response.user,
    idleTimeoutMinutes:
      readIdleTimeoutMinutes(response.idle_timeout_minutes) ??
      DEFAULT_IDLE_TIMEOUT_MINUTES,
  }
}

type RequestStatus = 'idle' | 'loading' | 'error'

export interface AuthState {
  /** The signed-in session, or null. Persisted — see store.ts. */
  session: Session | null
  /** The login page's "Remember me" checkbox: ticked = a 30-day session, else the default. */
  rememberMe: boolean
  /** Where the user is in the email-code login flow. */
  step: 'email' | 'otp'
  email: string
  /** The backend's confirmation message after a code was requested. */
  notice: string | null
  otpExpiresInSeconds: number
  /** `Date.now()`-style time when a new code may be requested (drives the resend timer). */
  resendAvailableAt: number | null
  sendStatus: RequestStatus
  verifyStatus: RequestStatus
  googleStatus: RequestStatus
  /** Latest failure message from the backend (or the network layer). */
  error: string | null
  /** Same, for Google sign-in (shown next to the Google button). */
  googleError: string | null
  /** Why the user was signed out automatically (shown once on the login page). */
  signedOutReason: SignOutReason | null
  /** The API's own words for why the server ended the session (a 401), shown on the login page. */
  signedOutMessage: string | null
}

/**
 * 'expired' = the session ran out or the token was rejected; 'idle' = nothing was done for the
 * idle limit.
 */
export type SignOutReason = 'expired' | 'idle'

type AuthRootState = { auth: AuthState }

/** Is this stored value really a Session? (localStorage can be edited or corrupted.) */
function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const user = candidate.user as Record<string, unknown> | null | undefined

  return (
    typeof candidate.expiresAt === 'string' &&
    typeof user === 'object' &&
    user !== null &&
    typeof user.id === 'string' &&
    typeof user.role === 'string'
  )
}

function getStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null

    const stored: unknown = JSON.parse(raw)
    if (!isSession(stored)) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    const expiresAt = Date.parse(stored.expiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    // Only the user's profile and the expiry are kept. A session saved by an older version of the
    // app held an `accessToken` too: it is rewritten without it, at once, not left until the next
    // sign-in.
    const idleTimeoutMinutes = readIdleTimeoutMinutes(stored.idleTimeoutMinutes)
    const session: Session = {
      expiresAt: stored.expiresAt,
      user: stored.user,
      ...(idleTimeoutMinutes !== null ? { idleTimeoutMinutes } : {}),
    }
    const kept = new Set(['expiresAt', 'user', 'idleTimeoutMinutes'])
    if (Object.keys(stored).some((key) => !kept.has(key))) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    }
    return session
  } catch {
    return null
  }
}

const initialState: AuthState = {
  session: getStoredSession(),
  rememberMe: false,
  step: 'email',
  email: '',
  notice: null,
  otpExpiresInSeconds: 600,
  resendAvailableAt: null,
  sendStatus: 'idle',
  verifyStatus: 'idle',
  googleStatus: 'idle',
  error: null,
  googleError: null,
  signedOutReason: null,
  signedOutMessage: null,
}

const toMessage = toUserMessage

/** How long before a new code can be requested, when the backend doesn't say. */
export const DEFAULT_RESEND_SECONDS = 30

/**
 * Pulls the wait out of the backend's cooldown message, e.g. "Please wait
 * 41 seconds before requesting another code." → 41 ("2 minutes" → 120).
 * Returns null when the message has no usable duration.
 */
export function parseWaitSeconds(message: string): number | null {
  const match = /(\d+)\s*(second|sec|minute|min)/i.exec(message)
  if (!match) return null

  const amount = Number(match[1])
  const seconds = match[2].toLowerCase().startsWith('min') ? amount * 60 : amount
  return seconds > 0 && seconds <= 3600 ? seconds : null
}

/**
 * In development the backend answers 200 even for an unknown email, but adds
 * a `dev_note` saying no code was sent ("No active user with this email…").
 * Moving on to the code screen would be misleading, so that note is surfaced
 * on the email step instead. Other notes are ignored.
 */
const NO_ACTIVE_USER_NOTE = /no active user/i

interface OtpRequestResult {
  email: string
  message: string
  /** null when unknown (a still-valid earlier code is being reused). */
  expiresInSeconds: number | null
  resendAvailableAt: number
  /** True when no new code was sent because one was requested a moment ago. */
  rateLimited: boolean
}

/**
 * Step 1: ask the backend to email a login code. Also used to resend.
 *
 * The backend limits how often a code can be requested for one account and
 * answers 429 "Please wait N seconds…". That means a code was *already sent*
 * and is still valid, so instead of leaving the user stuck on the email
 * screen with an error, this resolves as "rate limited": the flow moves on
 * to the code screen with the backend's message and an exact resend timer.
 * A 429 with no readable wait time (e.g. a general traffic limit) is still
 * reported as an error.
 */
export const requestOtp = createAsyncThunk<
  OtpRequestResult,
  string,
  { state: AuthRootState; rejectValue: string }
>(
  'auth/requestOtp',
  async (email, { rejectWithValue }) => {
    try {
      const response = await api.auth.requestOtp(email)
      if (response.dev_note && NO_ACTIVE_USER_NOTE.test(response.dev_note)) {
        return rejectWithValue(response.dev_note)
      }
      return {
        email,
        message: response.message,
        expiresInSeconds: response.expires_in_seconds,
        resendAvailableAt: Date.now() + DEFAULT_RESEND_SECONDS * 1000,
        rateLimited: false,
      }
    } catch (error) {
      const waitSeconds =
        error instanceof ApiError && error.status === 429
          ? parseWaitSeconds(error.message)
          : null

      if (error instanceof ApiError && waitSeconds !== null) {
        return {
          email,
          message: `${error.message} A code you already received is still valid — enter it below.`,
          expiresInSeconds: null,
          resendAvailableAt: Date.now() + waitSeconds * 1000,
          rateLimited: true,
        }
      }
      return rejectWithValue(toMessage(error))
    }
  },
  // Ignore repeat clicks while a request is already in flight.
  { condition: (_email, { getState }) => getState().auth.sendStatus !== 'loading' },
)

/** Step 2: exchange the emailed code for a session. */
export const verifyOtp = createAsyncThunk<
  Session,
  string,
  { state: AuthRootState; rejectValue: string }
>(
  'auth/verifyOtp',
  async (code, { getState, rejectWithValue }) => {
    try {
      const { email, rememberMe } = getState().auth
      const response = await api.auth.verifyOtp(email, code, rememberMe)
      return buildSession(response, rememberMe)
    } catch (error) {
      return rejectWithValue(toMessage(error))
    }
  },
  { condition: (_code, { getState }) => getState().auth.verifyStatus !== 'loading' },
)

/**
 * Sign in with a Google ID token (the `credential` from Google Sign-In) and the `nonce` that was
 * given to Google for this sign-in — the API checks the token carries that same nonce.
 */
export const googleSignIn = createAsyncThunk<
  Session,
  { credential: string; nonce: string },
  { state: AuthRootState; rejectValue: string }
>(
  'auth/googleSignIn',
  async ({ credential, nonce }, { getState, rejectWithValue }) => {
    try {
      const { rememberMe } = getState().auth
      const response = await api.auth.google(credential, nonce, rememberMe)
      return buildSession(response, rememberMe)
    } catch (error) {
      return rejectWithValue(toMessage(error))
    }
  },
  {
    condition: (_credential, { getState }) => getState().auth.googleStatus !== 'loading',
  },
)

/**
 * Page load: asks the backend who is signed in (`GET /auth/me`, with the session cookie the
 * browser sends). 200 means signed in — the answer is the user with their permissions — and 401
 * means show the login page. Any other failure (the network, a server error) keeps what was stored,
 * so a blip does not sign anyone out: the next request tells the truth.
 */
export const restoreSession = createAsyncThunk<
  Session,
  void,
  { state: AuthRootState; rejectValue: 'unauthorized' | 'unreachable' }
>('auth/restoreSession', async (_arg, { getState, rejectWithValue }) => {
  try {
    const me = await api.auth.me()
    // The CSRF token is not kept anywhere: after a reload it is asked for again. If this fails the
    // first change that needs it gets a 403 and fetches it then (see the API client). The same
    // answer says how long the session may sit idle, which is what the idle timer follows.
    const fromCsrf = await api.auth.csrf().catch(() => undefined)
    const stored = getState().auth.session
    return {
      user: me.user,
      // Keep the expiry the sign-in set; a session found only by its cookie gets the default.
      expiresAt: stored?.expiresAt ?? sessionExpiry(me.expires_at, Date.now(), false),
      idleTimeoutMinutes:
        fromCsrf?.idleTimeoutMinutes ??
        readIdleTimeoutMinutes(me.idle_timeout_minutes) ??
        stored?.idleTimeoutMinutes ??
        DEFAULT_IDLE_TIMEOUT_MINUTES,
    }
  } catch (error) {
    return rejectWithValue(
      error instanceof ApiError && error.status === 401 ? 'unauthorized' : 'unreachable',
    )
  }
})

/** Stores a fresh session and resets the login flow for next time. */
function signedIn(state: AuthState, session: Session) {
  state.session = session
  state.step = 'email'
  state.email = ''
  state.notice = null
  state.resendAvailableAt = null
  state.verifyStatus = 'idle'
  state.googleStatus = 'idle'
  state.signedOutReason = null
  state.signedOutMessage = null
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Back to the email step (keeps the typed email so it can be edited). */
    emailEditRequested(state) {
      state.step = 'email'
      state.error = null
      state.notice = null
      state.verifyStatus = 'idle'
    },
    /** The "Remember me" checkbox was ticked or unticked. */
    rememberMeChanged(state, action: PayloadAction<boolean>) {
      state.rememberMe = action.payload
    },
    errorCleared(state) {
      state.error = null
      state.googleError = null
      state.signedOutReason = null
      state.signedOutMessage = null
    },
    /** Ends the session. `reason` is set for automatic sign-outs only. */
    sessionCleared(state, action: PayloadAction<SignOutReason | undefined>) {
      state.session = null
      state.signedOutReason = action.payload ?? null
      state.signedOutMessage = null
    },
    /**
     * The server ended the session (any 401 while signed in — it has really ended: idle past its own
     * limit, revoked or expired): the user is cleared from memory and the login page shows the
     * API's own message. This is the only thing that signs a person out because of the server.
     */
    sessionEnded(state, action: PayloadAction<string | undefined>) {
      state.session = null
      state.signedOutReason = 'expired'
      state.signedOutMessage = action.payload ?? null
    },
    /** The server's idle limit (in minutes) changed — `GET /auth/csrf` said so while signed in. */
    idleTimeoutUpdated(state, action: PayloadAction<number>) {
      if (state.session && state.session.idleTimeoutMinutes !== action.payload) {
        state.session = { ...state.session, idleTimeoutMinutes: action.payload }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(requestOtp.pending, (state) => {
        state.sendStatus = 'loading'
        state.error = null
      })
      .addCase(requestOtp.fulfilled, (state, action) => {
        state.sendStatus = 'idle'
        state.step = 'otp'
        state.email = action.payload.email
        state.notice = action.payload.message
        if (action.payload.expiresInSeconds !== null) {
          state.otpExpiresInSeconds = action.payload.expiresInSeconds
        }
        state.resendAvailableAt = action.payload.resendAvailableAt
      })
      .addCase(requestOtp.rejected, (state, action) => {
        // A skipped duplicate (see `condition`) isn't a failure.
        if (action.meta.condition) return
        state.sendStatus = 'error'
        state.error = action.payload ?? 'Something went wrong. Please try again.'
      })
      .addCase(verifyOtp.pending, (state) => {
        state.verifyStatus = 'loading'
        state.error = null
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        signedIn(state, action.payload)
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        if (action.meta.condition) return
        state.verifyStatus = 'error'
        state.error = action.payload ?? 'Something went wrong. Please try again.'
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.session = action.payload
      })
      .addCase(restoreSession.rejected, (state, action) => {
        // 401: no session — the login page (and, if one was stored, why it ended).
        if (action.payload === 'unauthorized') {
          if (state.session) state.signedOutReason = 'expired'
          state.session = null
        }
      })
      .addCase(googleSignIn.pending, (state) => {
        state.googleStatus = 'loading'
        state.googleError = null
      })
      .addCase(googleSignIn.fulfilled, (state, action) => {
        signedIn(state, action.payload)
      })
      .addCase(googleSignIn.rejected, (state, action) => {
        if (action.meta.condition) return
        state.googleStatus = 'error'
        state.googleError = action.payload ?? 'Something went wrong. Please try again.'
      })
  },
})

export const {
  emailEditRequested,
  errorCleared,
  idleTimeoutUpdated,
  rememberMeChanged,
  sessionCleared,
  sessionEnded,
} = authSlice.actions
export const authReducer = authSlice.reducer

/**
 * "Sign out of all devices" / "Sign out other devices" (`POST /auth/logout-all`). With
 * `keepThisDevice` the other devices are signed out and this one stays; without it this one is
 * signed out too, so once the backend has answered the local session is cleared and the login page
 * opens. A refusal is returned as the backend's own message and nothing changes here.
 */
export const signOutDevices = createAsyncThunk<
  { message: string },
  { keepThisDevice: boolean },
  { state: AuthRootState; rejectValue: string }
>('auth/signOutDevices', async ({ keepThisDevice }, { dispatch, rejectWithValue }) => {
  try {
    const result = await api.auth.logoutAll(keepThisDevice)
    if (!keepThisDevice) dispatch(sessionCleared())
    return result
  } catch (error) {
    return rejectWithValue(toMessage(error))
  }
})

/**
 * Signs out. The local session is cleared first so the UI reacts
 * instantly; the server-side end of the session (which also clears its cookie) is best-effort in
 * the background — a session that is already over failing there is harmless.
 */
export const logout =
  (reason?: SignOutReason): ThunkAction<void, AuthRootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    const hadSession = getState().auth.session !== null
    // Taken before the session is cleared (which makes the client forget it): logout is a change.
    const csrf = getCsrfToken()
    dispatch(sessionCleared(reason))
    if (hadSession) void api.auth.logout(csrf).catch(() => undefined)
  }
