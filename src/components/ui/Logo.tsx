import logoSrc from '../../assets/logo.avif'

export interface LogoProps {
  className?: string
}

/**
 * The Polymer brand mark. The image itself already contains the
 * wordmark ("Packaging by Polymer"), so this never renders extra text
 * next to it — just the image, scaled to fit its container.
 */
export function Logo({ className = '' }: LogoProps) {
  return (
    <img
      src={logoSrc}
      alt="Polymer"
      className={`block h-auto w-[132px] max-w-full object-contain ${className}`.trim()}
    />
  )
}
