import { z } from 'zod'
import { apiClient } from './client.ts'

/**
 * Every backend endpoint the app calls lives in this one file: the path,
 * the Zod schema for its response, and the function that performs the
 * request. Redux thunks (src/app/store/*Slice.ts) call these functions —
 * nothing else in the app talks to `apiClient` directly.
 *
 * Paths are relative to `VITE_API_BASE_URL` (see src/config/env.ts).
 * Add a new endpoint here: path in `ENDPOINTS`, schema below, function in
 * `api`.
 */
export const ENDPOINTS = {
  auth: {
    requestOtp: '/auth/otp/request',
    verifyOtp: '/auth/otp/verify',
    google: '/auth/google',
    logout: '/auth/logout',
  },
} as const

// ---------------------------------------------------------------------------
// Schemas — the source of truth for response types (derive with z.infer)
// ---------------------------------------------------------------------------

const authUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.string(),
  is_active: z.boolean(),
  last_login_at: z.string().nullable(),
})

const otpRequestResponseSchema = z.object({
  message: z.string(),
  expires_in_seconds: z.number().default(600),
})

const loginResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_at: z.string(),
  user: authUserSchema,
})

export type AuthUser = z.infer<typeof authUserSchema>
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>
export type LoginResponse = z.infer<typeof loginResponseSchema>

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const api = {
  auth: {
    /** Step 1 of login: emails a 6-digit code (valid 10 minutes). */
    async requestOtp(email: string): Promise<OtpRequestResponse> {
      const data = await apiClient.post(ENDPOINTS.auth.requestOtp, { email })
      return otpRequestResponseSchema.parse(data)
    },

    /** Step 2 of login: exchanges the code for an access token. */
    async verifyOtp(email: string, code: string): Promise<LoginResponse> {
      const data = await apiClient.post(ENDPOINTS.auth.verifyOtp, { email, code })
      return loginResponseSchema.parse(data)
    },

    /**
     * Google sign-in: exchanges a Google ID token (the `credential` from
     * Google Identity Services) for an access token. Only emails that
     * already belong to an active CRM user can sign in.
     */
    async google(credential: string): Promise<LoginResponse> {
      const data = await apiClient.post(ENDPOINTS.auth.google, { credential })
      return loginResponseSchema.parse(data)
    },

    /**
     * Invalidates the token server-side. The token is passed explicitly
     * because callers clear the local session first (so the UI responds
     * instantly), which also clears the client's default token.
     */
    async logout(accessToken: string): Promise<void> {
      await apiClient.post(ENDPOINTS.auth.logout, undefined, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    },
  },
}
