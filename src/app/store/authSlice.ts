import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit'
import { ApiError, toUserMessage } from '../../lib/api/ApiError.ts'
import { api, type AuthUser } from '../../lib/api/endpoints.ts'

export const SESSION_STORAGE_KEY = 'polymer-crm:session'

export interface Session {
  accessToken: string
  expiresAt: string
  user: AuthUser
}

type RequestStatus = 'idle' | 'loading' | 'error'

export interface AuthState {
  /** The signed-in session, or null. Persisted — see store.ts. */
  session: Session | null
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
}

/** 'idle' = inactivity timeout; 'expired' = the token ran out or was rejected. */
export type SignOutReason = 'idle' | 'expired'

type AuthRootState = { auth: AuthState }

/** Is this stored value really a Session? (localStorage can be edited or corrupted.) */
function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const user = candidate.user as Record<string, unknown> | null | undefined

  return (
    typeof candidate.accessToken === 'string' &&
    candidate.accessToken.length > 0 &&
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

    const session: unknown = JSON.parse(raw)
    if (!isSession(session)) return null

    const expiresAt = Date.parse(session.expiresAt)
    return Number.isFinite(expiresAt) && expiresAt > Date.now() ? session : null
  } catch {
    return null
  }
}

const initialState: AuthState = {
  session: getStoredSession(),
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
      const response = await api.auth.verifyOtp(getState().auth.email, code)
      return {
        accessToken: response.access_token,
        expiresAt: response.expires_at,
        user: response.user,
      }
    } catch (error) {
      return rejectWithValue(toMessage(error))
    }
  },
  { condition: (_code, { getState }) => getState().auth.verifyStatus !== 'loading' },
)

/** Sign in with a Google ID token (the `credential` from Google Sign-In). */
export const googleSignIn = createAsyncThunk<
  Session,
  string,
  { state: AuthRootState; rejectValue: string }
>(
  'auth/googleSignIn',
  async (credential, { rejectWithValue }) => {
    try {
      const response = await api.auth.google(credential)
      return {
        accessToken: response.access_token,
        expiresAt: response.expires_at,
        user: response.user,
      }
    } catch (error) {
      return rejectWithValue(toMessage(error))
    }
  },
  {
    condition: (_credential, { getState }) => getState().auth.googleStatus !== 'loading',
  },
)

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
    errorCleared(state) {
      state.error = null
      state.googleError = null
      state.signedOutReason = null
    },
    /** Ends the session. `reason` is set for automatic sign-outs only. */
    sessionCleared(state, action: PayloadAction<SignOutReason | undefined>) {
      state.session = null
      state.signedOutReason = action.payload ?? null
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

export const { emailEditRequested, errorCleared, sessionCleared } = authSlice.actions
export const authReducer = authSlice.reducer

/**
 * Signs out. The local session is cleared first so the UI reacts
 * instantly; the server-side invalidation is best-effort in the
 * background (an expired/invalid token failing there is harmless).
 */
export const logout =
  (reason?: SignOutReason): ThunkAction<void, AuthRootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    const token = getState().auth.session?.accessToken
    dispatch(sessionCleared(reason))
    if (token) void api.auth.logout(token).catch(() => undefined)
  }
