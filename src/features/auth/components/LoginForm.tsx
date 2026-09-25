import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import {
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  LockIcon,
  MailIcon,
} from '../../../components/ui/icons.tsx'

const FIELD_LABEL = 'text-text-muted text-[0.72rem] font-bold tracking-wide uppercase'
const INPUT_GROUP =
  'border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex items-center gap-2 rounded-lg border px-3 focus-within:outline-2'

/**
 * Presentational login form. Submission isn't wired to a real API yet
 * — there's no `auth` API/session layer to call. When one exists, move
 * the request into `features/auth/api/` and call it from `onSubmit`
 * (or lift submission into a `useLogin` hook in `features/auth/hooks/`).
 */
export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    // TODO: replace with a real call once features/auth/api exists.
    window.setTimeout(() => setIsSubmitting(false), 400)
  }

  return (
    <form className="flex w-full flex-col gap-4.5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5 text-left">
        <label htmlFor="email" className={FIELD_LABEL}>
          Email address
        </label>
        <div className={INPUT_GROUP}>
          <MailIcon className="text-text-muted shrink-0" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="text-text min-w-0 flex-1 border-none bg-transparent py-2.5 outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-left">
        <label htmlFor="password" className={FIELD_LABEL}>
          Password
        </label>
        <div className={INPUT_GROUP}>
          <LockIcon className="text-text-muted shrink-0" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="text-text min-w-0 flex-1 border-none bg-transparent py-2.5 outline-none"
          />
          <button
            type="button"
            className="text-text-muted hover:text-text inline-flex items-center justify-center border-none bg-none p-0"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[0.85rem]">
        <label className="text-text-muted flex items-center gap-1.5">
          <input type="checkbox" name="remember" />
          Remember me
        </label>
        {/* TODO: wire up once a password-reset flow exists. */}
        <button
          type="button"
          className="text-accent hover:text-accent-hover border-none bg-none p-0 text-[0.85rem] font-semibold"
        >
          Forgot password?
        </button>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          'Signing in…'
        ) : (
          <>
            Continue <ChevronRightIcon />
          </>
        )}
      </Button>

      <div className="text-text-muted flex items-center gap-3 text-[0.72rem] font-bold tracking-wide">
        <span className="bg-border h-px flex-1" />
        <span>OR</span>
        <span className="bg-border h-px flex-1" />
      </div>

      {/* TODO: wire up once an OAuth provider is configured. */}
      <button
        type="button"
        className="border-border bg-bg text-text hover:border-accent flex items-center justify-center gap-2.5 rounded-lg border px-4 py-2.5 font-semibold"
      >
        <GoogleIcon />
        Sign in with Google
      </button>
    </form>
  )
}
