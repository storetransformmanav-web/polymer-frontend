import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { ChevronRightIcon, MailIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import { useLogin } from '../hooks/useLogin.ts'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { GoogleSignIn } from './GoogleSignIn.tsx'

const FIELD_LABEL = 'text-text-muted text-[0.72rem] font-bold tracking-wide uppercase'
const INPUT_GROUP =
  'bg-surface focus-within:border-accent focus-within:outline-accent-tint flex items-center gap-2 rounded-lg border px-3 transition-colors focus-within:outline-2'

// Same wording the API returns for a malformed email, so the message is
// identical whether it's caught here (instantly) or by the server.
const INVALID_EMAIL = 'Enter a valid email address'

// Shown once after an automatic sign-out, so it's never a mystery.
const SIGNED_OUT_MESSAGES = {
  idle: 'You were signed out after a period of inactivity. Please sign in again.',
  expired: 'Your session has expired. Please sign in again.',
} as const
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Step 1: collect the email and request a login code. */
export function EmailStep() {
  const login = useLogin()
  const [email, setEmail] = useState(login.email)
  const [validationError, setValidationError] = useState<string | null>(null)

  const hasEmail = email.trim().length > 0
  const error = validationError ?? login.error

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (login.isSending) return

    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) {
      setValidationError(INVALID_EMAIL)
      return
    }
    await login.sendCode(trimmed)
  }

  return (
    <form className="flex w-full flex-col" onSubmit={handleSubmit} noValidate>
      <h1 className="mb-1.5 text-[1.6rem] font-semibold">Welcome back</h1>
      <p className="text-text-muted mb-7 text-left">
        Enter your email and we&apos;ll send you a one-time login code.
      </p>

      <div className="flex flex-col gap-1.5 text-left">
        <label htmlFor="email" className={FIELD_LABEL}>
          Email address
        </label>
        <div className={`${INPUT_GROUP} ${error ? 'border-danger' : 'border-border'}`}>
          <MailIcon className="text-text-muted shrink-0" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            aria-invalid={error ? true : undefined}
            value={email}
            readOnly={login.isSending}
            onChange={(event) => {
              setEmail(event.target.value)
              if (validationError) setValidationError(null)
              // Typing means "trying again": drop any error or sign-out notice.
              if (login.error || login.googleError || login.signedOutReason) {
                login.clearError()
              }
            }}
            className="text-text placeholder:text-text-muted/60 min-w-0 flex-1 border-none bg-transparent py-2.5 outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
      {!error && login.signedOutReason && (
        <div className="mt-3">
          <FormMessage tone="info">
            {SIGNED_OUT_MESSAGES[login.signedOutReason]}
          </FormMessage>
        </div>
      )}

      {/* Continue appears once there's something to continue with. The
          grid-rows trick animates height without measuring, and `inert`
          keeps the collapsed button out of the tab order. */}
      <div
        inert={!hasEmail}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          hasEmail ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <Button type="submit" disabled={login.isSending} className="mt-4 w-full">
            {login.isSending ? (
              <>
                <SpinnerIcon className="animate-spin" /> Sending code…
              </>
            ) : (
              <>
                Continue <ChevronRightIcon />
              </>
            )}
          </Button>
        </div>
      </div>

      <GoogleSignIn />
    </form>
  )
}
