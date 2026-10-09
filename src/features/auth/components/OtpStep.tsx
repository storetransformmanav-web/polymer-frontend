import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { ArrowLeftIcon, MailIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import { OtpInput } from '../../../components/ui/OtpInput.tsx'
import { useLogin } from '../hooks/useLogin.ts'
import { FormMessage } from './FormMessage.tsx'

const CODE_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 30

/**
 * Seconds left until a resend is allowed; ticks once a second. The
 * component using it is keyed on `sentAt`, so each new send remounts it
 * with a fresh clock.
 */
function useResendCountdown(sentAt: number | null) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (sentAt === null) return 0
  return Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000))
}

interface ResendProps {
  sentAt: number | null
  isSending: boolean
  disabled: boolean
  onResend: () => void
}

// Its own component so the 1s countdown tick re-renders only this line.
function Resend({ sentAt, isSending, disabled, onResend }: ResendProps) {
  const secondsLeft = useResendCountdown(sentAt)

  return (
    <p className="text-text-muted text-center text-[0.85rem]">
      Didn&apos;t get the code?{' '}
      {secondsLeft > 0 ? (
        <span aria-live="off">Resend in {secondsLeft}s</span>
      ) : (
        <button
          type="button"
          onClick={onResend}
          disabled={disabled || isSending}
          className="text-accent hover:text-accent-hover cursor-pointer border-none bg-none p-0 font-semibold disabled:pointer-events-none disabled:opacity-60"
        >
          {isSending ? 'Sending…' : 'Resend code'}
        </button>
      )}
    </p>
  )
}

/** Step 2: enter the emailed code and sign in. */
export function OtpStep() {
  const login = useLogin()
  const [code, setCode] = useState('')
  const [resent, setResent] = useState(false)

  const minutes = Math.max(1, Math.round(login.expiresInSeconds / 60))
  const isBusy = login.isVerifying || login.isSending

  async function verify(value: string) {
    if (value.length !== CODE_LENGTH || login.isVerifying) return
    // On success the session is set and the login page redirects away; on
    // failure the boxes reset so the user can retype straight away.
    if (!(await login.verifyCode(value))) setCode('')
  }

  async function resend() {
    setCode('')
    setResent(await login.sendCode(login.email))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void verify(code)
  }

  return (
    <form className="flex w-full flex-col" onSubmit={handleSubmit}>
      <button
        type="button"
        onClick={login.editEmail}
        disabled={isBusy}
        className="text-text-muted hover:text-text mb-5 inline-flex cursor-pointer items-center gap-1.5 self-start border-none bg-none p-0 text-[0.85rem] font-medium transition-colors disabled:pointer-events-none disabled:opacity-60"
      >
        <ArrowLeftIcon width={16} height={16} />
        Use a different email
      </button>

      <h1 className="mb-1.5 text-[1.6rem] font-semibold">Check your email</h1>
      <p className="text-text-muted mb-4 text-left">
        {login.notice ?? 'A login code has been sent.'}
      </p>

      <div className="bg-accent-tint mb-6 flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[0.82rem]">
        <MailIcon width={16} height={16} className="text-accent shrink-0" />
        <span className="max-w-60 truncate font-semibold">{login.email}</span>
      </div>

      <div className="flex flex-col gap-2 text-left">
        <span className="text-text-muted text-[0.72rem] font-bold tracking-wide uppercase">
          6-digit code
        </span>
        <OtpInput
          value={code}
          length={CODE_LENGTH}
          disabled={isBusy}
          invalid={Boolean(login.error) && !login.isSending}
          label="Login code"
          onChange={(value) => {
            setCode(value)
            if (login.error) login.clearError()
            if (resent) setResent(false)
          }}
          onComplete={(value) => void verify(value)}
        />
        <span className="text-text-muted text-[0.78rem]">
          The code expires in {minutes} {minutes === 1 ? 'minute' : 'minutes'}.
        </span>
      </div>

      {login.error && (
        <div className="mt-3">
          <FormMessage tone="error">{login.error}</FormMessage>
        </div>
      )}
      {resent && !login.error && (
        <div className="mt-3">
          <FormMessage tone="success">A new code has been sent.</FormMessage>
        </div>
      )}

      <Button
        type="submit"
        disabled={code.length !== CODE_LENGTH || isBusy}
        className="mt-5 w-full"
      >
        {login.isVerifying ? (
          <>
            <SpinnerIcon className="animate-spin" /> Verifying…
          </>
        ) : (
          'Verify and sign in'
        )}
      </Button>

      <div className="mt-5">
        <Resend
          key={login.codeSentAt}
          sentAt={login.codeSentAt}
          isSending={login.isSending}
          disabled={login.isVerifying}
          onResend={() => void resend()}
        />
      </div>
    </form>
  )
}
