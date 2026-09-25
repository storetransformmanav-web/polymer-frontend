import './PageHeader.css'

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
    <header className="page-header">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  )
}
