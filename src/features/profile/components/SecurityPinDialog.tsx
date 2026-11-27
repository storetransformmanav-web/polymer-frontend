import { useEffect, useId, useState, type FormEvent } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  EyeIcon,
  EyeOffIcon,
  ShieldCheckIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import type { PinAction, PinCodeSent, PinVerified } from '../../../lib/api/endpoints.ts'
import { useSecurityPin } from '../hooks/useSecurityPin.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const PRIMARY = `${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`
const SECONDARY = `${BUTTON} border-border bg-bg text-text hover:border-accent`
const INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-10 w-full min-w-0 rounded-lg border px-3 text-[0.95rem] font-semibold tracking-widest outline-none focus:outline-2'
const LINK =
  'text-accent hover:text-accent-hover cursor-pointer border-none bg-transparent p-0 text-[0.82rem] font-semibold disabled:cursor-default disabled:opacity-60'

/** Request the code → enter it → (change only) the new PIN → (view only) the PIN. */
type Step = 'request' | 'code' | 'pin' | 'shown'

/** Whole seconds as `m:ss`. */
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** The time now, updated every second. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

const deadline = (seconds: number | null) =>
  seconds === null ? null : Date.now() + seconds * 1000

/**
 * The security PIN window. Both **View** and **Edit** start by emailing a one-time code. View:
 * the code is checked and the PIN shows for as long as the backend allows, then the window
 * closes. Edit: after the code comes the new PIN, and both are sent together — the API has one
 * call that checks the code and sets the PIN. A wrong code or a refused PIN shows the backend's
 * own message, and nothing typed is lost. The code lengths, timers, address and messages are all
 * the backend's.
 */
export function SecurityPinDialog({
  action,
  userId,
  onClose,
  onChanged,
}: {
  action: PinAction
  userId: string
  onClose: () => void
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
  const [reveal, setReveal] = useState(false)
  const [shown, setShown] = useState<PinVerified | null>(null)
  const [hideAt, setHideAt] = useState<number | null>(null)

  const secondsTo = (time: number | null) =>
    time === null ? null : Math.max(0, Math.ceil((time - now) / 1000))
  const expiresIn = secondsTo(expiresAt)
  const resendIn = secondsTo(resendAt) ?? 0
  const hideIn = secondsTo(hideAt)
  const busy = pin.isRequesting || pin.isVerifying

  // The PIN may only stay on screen as long as the backend says.
  const timeUp = hideAt !== null && now >= hideAt
  useEffect(() => {
    if (timeUp) onClose()
  }, [timeUp, onClose])

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
      setShown(result)
      setHideAt(deadline(result.showSeconds))
      setCode('')
      setStep('shown')
    } catch {
      // The backend's message is shown in the window.
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (step === 'request') void sendCode()
    else if (step === 'code') {
      if (!code.trim()) return
      if (action === 'change') {
        pin.clearVerifyError()
        setStep('pin')
      } else void verify()
    } else if (step === 'pin' && newPin.trim()) void verify()
  }

  const title = action === 'view' ? 'View security PIN' : 'Change security PIN'
  const primary =
    step === 'request'
      ? {
          label: pin.isRequesting ? 'Sending…' : 'Send code',
          disabled: pin.isRequesting,
        }
      : step === 'code' && action === 'change'
        ? { label: 'Continue', disabled: !code.trim() || busy }
        : step === 'code'
          ? {
              label: pin.isVerifying ? 'Verifying…' : 'Verify',
              disabled: !code.trim() || busy,
            }
          : {
              label: pin.isVerifying ? 'Verifying…' : 'Verify and set PIN',
              disabled: !newPin.trim() || busy,
            }

  return (
    <Dialog
      title={title}
      role="dialog"
      onClose={onClose}
      closeDisabled={busy}
      closeButton
      icon={
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        >
          <ShieldCheckIcon width={20} height={20} />
        </span>
      }
      footer={
        step === 'shown' ? (
          <button type="button" onClick={onClose} className={PRIMARY}>
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={
                step === 'pin'
                  ? () => {
                      pin.clearVerifyError()
                      setStep('code')
                    }
                  : onClose
              }
              className={SECONDARY}
            >
              {step === 'pin' ? 'Back to code' : 'Cancel'}
            </button>
            <button
              type="submit"
              form={formId}
              data-autofocus
              disabled={primary.disabled}
              className={PRIMARY}
            >
              {busy && <SpinnerIcon width={14} height={14} className="animate-spin" />}
              {primary.label}
            </button>
          </>
        )
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-3">
        {step === 'request' && (
          <>
            <p className="text-text m-0">
              {action === 'view'
                ? 'To see your PIN, first request a code by email.'
                : 'To change your PIN, first request a code by email.'}
            </p>
            {pin.requestError && (
              <FormMessage tone="error">{pin.requestError}</FormMessage>
            )}
            {pin.isRateLimited && (
              <button
                type="button"
                onClick={() => setStep('code')}
                className={`${LINK} self-start`}
              >
                I already have a code
              </button>
            )}
          </>
        )}

        {step === 'code' && (
          <>
            {sent && (sent.message || sent.sentTo) && (
              <p className="text-text m-0" role="status">
                {sent.message}
                {sent.sentTo && (
                  <>
                    {sent.message ? ' — ' : 'Sent to '}
                    <strong className="break-all">{sent.sentTo}</strong>
                  </>
                )}
              </p>
            )}
            <label className="text-text flex flex-col gap-1.5 text-[0.82rem] font-semibold">
              Code
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={20}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value)
                  pin.clearVerifyError()
                }}
                className={INPUT}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8rem]">
              <span>
                {expiresIn === null
                  ? ''
                  : expiresIn > 0
                    ? `Code expires in ${clock(expiresIn)}`
                    : 'This code has expired. Send a new one.'}
              </span>
              <button
                type="button"
                disabled={resendIn > 0 || busy}
                onClick={() => void sendCode()}
                className={LINK}
              >
                {resendIn > 0 ? `Resend code in ${clock(resendIn)}` : 'Resend code'}
              </button>
            </div>
            {pin.requestError && (
              <FormMessage tone="error">{pin.requestError}</FormMessage>
            )}
            {pin.verifyError && <FormMessage tone="error">{pin.verifyError}</FormMessage>}
          </>
        )}

        {step === 'pin' && (
          <>
            <label className="text-text flex flex-col gap-1.5 text-[0.82rem] font-semibold">
              New PIN
              <span className="flex items-center gap-2">
                <input
                  autoFocus
                  type={reveal ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={20}
                  value={newPin}
                  onChange={(event) => {
                    setNewPin(event.target.value)
                    pin.clearVerifyError()
                  }}
                  className={INPUT}
                />
                <button
                  type="button"
                  aria-label={reveal ? 'Hide new PIN' : 'Show new PIN'}
                  aria-pressed={reveal}
                  onClick={() => setReveal((value) => !value)}
                  className={`${SECONDARY} w-10 shrink-0 px-0`}
                >
                  {reveal ? (
                    <EyeOffIcon width={16} height={16} />
                  ) : (
                    <EyeIcon width={16} height={16} />
                  )}
                </button>
              </span>
            </label>
            <p className="m-0 text-[0.8rem]">
              Your code is checked when you save the new PIN.
            </p>
            {pin.verifyError && <FormMessage tone="error">{pin.verifyError}</FormMessage>}
          </>
        )}

        {step === 'shown' && shown && (
          <>
            {shown.pin ? (
              <p
                aria-label="Your security PIN"
                className="border-border-strong bg-accent-tint/40 text-text m-0 border p-3 text-center text-2xl font-bold tracking-[0.35em] break-all"
              >
                {shown.pin}
              </p>
            ) : (
              <FormMessage tone="error">
                {`The server did not send a PIN. ${shown.message}`}
              </FormMessage>
            )}
            {hideIn !== null && (
              <p className="m-0 text-center text-[0.8rem]">Closes in {clock(hideIn)}</p>
            )}
            {shown.changeRequired && (
              <p className="text-text m-0 text-[0.82rem] font-semibold">
                This PIN needs to be changed. Close this window and use the Edit button.
              </p>
            )}
          </>
        )}
      </form>
    </Dialog>
  )
}
