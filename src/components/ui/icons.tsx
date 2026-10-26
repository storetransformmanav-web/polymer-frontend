import type { SVGProps } from 'react'

/**
 * Small hand-written icon set (stroke-based, 20x20). Kept local instead
 * of adding an icon library dependency for a handful of glyphs — if the
 * app ends up needing many more, that trade-off should be revisited.
 * Never use emoji as icons — add a new SVG here instead.
 */

export type IconProps = SVGProps<SVGSVGElement>

const base: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="11" y="2.5" width="6.5" height="9.5" rx="1.2" />
      <rect x="2.5" y="11.5" width="6.5" height="6" rx="1.2" />
      <rect x="11" y="14.5" width="6.5" height="3" rx="1.2" />
    </svg>
  )
}

export function OrdersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h12l-1 11.5a1 1 0 0 1-1 .9H6a1 1 0 0 1-1-.9L4 5Z" />
      <path d="M7 5V3.8A2.3 2.3 0 0 1 9.3 1.5h1.4A2.3 2.3 0 0 1 13 3.8V5" />
      <path d="M7 9h6" />
    </svg>
  )
}

export function ProductsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 2 17.5 6v8L10 18 2.5 14V6Z" />
      <path d="M2.5 6 10 10l7.5-4" />
      <path d="M10 10v8" />
    </svg>
  )
}

export function InventoryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="4" width="15" height="12" rx="1.4" />
      <path d="M2.5 8.5h15" />
      <path d="M7 4v-.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5V4" />
    </svg>
  )
}

export function StoreIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7.5 4.3 3h11.4L17 7.5" />
      <path d="M3 7.5a2.3 2.3 0 0 0 4.7 0 2.3 2.3 0 0 0 4.6 0 2.3 2.3 0 0 0 4.7 0" />
      <path d="M4 10.5V17h12v-6.5" />
      <path d="M8.5 17v-3.5h3V17" />
    </svg>
  )
}

export function ChevronsLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4 6.5 10 12 16" />
      <path d="M8 4 2.5 10 8 16" />
    </svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7.5 5 12.5 10 7.5 15" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  )
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.6" />
      <path d="m3 5.5 7 5.5 7-5.5" />
    </svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="9" width="12" height="8" rx="1.6" />
      <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" />
    </svg>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 10s2.8-5.5 8-5.5S18 10 18 10s-2.8 5.5-8 5.5S2 10 2 10Z" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  )
}

export function EyeOffIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3l14 14" />
      <path d="M9.4 4.6C13.9 4.2 18 10 18 10a13 13 0 0 1-3.1 3.6M6.1 5.9A13.5 13.5 0 0 0 2 10s3.6 5.5 8 5.5c1.2 0 2.3-.3 3.3-.8" />
      <path d="M8.1 8.1a2.3 2.3 0 0 0 3.2 3.3" />
    </svg>
  )
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 17H4.5A1.5 1.5 0 0 1 3 15.5v-11A1.5 1.5 0 0 1 4.5 3H8" />
      <path d="M13 14l4-4-4-4" />
      <path d="M17 10H7.5" />
    </svg>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="7.5" cy="6.5" r="3" />
      <path d="M2 17c.4-3.2 2.7-5 5.5-5s5.1 1.8 5.5 5" />
      <path d="M13 3.8a3 3 0 0 1 0 5.4" />
      <path d="M14.5 12.3c1.8.5 3.2 2 3.5 4.7" />
    </svg>
  )
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 17.5s5.5-4.7 5.5-9A5.5 5.5 0 0 0 4.5 8.5c0 4.3 5.5 9 5.5 9Z" />
      <circle cx="10" cy="8.5" r="2" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.2 13.2 3.8 3.8" />
    </svg>
  )
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6h7M14 6h3M3 14h3M10 14h7" />
      <circle cx="12" cy="6" r="1.8" />
      <circle cx="8" cy="14" r="1.8" />
    </svg>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="7" y="7" width="9.5" height="9.5" rx="1.6" />
      <path d="M13 7V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v6.5A1.5 1.5 0 0 0 5 13h2" />
    </svg>
  )
}

export function HistoryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 10a7 7 0 1 0 2.1-5" />
      <path d="M3 3.8V6.5h2.7" />
      <path d="M10 6.5V10l2.4 1.5" />
    </svg>
  )
}

export function TagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.8 10.4V3.8a1 1 0 0 1 1-1h6.6l6.8 6.8a1 1 0 0 1 0 1.4l-5.2 5.2a1 1 0 0 1-1.4 0Z" />
      <circle cx="6.8" cy="6.8" r="1.1" />
    </svg>
  )
}

export function ArrowUpDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 16.5v-13M3.5 6.5l3-3 3 3" />
      <path d="M13.5 3.5v13M10.5 13.5l3 3 3-3" />
    </svg>
  )
}

export function BoxesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="10" width="7" height="7" rx="1.2" />
      <rect x="10.5" y="10" width="7" height="7" rx="1.2" />
      <rect x="6.5" y="3" width="7" height="7" rx="1.2" />
    </svg>
  )
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m10 2.5 7.5 4-7.5 4-7.5-4Z" />
      <path d="m2.5 10 7.5 4 7.5-4" />
      <path d="m2.5 13.5 7.5 4 7.5-4" />
    </svg>
  )
}

export function ListChecksIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m3 5 1.6 1.6L7.5 3.7" />
      <path d="m3 12 1.6 1.6L7.5 10.7" />
      <path d="M10.5 5h6.5M10.5 12h6.5M10.5 16h6.5M10.5 8.5h3" />
    </svg>
  )
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M11.5 3H17v5.5" />
      <path d="M17 3 9.5 10.5" />
      <path d="M15 11.5V15a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 15V7a1.5 1.5 0 0 1 1.5-1.5H9" />
    </svg>
  )
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.6" />
      <circle cx="7" cy="8" r="1.4" />
      <path d="m3 15 4.5-4.5 3 3 2-2L17 15.5" />
    </svg>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 10H4.5" />
      <path d="M9.5 5 4.5 10l5 5" />
    </svg>
  )
}

/** Indeterminate spinner — pair with Tailwind's `animate-spin`. */
export function SpinnerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 2.5a7.5 7.5 0 1 0 7.5 7.5" />
    </svg>
  )
}

export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.55-1.84.87-3.06.87-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.95a9 9 0 0 0 0 8.08l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.47.99 11.43.18 9 .18a9 9 0 0 0-8.05 4.78l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 5.8V10l3 2" />
    </svg>
  )
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 3 18 16.5H2Z" />
      <path d="M10 8v3.5" />
      <path d="M10 14.2v.1" />
    </svg>
  )
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="m6.5 10 2.3 2.3L13.8 7.6" />
    </svg>
  )
}

/** A solid circle (the current colour) with a contrasting ✕ — for "out of stock" style states. */
export function XCircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="8" fill="currentColor" stroke="none" />
      <path
        d="m7.2 7.2 5.6 5.6M12.8 7.2l-5.6 5.6"
        strokeWidth={1.8}
        style={{ stroke: 'var(--color-accent-contrast)' }}
      />
    </svg>
  )
}

export function DollarSignIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 2.5v15" />
      <path d="M13.5 5.8c0-1.3-1.6-2.3-3.5-2.3s-3.5 1-3.5 2.3S8 8 10 8s3.5 1 3.5 2.3-1.6 2.4-3.5 2.4-3.5-1-3.5-2.4" />
    </svg>
  )
}

export function PoundIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13.5 5.5c-.5-1.3-1.8-2-3.2-2-2 0-3.3 1.4-3.3 3.3v3.4" />
      <path d="M4.5 10.2h7" />
      <path d="M7 10.2v2.4c0 1.6-.7 2.8-2 3.9h10" />
    </svg>
  )
}

export function FilterIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 4h14l-5.5 6.5v5L8.5 17v-6.5Z" />
    </svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="14" height="13" rx="1.6" />
      <path d="M3 8h14" />
      <path d="M7 2.5V5.5M13 2.5V5.5" />
    </svg>
  )
}

export function ActivityIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 10h3.2l2.1-5.6 3.4 11.2L12.8 10H18" />
    </svg>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6" />
      <path d="M16.5 3.5v3.2h-3.2" />
    </svg>
  )
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12.9 3.6a1.7 1.7 0 0 1 2.4 0l1.1 1.1a1.7 1.7 0 0 1 0 2.4L7.6 15.9l-3.9.9.9-3.9 8.3-9.3Z" />
      <path d="m11.4 5.2 3.4 3.4" />
    </svg>
  )
}

export function ColumnsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M8 4v12M12.5 4v12" />
    </svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 5.5h13" />
      <path d="M7.5 5.5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
      <path d="m5 5.5.8 10a1.2 1.2 0 0 0 1.2 1.1h6a1.2 1.2 0 0 0 1.2-1.1l.8-10" />
      <path d="M8.5 9v4.5M11.5 9v4.5" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="m4.5 10.5 3.6 3.6 7.4-8" />
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  )
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" />
    </svg>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M17 11.8A7.2 7.2 0 0 1 8.2 3a7.2 7.2 0 1 0 8.8 8.8Z" />
    </svg>
  )
}

export function MonitorIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.4" />
      <path d="M7 17h6M10 13.5V17" />
    </svg>
  )
}

export function UserCogIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="6.5" r="3" />
      <path d="M2.8 17c.6-3 3-5 6.2-5" />
      <circle cx="15" cy="14.5" r="2.3" />
      <path d="M15 10.8v1M15 17.2v1M18.2 12.4l-.9.5M11.8 16.1l-.9.5M18.2 16.6l-.9-.5M11.8 12.9l-.9-.5" />
    </svg>
  )
}

// --- Rich-text editor toolbar -------------------------------------------------

export function BoldIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={2} {...props}>
      <path d="M6 4h4.5a3 3 0 0 1 0 6H6zM6 10h5.5a3 3 0 0 1 0 6H6z" />
    </svg>
  )
}

export function ItalicIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4h6M6 16h6M11.5 4 8.5 16" />
    </svg>
  )
}

export function UnderlineIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5v6a4 4 0 0 0 8 0v-6M4.5 17h11" />
    </svg>
  )
}

export function TextColorIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m5.5 13.5 4.5-10 4.5 10M7.2 10h5.6M4.5 17h11" />
    </svg>
  )
}

export function AlignLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h12M4 9h8M4 13h12M4 17h8" />
    </svg>
  )
}

export function AlignCenterIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h12M6 9h8M4 13h12M6 17h8" />
    </svg>
  )
}

export function AlignRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h12M8 9h8M4 13h12M8 17h8" />
    </svg>
  )
}

export function AlignJustifyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h12M4 9h12M4 13h12M4 17h12" />
    </svg>
  )
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.8-2.8a3 3 0 0 0-4.2-4.2l-.9.9" />
      <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-2.8 2.8a3 3 0 0 0 4.2 4.2l.9-.9" />
    </svg>
  )
}

export function VideoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="m8.5 7 4 3-4 3z" />
    </svg>
  )
}

export function TableIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M3 8.5h14M3 12.5h14M8 4v12M12.5 4v12" />
    </svg>
  )
}

export function BulletListIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 5.5h8M8 10h8M8 14.5h8" />
      <circle cx="4.5" cy="5.5" r=".6" />
      <circle cx="4.5" cy="10" r=".6" />
      <circle cx="4.5" cy="14.5" r=".6" />
    </svg>
  )
}

export function OrderedListIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 5.5h7.5M8.5 10h7.5M8.5 14.5h7.5" />
      <path d="M3.5 4.5 5 4v3M3.5 9.2c.6-.9 2-.5 1.9.4-.1.6-1.2 1-1.9 1.6h2M3.4 13.6h1.6l-1 1.2c.8-.2 1.2.3 1.1.8-.2.7-1.2.8-1.8.3" />
    </svg>
  )
}

export function IndentIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4.5h12M9 8.5h7M9 12.5h7M4 16.5h12M4 8l2.5 2.5L4 13" />
    </svg>
  )
}

export function OutdentIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4.5h12M9 8.5h7M9 12.5h7M4 16.5h12M6.5 8 4 10.5 6.5 13" />
    </svg>
  )
}

export function ClearFormattingIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="m5.4 14.6 9.2-9.2" />
    </svg>
  )
}

export function CodeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m7 6-4 4 4 4M13 6l4 4-4 4M11.2 4.5 8.8 15.5" />
    </svg>
  )
}

export function PlusCircleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6.5v7M6.5 10h7" />
    </svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 3v9.5M6.5 9.5 10 13l3.5-3.5M3.5 14.5v1.2a1.3 1.3 0 0 0 1.3 1.3h10.4a1.3 1.3 0 0 0 1.3-1.3v-1.2" />
    </svg>
  )
}

/** A stack of discs: data / a database. */
export function DatabaseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="10" cy="5" rx="6" ry="2.5" />
      <path d="M4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5" />
    </svg>
  )
}

/** A spreadsheet file (Excel): a tile with a cross-through "X". Filled, 32px. */
export function ExcelFileIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} aria-hidden="true" {...props}>
      <rect
        x="5"
        y="3"
        width="22"
        height="26"
        rx="3.5"
        fill="currentColor"
        opacity="0.16"
      />
      <rect x="2" y="9" width="17" height="17" rx="3.5" fill="currentColor" />
      <path
        d="m7.3 14.8 6.4 6.4m0-6.4-6.4 6.4"
        fill="none"
        stroke="var(--color-accent-contrast)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M22 10h3M22 14.5h3M22 19h3M22 23.5h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** A text/CSV file: a page with a folded corner and "CSV" on it. Filled, 32px. */
export function CsvFileIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} aria-hidden="true" {...props}>
      <path
        d="M9 3h10.5L26 9.5V27a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path d="M19.5 3v5a1.5 1.5 0 0 0 1.5 1.5h5" fill="currentColor" opacity="0.35" />
      <text
        x="16.5"
        y="23.5"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="inherit"
        fill="currentColor"
      >
        CSV
      </text>
    </svg>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v4.5" />
      <path d="M10 6.5h.01" />
    </svg>
  )
}
