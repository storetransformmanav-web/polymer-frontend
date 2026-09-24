import './StatCard.css'

/**
 * A single metric tile: icon badge, label, big value, and a short meta
 * line. Generic enough to use for any KPI grid across features.
 */
export function StatCard({ icon: Icon, label, value, meta, tone = 'default' }) {
  return (
    <div className="stat-card">
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        {Icon && (
          <span className={`stat-card__icon stat-card__icon--${tone}`}>
            <Icon />
          </span>
        )}
      </div>
      <span className="stat-card__value">{value}</span>
      {meta && <span className={`stat-card__meta stat-card__meta--${tone}`}>{meta}</span>}
    </div>
  )
}
