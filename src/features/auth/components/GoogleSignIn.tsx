import { useEffect, useRef, useState } from 'react'
import { GoogleIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import { env } from '../../../config/env.ts'
import { useLogin } from '../hooks/useLogin.ts'
import { loadGoogleIdentity } from '../utils/googleIdentity.ts'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'

/**
 * "OR" divider plus Google's own sign-in button. Google renders the
 * button (it returns the ID token the backend needs); we reserve its
 * height up front so the form doesn't jump when the script arrives.
 * Needs `VITE_GOOGLE_CLIENT_ID`; without it, production renders nothing and
 * development renders a disabled placeholder explaining the setup.
 */
export function GoogleSignIn() {
  const login = useLogin()
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  // GIS keeps the callback it was initialised with, so route it through a
  // ref to always reach the latest handler.
  const onCredential = useRef(login.googleSignIn)
  useEffect(() => {
    onCredential.current = login.googleSignIn
  })

  const enabled = env.googleClientId !== ''

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false

    loadGoogleIdentity()
      .then((google) => {
        const container = containerRef.current
        if (cancelled || !container) return

        google.initialize({
          client_id: env.googleClientId,
          callback: ({ credential }) => void onCredential.current(credential),
        })
        google.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, Math.round(container.clientWidth))),
        })
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  // Production: no client ID means no Google option at all. Development:
  // show a disabled placeholder so a missing setup is obvious, not silent.
  if (!enabled && !env.isDev) return null

  const divider = (
    <div className="text-text-muted my-5 flex items-center gap-3 text-[0.72rem] font-bold tracking-wide">
      <span className="bg-border h-px flex-1" />
      <span>OR</span>
      <span className="bg-border h-px flex-1" />
    </div>
  )

  if (!enabled) {
    return (
      <div className="flex flex-col">
        {divider}
        <button
          type="button"
          disabled
          className="border-border bg-surface text-text-muted flex cursor-not-allowed items-center justify-center gap-2.5 rounded-lg border px-4 py-2.5 font-semibold opacity-70"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
        <p className="text-text-muted mt-2 text-center text-[0.78rem]">
          Dev only: set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>.env.local</code> and
          restart the dev server to enable Google sign-in.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {divider}

      {!loadFailed && (
        <div className="relative min-h-11">
          {!ready && (
            <div
              aria-hidden="true"
              className="bg-surface border-border absolute inset-0 animate-pulse rounded-lg border"
            />
          )}
          <div
            ref={containerRef}
            className={`flex justify-center transition-opacity duration-200 ${
              login.isGoogleSigningIn ? 'pointer-events-none opacity-50' : ''
            }`}
          />
        </div>
      )}

      {login.isGoogleSigningIn && (
        <p
          role="status"
          className="text-text-muted mt-3 flex items-center justify-center gap-2 text-[0.85rem]"
        >
          <SpinnerIcon width={16} height={16} className="animate-spin" />
          Verifying your Google account…
        </p>
      )}

      {(login.googleError || loadFailed) && (
        <div className="mt-3">
          <FormMessage tone="error">
            {login.googleError ??
              'Google sign-in is unavailable right now. Please use your email instead.'}
          </FormMessage>
        </div>
      )}
    </div>
  )
}
