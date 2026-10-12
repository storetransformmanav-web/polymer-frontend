import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  emailEditRequested,
  errorCleared,
  googleSignIn as googleSignInThunk,
  requestOtp,
  verifyOtp,
} from '../../../app/store/authSlice.ts'

/**
 * State and actions for the two-step email-code login (email -> code).
 * The flow lives in the `auth` Redux slice, so components only render
 * `step` and call these actions. `sendCode`/`verifyCode` resolve to
 * whether the request succeeded, so callers can react (e.g. reset the
 * code boxes after a wrong code) without inspecting thunk results.
 */
export function useLogin() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector((state) => state.auth)

  return {
    step: auth.step,
    email: auth.email,
    notice: auth.notice,
    expiresInSeconds: auth.otpExpiresInSeconds,
    codeSentAt: auth.codeSentAt,
    error: auth.error,
    isSending: auth.sendStatus === 'loading',
    isVerifying: auth.verifyStatus === 'loading',
    googleError: auth.googleError,
    signedOutReason: auth.signedOutReason,
    isGoogleSigningIn: auth.googleStatus === 'loading',

    async sendCode(email: string) {
      return requestOtp.fulfilled.match(await dispatch(requestOtp(email)))
    },
    async verifyCode(code: string) {
      return verifyOtp.fulfilled.match(await dispatch(verifyOtp(code)))
    },
    async googleSignIn(credential: string) {
      return googleSignInThunk.fulfilled.match(
        await dispatch(googleSignInThunk(credential)),
      )
    },
    editEmail: () => dispatch(emailEditRequested()),
    clearError: () => dispatch(errorCleared()),
  }
}
