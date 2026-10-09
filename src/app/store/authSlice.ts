import {
  createAsyncThunk,
  createSlice,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit'
import { toUserMessage } from '../../lib/api/ApiError.ts'
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
  /** `Date.now()` of the last successful code request (drives resend cooldown). */
  codeSentAt: number | null
  sendStatus: RequestStatus
  verifyStatus: RequestStatus
  googleStatus: RequestStatus
  /** Latest failure message from the backend (or the network layer). */
  error: string | null
  /** Same, for Google sign-in (shown next to the Google button). */
  googleError: string | null
}

type AuthRootState = { auth: AuthState }

function getStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null

    const session = JSON.parse(raw) as Session
    const expiresAt = Date.parse(session.expiresAt)
    return session.accessToken && Number.isFinite(expiresAt) && expiresAt > Date.now()
      ? session
      : null
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
  codeSentAt: null,
  sendStatus: 'idle',
  verifyStatus: 'idle',
  googleStatus: 'idle',
  error: null,
  googleError: null,
}

const toMessage = toUserMessage

/** Step 1: ask the backend to email a login code. Also used to resend. */
export const requestOtp = createAsyncThunk<
  { email: string; message: string; expiresInSeconds: number; sentAt: number },
  string,
  { state: AuthRootState; rejectValue: string }
>(
  'auth/requestOtp',
  async (email, { rejectWithValue }) => {
    try {
      const response = await api.auth.requestOtp(email)
      return {
        email,
        message: response.message,
        expiresInSeconds: response.expires_in_seconds,
        sentAt: Date.now(),
      }
    } catch (error) {
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
  state.codeSentAt = null
  state.verifyStatus = 'idle'
  state.googleStatus = 'idle'
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
    },
    sessionCleared(state) {
      state.session = null
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
        state.otpExpiresInSeconds = action.payload.expiresInSeconds
        state.codeSentAt = action.payload.sentAt
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
  (): ThunkAction<void, AuthRootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    const token = getState().auth.session?.accessToken
    dispatch(sessionCleared())
    if (token) void api.auth.logout(token).catch(() => undefined)
  }
