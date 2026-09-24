import { useState } from 'react'
import { Button } from '../../../components/ui/Button.jsx'
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
        <label htmlFor="email">Email</label>
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

      <div className="login-form__field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
