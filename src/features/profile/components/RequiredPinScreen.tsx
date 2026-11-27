import { useId, useState, type FormEvent } from 'react'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  ShieldCheckIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import { Logo } from '../../../components/ui/Logo.tsx'
import { OtpInput } from '../../../components/ui/OtpInput.tsx'
import { PinFields } from '../../../components/ui/PinFields.tsx'
import { useAuth } from '../../../hooks/useAuth.ts'
import type { PinCodeSent } from '../../../lib/api/endpoints.ts'
import { useNow } from '../hooks/useNow.ts'
import { useSecurityPin } from '../hooks/useSecurityPin.ts'
import { clock, deadline, secondsUntil } from '../utils/clock.ts'
import { PinSteps } from './PinSteps.tsx'

const PRIMARY =
  'bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-none px-4 text-[0.88rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const LINK =
  'text-accent hover:text-accent-hover disabled:text-text-muted inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[0.82rem] font-semibold disabled:cursor-default'

/** How many boxes the emailed code has (the API's answers don't say). */
const CODE_LENGTH = 6
const STEPS = ['Set PIN', 'Verify Email']

/**
 * **Set your security PIN** — the whole screen, shown instead of the app while the backend says the
 * signed-in person must set a PIN (`pin_change_required`, from signing in or `GET /auth/me`). No
 * page is drawn behind it, and the only other way out is to sign out. First the PIN: its length
 * (4 or 6 digits), then the PIN twice. Then a code is emailed, and the code and PIN are sent
 * together — the API has one call that checks the code and sets the PIN. Once it is accepted,
 * Continue opens the app.
 */
export function RequiredPinScreen() {
  const { user, logout, pinChangeDone } = useAuth()
  const pin = useSecurityPin()
  const formId = useId()
  const now = useNow()
  const [step, setStep] = useState<'pin' | 'code'>('pin')
  const [length, setLength] = useState(0)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [sent, setSent] = useState<PinCodeSent | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [resendAt, setResendAt] = useState<number | null>(null)
  const [code, setCode] = useState('')
  /** The backend's words once the PIN is set; null until then. */
  const [done, setDone] = useState<string | null>(null)

  if (!user) return null
  const userId = user.id
  const email = user.email ?? ''

  const expiresIn = secondsUntil(expiresAt, now)
  const resendIn = secondsUntil(resendAt, now) ?? 0
  const busy = pin.isRequesting || pin.isVerifying
  const codeReady = code.length === CODE_LENGTH

  async function sendCode() {
    if (pin.isRequesting) return
    try {
      const answer = await pin.requestCode({ action: 'change', user_id: userId })
      setSent(answer)
      setExpiresAt(deadline(answer.expiresInSeconds))
      setResendAt(deadline(answer.resendAfterSeconds))
      setCode('')
      pin.clearVerifyError()
      setStep('code')
    } catch {
      // The backend's message is shown on the screen.
    }
  }

  async function save() {
    if (pin.isVerifying) return
    try {
      const result = await pin.verifyCode({
        action: 'change',
        code,
        user_id: userId,
        new_pin: newPin,
      })
      setDone(result.message)
    } catch {
      // The backend's message is shown on the screen.
    }
  }

  function checkPin(): string {
    if (!length) return 'Choose a 4 or 6 digit security PIN'
    if (newPin.length !== length) return `Enter all ${length} digits of the security PIN`
    if (confirmPin.length !== length) return 'Enter the PIN again to confirm it'
    if (confirmPin !== newPin) return "The two PINs don't match"
    return ''
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (step === 'code') {
      if (codeReady) void save()
      return
    }
    const problem = checkPin()
    setPinError(problem)
    if (problem) return
    pin.clearVerifyError()
    // A code that was already sent and still works isn't sent again.
    if (sent && expiresIn !== 0) setStep('code')
    else void sendCode()
  }

  return (
    <main className="bg-page flex min-h-svh flex-col items-center justify-center gap-4 px-4 py-8">
      <div className="bg-bg border-border-strong flex w-full max-w-[460px] flex-col gap-5 border p-5 shadow-[0_24px_60px_rgba(0,0,0,0.12)] sm:p-7">
        <Logo className="self-center" />

        <div className="flex flex-col items-center gap-2 text-center">
          <span
            aria-hidden="true"
            className="bg-accent-tint text-accent flex h-14 w-14 items-center justify-center rounded-full"
          >
            {done !== null ? (
              <CheckIcon width={28} height={28} />
            ) : (
              <ShieldCheckIcon width={28} height={28} />
            )}
          </span>
          <h1 className="text-text m-0 text-[1.25rem] font-bold">
            {done !== null ? 'Security PIN set' : 'Set your security PIN'}
          </h1>
          {done !== null ? (
            <p role="status" className="m-0 text-[0.9rem]">
              {done || 'Your security PIN has been set.'}
            </p>
          ) : (
            <p className="text-text-muted m-0 text-[0.86rem]">
              You need to set your security PIN before you can continue.
            </p>
          )}
        </div>

        {done !== null ? (
          <button type="button" autoFocus onClick={pinChangeDone} className={PRIMARY}>
            Continue
          </button>
        ) : (
          <>
            <div className="border-border border-y py-4">
              <PinSteps steps={STEPS} current={step === 'pin' ? 0 : 1} />
            </div>

            <form
              id={formId}
              onSubmit={submit}
              noValidate
              className="flex flex-col gap-4"
            >
              {step === 'pin' ? (
                <>
                  <PinFields
                    id={`${formId}-pin`}
                    length={length}
                    onLengthChange={(value) => {
                      // Another length starts the PIN again.
                      setLength(value)
                      setNewPin('')
                      setConfirmPin('')
                      setPinError('')
                    }}
                    pin={newPin}
                    onPinChange={(value) => {
                      setNewPin(value)
                      setPinError('')
                    }}
                    confirm={confirmPin}
                    onConfirmChange={(value) => {
                      setConfirmPin(value)
                      setPinError('')
                    }}
                    error={pinError}
                    disabled={busy}
                  />
                  {pin.requestError && (
                    <FormMessage tone="error">{pin.requestError}</FormMessage>
                  )}
                  {pin.isRateLimited && (
                    <button
                      type="button"
                      onClick={() => {
                        const problem = checkPin()
                        setPinError(problem)
                        if (!problem) setStep('code')
                      }}
                      className={`${LINK} self-center`}
                    >
                      I already have a code
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="m-0 text-center text-[0.86rem]">
                    {sent
                      ? "We've sent a verification code to "
                      : 'Enter the code sent to '}
                    <strong className="text-text break-all">
                      {email || sent?.sentTo || 'your email address'}
                    </strong>
                  </p>
                  <div className="mx-auto w-full max-w-sm">
                    <OtpInput
                      label="Verification code"
                      length={CODE_LENGTH}
                      value={code}
                      disabled={busy}
                      invalid={Boolean(pin.verifyError)}
                      onChange={(value) => {
                        setCode(value)
                        pin.clearVerifyError()
                      }}
                    />
                  </div>
                  {expiresIn !== null && (
                    <p className="m-0 flex items-center justify-center gap-1.5 text-[0.82rem]">
                      <ClockIcon width={15} height={15} />
                      {expiresIn > 0 ? (
                        <>
                          Code expires in
                          <strong className="text-accent tabular-nums">
                            {clock(expiresIn)}
                          </strong>
                        </>
                      ) : (
                        'This code has expired. Send a new one.'
                      )}
                    </p>
                  )}
                  <p className="m-0 flex flex-wrap items-center justify-center gap-x-2 text-[0.82rem]">
                    Didn&apos;t get the code?
                    <button
                      type="button"
                      disabled={resendIn > 0 || busy}
                      onClick={() => void sendCode()}
                      className={`${LINK} tabular-nums`}
                    >
                      {resendIn > 0 ? `Resend in ${clock(resendIn)}` : 'Resend code'}
                    </button>
                  </p>
                  {pin.requestError && (
                    <FormMessage tone="error">{pin.requestError}</FormMessage>
                  )}
                  {pin.verifyError && (
                    <FormMessage tone="error">{pin.verifyError}</FormMessage>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={busy || (step === 'code' && !codeReady)}
                className={PRIMARY}
              >
                {busy ? (
                  <SpinnerIcon width={16} height={16} className="animate-spin" />
                ) : (
                  <LockIcon width={16} height={16} />
                )}
                {step === 'pin'
                  ? pin.isRequesting
                    ? 'Sending code…'
                    : 'Continue'
                  : pin.isVerifying
                    ? 'Saving…'
                    : 'Verify and set PIN'}
              </button>
              {step === 'code' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    pin.clearVerifyError()
                    setStep('pin')
                  }}
                  className={`${LINK} self-center`}
                >
                  <ArrowLeftIcon width={15} height={15} />
                  Back to PIN
                </button>
              )}
            </form>
          </>
        )}
      </div>

      {done === null && (
        <button type="button" disabled={busy} onClick={logout} className={LINK}>
          Sign out
        </button>
      )}
    </main>
  )
}
