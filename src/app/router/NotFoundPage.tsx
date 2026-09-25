import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-text-muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="text-accent font-medium hover:underline">
        Go back home
      </Link>
    </div>
  )
}
