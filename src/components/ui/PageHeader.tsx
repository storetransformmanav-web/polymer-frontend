export interface PageHeaderProps {
  title: string
  description?: string
}

/**
 * Standard heading block for a feature page: title + short description.
 * Generic and reused across features rather than each page rolling
 * its own header markup.
 */
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header>
      <h1 className="mb-1 text-2xl font-semibold">{title}</h1>
      {description && <p className="text-text-muted">{description}</p>}
    </header>
  )
}
