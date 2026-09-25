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
    <div className="px-6 py-12 text-center">
      <h1 className="mb-3 text-2xl font-semibold">{title}</h1>
      <p className="bg-accent-tint text-accent mb-4 inline-block rounded-full px-3 py-1 text-[0.8rem] font-semibold tracking-wide uppercase">
        Coming soon
      </p>
      <p className="text-text-muted">This page isn't built yet — check back later.</p>
    </div>
  )
}
