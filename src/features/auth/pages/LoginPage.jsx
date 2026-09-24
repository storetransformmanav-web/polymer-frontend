import { Logo } from '../../../components/ui/Logo.jsx'
import { LoginForm } from '../components/LoginForm.jsx'
import './LoginPage.css'

export function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-page__brand">
        <Logo />
        <div className="login-page__brand-copy">
          <p className="login-page__eyebrow">Customer Relationship Portal</p>
          <p className="login-page__tagline">
            Streamlining orders, products and inventory in one place.
          </p>
        </div>
      </div>

      <div className="login-page__form">
        <h1>Welcome back</h1>
        <p className="login-page__subtitle">Sign in to Polymer CRM</p>
        <LoginForm />
      </div>
    </div>
  )
}
