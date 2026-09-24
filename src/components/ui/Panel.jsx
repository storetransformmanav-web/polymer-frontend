import './Panel.css'

/**
 * A titled section wrapper (icon + heading, optional description) used
 * to group related content — e.g. a row of StatCards on a dashboard.
 */
export function Panel({ icon: Icon, title, description, children }) {
  return (
    <section className="panel">
      <div className="panel__header">
        {Icon && (
          <span className="panel__icon">
            <Icon />
          </span>
        )}
        <div>
          <h2 className="panel__title">{title}</h2>
          {description && <p className="panel__description">{description}</p>}
        </div>
      </div>
      <div className="panel__body">{children}</div>
    </section>
  )
}
