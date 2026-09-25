import './ComingSoon.css'

export interface ComingSoonProps {
  title: string
}

/**
 * Generic placeholder for a page/feature that isn't built yet. Reused
 * across features rather than each one re-implementing its own
 * "coming soon" markup.
 */
export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="coming-soon">
      <h1>{title}</h1>
      <p className="coming-soon__badge">Coming soon</p>
      <p>This page isn't built yet — check back later.</p>
    </div>
  )
}
