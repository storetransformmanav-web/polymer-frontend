import { useState } from 'react'
import { Button } from '../../../components/ui/Button.jsx'
import {
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  LockIcon,
  MailIcon,
} from '../../../components/ui/icons.jsx'
import './LoginForm.css'

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

  function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    // TODO: replace with a real call once features/auth/api exists.
    window.setTimeout(() => setIsSubmitting(false), 400)
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="login-form__field">
        <label htmlFor="email">Email address</label>
        <div className="login-form__input-group">
          <MailIcon className="login-form__input-icon" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>

      <div className="login-form__field">
        <label htmlFor="password">Password</label>
        <div className="login-form__input-group">
          <LockIcon className="login-form__input-icon" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className="login-form__toggle-visibility"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      <div className="login-form__row">
        <label className="login-form__remember">
          <input type="checkbox" name="remember" />
          Remember me
        </label>
        {/* TODO: wire up once a password-reset flow exists. */}
        <button type="button" className="login-form__link">
          Forgot password?
        </button>
      </div>

      <Button type="submit" disabled={isSubmitting} className="login-form__submit">
        {isSubmitting ? (
          'Signing in…'
        ) : (
          <>
            Continue <ChevronRightIcon />
          </>
        )}
      </Button>

      <div className="login-form__divider">
        <span>OR</span>
      </div>

      {/* TODO: wire up once an OAuth provider is configured. */}
      <button type="button" className="login-form__google">
        <GoogleIcon />
        Sign in with Google
      </button>
    </form>
  )
}
