import { LoginForm } from '../components/LoginForm.jsx'
import './LoginPage.css'

export function LoginPage() {
  return (
    <div className="login-page">
      <h1>Sign in to Polymer CRM</h1>
      <LoginForm />
    </div>
  )
}
