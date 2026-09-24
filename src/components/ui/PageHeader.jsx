import './PageHeader.css'

/**
 * Standard heading block for a feature page: title + short description.
 * Generic and reused across features rather than each page rolling
 * its own header markup.
 */
export function PageHeader({ title, description }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  )
}
