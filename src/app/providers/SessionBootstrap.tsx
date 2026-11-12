import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SpinnerIcon } from '../../components/ui/icons.tsx'
import { restoreSession } from '../store/authSlice.ts'
import { useAppDispatch } from '../store/hooks.ts'

/**
 * Page load: before anything of the app is drawn, ask the backend who is signed in
 * (`GET /auth/me`). 200 means signed in, 401 means the login page. A stored user (what is kept in
 * localStorage — never a token) is only what the app shows if the backend cannot be reached.
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const [ready, setReady] = useState(false)
  const asked = useRef(false)

  useEffect(() => {
    // Strict Mode runs effects twice in development: one question is enough.
    if (asked.current) return
    asked.current = true
    void dispatch(restoreSession()).finally(() => setReady(true))
  }, [dispatch])

  if (!ready) {
    return (
      <div
        role="status"
        className="text-text-muted flex min-h-svh flex-1 items-center justify-center gap-2 text-[0.9rem]"
      >
        <SpinnerIcon width={18} height={18} className="animate-spin" />
        Checking your session…
      </div>
    )
  }
  return <>{children}</>
}
