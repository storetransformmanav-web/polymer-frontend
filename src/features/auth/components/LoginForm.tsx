import { useLogin } from '../hooks/useLogin.ts'
import { EmailStep } from './EmailStep.tsx'
import { OtpStep } from './OtpStep.tsx'

/**
 * Passwordless login: the email step requests a code, the OTP step
 * verifies it. The current step lives in the `auth` Redux slice (see
 * `useLogin`); `key` remounts each step so it fades in via the
 * `starting:` classes instead of snapping.
 */
export function LoginForm() {
  const { step } = useLogin()

  return (
    <div
      key={step}
      className="transition-all duration-300 ease-out motion-reduce:transition-none starting:translate-y-2 starting:opacity-0"
    >
      {step === 'email' ? <EmailStep /> : <OtpStep />}
    </div>
  )
}
