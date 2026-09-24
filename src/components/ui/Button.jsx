import './Button.css'

/**
 * Generic, unstyled-by-feature button primitive. This is the kind of
 * component that belongs in `components/ui`: no knowledge of any
 * specific feature, reused across the app.
 */
export function Button({ variant = 'primary', className = '', ...props }) {
  return <button className={`btn btn--${variant} ${className}`.trim()} {...props} />
}
