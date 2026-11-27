import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  ArrowLeftIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import { OtpInput } from '../../../components/ui/OtpInput.tsx'
import type { PinAction, PinCodeSent } from '../../../lib/api/endpoints.ts'
import { useNow } from '../hooks/useNow.ts'
import { useSecurityPin } from '../hooks/useSecurityPin.ts'
import { clock, deadline, secondsUntil } from '../utils/clock.ts'
import { PinSteps } from './PinSteps.tsx'
import type { ViewedPin } from './RevealedPin.tsx'

const BUTTON =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.88rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const PRIMARY = `${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`
const SECONDARY = `${BUTTON} border-border bg-bg text-text hover:border-accent`
const INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint aria-[invalid=true]:border-danger h-11 w-full min-w-0 rounded-lg border px-3 text-[0.95rem] font-semibold tracking-widest outline-none focus:outline-2'
const LABEL = 'text-text flex flex-col gap-1.5 text-[0.82rem] font-semibold'
const LINK =
  'text-accent hover:text-accent-hover disabled:text-text-muted cursor-pointer border-none bg-transparent p-0 text-[0.82rem] font-semibold disabled:cursor-default'

/** How many boxes the emailed code has (the API's answers don't say). */
const CODE_LENGTH = 6

/** Send the code → verify it → (change only) set the new PIN. */
type Step = 'request' | 'code' | 'pin'
const STEP_INDEX: Record<Step, number> = { request: 0, code: 1, pin: 2 }
const VIEW_STEPS = ['Send Code', 'Verify Code']
const CHANGE_STEPS = ['Send Code', 'Verify Code', 'Set PIN']

/** The top of a step: an icon, its heading and a line under it, centred. */
function StepIntro({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span
        aria-hidden="true"
        className="bg-accent-tint text-accent flex h-14 w-14 items-center justify-center rounded-full"
      >
        {icon}
      </span>
      <h3 className="text-text m-0 text-[1.1rem] font-bold">{title}</h3>
      <p className="m-0 text-[0.86rem]">{children}</p>
    </div>
  )
}

/** The address the code goes to, as a pill. */
function EmailPill({ email }: { email: string }) {
  return (
    <p className="bg-accent-tint/60 text-text m-0 flex max-w-full items-center gap-2 self-center rounded-full px-4 py-1.5 text-[0.86rem] font-semibold">
      <MailIcon width={16} height={16} className="text-accent shrink-0" />
      <span className="min-w-0 break-all">{email}</span>
    </p>
  )
}

/**
 * The security PIN window, in steps. **View** and **Edit** both start by emailing a one-time code
 * (Send Code) and entering it in six boxes (Verify Code). View: the code is checked, the window
 * closes and the PIN shows on the profile page. Edit: a third step takes the new PIN twice, and
 * the code and PIN are sent together — the API has one call that checks the code and sets the PIN.
 * A wrong code or a refused PIN shows the backend's own message, and nothing typed is lost. The
 * timers and the error messages are the backend's.
 */
export function SecurityPinDialog({
  action,
  userId,
  email,
  onClose,
  onViewed,
  onChanged,
}: {
  action: PinAction
  userId: string
  /** The profile's email address, shown before the code is sent. */
  email: string
  onClose: () => void
  /** The code was right (view): the page shows the PIN. */
  onViewed: (viewed: ViewedPin) => void
  /** The new PIN was set; `message` is the backend's own words (may be empty). */
  onChanged: (message: string) => void
}) {
  const pin = useSecurityPin()
  const formId = useId()
  const now = useNow()
  const [step, setStep] = useState<Step>('request')
  const [sent, setSent] = useState<PinCodeSent | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [resendAt, setResendAt] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [reveal, setReveal] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  /** A verified answer that carried no PIN: said in the window instead of closing it. */
  const [noPin, setNoPin] = useState<string | null>(null)

  const expiresIn = secondsUntil(expiresAt, now)
  const resendIn = secondsUntil(resendAt, now) ?? 0
  const busy = pin.isRequesting || pin.isVerifying
  const codeReady = code.length === CODE_LENGTH
  const pinsReady = newPin.trim() !== '' && confirmPin.trim() !== ''

  async function sendCode() {
    if (pin.isRequesting) return
    try {
      const answer = await pin.requestCode({ action, user_id: userId })
      setSent(answer)
      setExpiresAt(deadline(answer.expiresInSeconds))
      setResendAt(deadline(answer.resendAfterSeconds))
      setCode('')
      pin.clearVerifyError()
      setStep('code')
    } catch {
      // The backend's message is shown in the window.
    }
  }

  async function verify() {
    if (pin.isVerifying) return
    try {
      const result = await pin.verifyCode({
        action,
        code: code.trim(),
        user_id: userId,
        ...(action === 'change' ? { new_pin: newPin.trim() } : {}),
      })
      if (action === 'change') {
        onChanged(result.message)
        return
      }
      setCode('')
      if (!result.pin) {
        setNoPin(`The server did not send a PIN. ${result.message}`.trim())
        return
      }
      onViewed({
        pin: result.pin,
        hideAt: deadline(result.showSeconds),
        changeRequired: result.changeRequired,
      })
    } catch {
      // The backend's message is shown in the window.
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (step === 'request') void sendCode()
    else if (step === 'code') {
      if (!codeReady) return
      setNoPin(null)
      if (action === 'change') {
        pin.clearVerifyError()
        setStep('pin')
      } else void verify()
    } else if (pinsReady) {
      if (newPin.trim() !== confirmPin.trim()) {
        setMismatch(true)
        return
      }
      void verify()
    }
  }

  function back() {
    pin.clearVerifyError()
    setMismatch(false)
    setStep(step === 'pin' ? 'code' : 'request')
  }

  const title = action === 'view' ? 'View security PIN' : 'Change security PIN'
  const primary =
    step === 'request'
      ? {
          label: pin.isRequesting ? 'Sending…' : 'Send code',
          icon: <MailIcon width={16} height={16} />,
          disabled: busy,
        }
      : step === 'code'
        ? {
            label:
              action === 'change'
                ? 'Continue'
                : pin.isVerifying
                  ? 'Verifying…'
                  : 'Verify code',
            icon: <ShieldCheckIcon width={16} height={16} />,
            disabled: !codeReady || busy,
          }
        : {
            label: pin.isVerifying ? 'Saving…' : 'Verify and set PIN',
            icon: <LockIcon width={16} height={16} />,
            disabled: !pinsReady || busy,
          }

  const secretType = reveal ? 'text' : 'password'

  return (
    <Dialog
      title={title}
      role="dialog"
      onClose={onClose}
      closeDisabled={busy}
      closeButton
      footer={
        <div className="flex w-full flex-col items-center gap-3">
          <button
            type="submit"
            form={formId}
            data-autofocus
            disabled={primary.disabled}
            className={`${PRIMARY} w-full`}
          >
            {busy ? (
              <SpinnerIcon width={16} height={16} className="animate-spin" />
            ) : (
              primary.icon
            )}
            {primary.label}
          </button>
          {step === 'request' ? (
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className={`${SECONDARY} w-full`}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={back}
              className={`${LINK} inline-flex items-center gap-1.5`}
            >
              <ArrowLeftIcon width={15} height={15} />
              Back
            </button>
          )}
        </div>
      }
    >
      <div className="border-border border-b pb-4">
        <PinSteps
          steps={action === 'view' ? VIEW_STEPS : CHANGE_STEPS}
          current={STEP_INDEX[step]}
        />
      </div>

      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        {step === 'request' && (
          <>
            <StepIntro
              icon={<MailIcon width={26} height={26} />}
              title="Send a verification code"
            >
              {action === 'view'
                ? 'To see your PIN, we first email you a code.'
                : 'To change your PIN, we first email you a code.'}
            </StepIntro>
            {email && <EmailPill email={email} />}
            {pin.requestError && (
              <FormMessage tone="error">{pin.requestError}</FormMessage>
            )}
            {pin.isRateLimited && (
              <button
                type="button"
                onClick={() => setStep('code')}
                className={`${LINK} self-center`}
              >
                I already have a code
              </button>
            )}
          </>
        )}

        {step === 'code' && (
          <>
            <StepIntro
              icon={<ShieldCheckIcon width={26} height={26} />}
              title="Verify your email"
            >
              {sent
                ? "We've sent a verification code to"
                : 'Enter the code from the email.'}
            </StepIntro>
            {/* The address appears once: the person's own, in full (the backend's message and
                `sent_to` would only repeat it, partly hidden). */}
            {sent && (email || sent.sentTo) && <EmailPill email={email || sent.sentTo} />}
            <div className="mx-auto w-full max-w-sm">
              <OtpInput
                label="Verification code"
                length={CODE_LENGTH}
                value={code}
                disabled={busy}
                invalid={Boolean(pin.verifyError)}
                onChange={(value) => {
                  setCode(value)
                  setNoPin(null)
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
            {pin.verifyError && <FormMessage tone="error">{pin.verifyError}</FormMessage>}
            {noPin && <FormMessage tone="error">{noPin}</FormMessage>}
          </>
        )}

        {step === 'pin' && (
          <>
            <StepIntro
              icon={<LockIcon width={26} height={26} />}
              title="Set your new PIN"
            >
              Enter it twice. Your code is checked when you save.
            </StepIntro>
            <label className={LABEL}>
              New PIN
              <input
                autoFocus
                type={secretType}
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={20}
                value={newPin}
                onChange={(event) => {
                  setNewPin(event.target.value)
                  setMismatch(false)
                  pin.clearVerifyError()
                }}
                className={INPUT}
              />
            </label>
            <label className={LABEL}>
              Confirm new PIN
              <input
                type={secretType}
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={20}
                value={confirmPin}
                aria-invalid={mismatch ? true : undefined}
                onChange={(event) => {
                  setConfirmPin(event.target.value)
                  setMismatch(false)
                  pin.clearVerifyError()
                }}
                className={INPUT}
              />
            </label>
            <button
              type="button"
              aria-pressed={reveal}
              onClick={() => setReveal((value) => !value)}
              className={`${LINK} inline-flex items-center gap-1.5 self-start`}
            >
              {reveal ? (
                <EyeOffIcon width={15} height={15} />
              ) : (
                <EyeIcon width={15} height={15} />
              )}
              {reveal ? 'Hide PINs' : 'Show PINs'}
            </button>
            {mismatch && (
              <FormMessage tone="error">The two PINs don&apos;t match.</FormMessage>
            )}
            {pin.verifyError && <FormMessage tone="error">{pin.verifyError}</FormMessage>}
          </>
        )}
      </form>
    </Dialog>
  )
}
