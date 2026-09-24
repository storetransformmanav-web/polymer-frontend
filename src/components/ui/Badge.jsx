import './Badge.css'

/**
 * Small status pill (order/fulfillment/product status, etc). Generic
 * tone-based coloring, same tone vocabulary as StatCard.
 */
export function Badge({ tone = 'default', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
