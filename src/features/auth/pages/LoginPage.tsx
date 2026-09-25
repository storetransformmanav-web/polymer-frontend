import { Logo } from '../../../components/ui/Logo.tsx'
import { LoginForm } from '../components/LoginForm.tsx'

export function LoginPage() {
  return (
    <div className="bg-bg grid w-full max-w-[420px] grid-cols-1 overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.12)] md:max-w-[900px] md:grid-cols-2">
      <div className="bg-accent-tint border-border flex flex-col justify-between border-b p-6 md:border-r md:border-b-0 md:p-10">
        <Logo />
        <div className="border-border border-t pt-5">
          <p className="text-accent mb-1.5 text-[0.72rem] font-bold tracking-widest uppercase">
            Customer Relationship Portal
          </p>
          <p className="text-text-muted text-[0.9rem] leading-normal">
            Streamlining orders, products and inventory in one place.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center p-6 md:p-10">
        <h1 className="mb-1.5 text-[1.6rem] font-semibold">Welcome back</h1>
        <p className="text-text-muted mb-7">Sign in to Polymer CRM</p>
        <LoginForm />
      </div>
    </div>
  )
}
