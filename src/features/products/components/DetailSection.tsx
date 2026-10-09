import { useId, useState, type ComponentType, type ReactNode } from 'react'
import { ChevronDownIcon, type IconProps } from '../../../components/ui/icons.tsx'

interface DetailSectionProps {
  title: string
  count?: number
  icon: ComponentType<IconProps>
  defaultOpen?: boolean
  children: ReactNode
}

/** Collapsible card used for each group of product information. */
export function DetailSection({
  title,
  count,
  icon: Icon,
  defaultOpen = true,
  children,
}: DetailSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()

  return (
    <section className="border-border bg-bg rounded-xl border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="text-text flex w-full cursor-pointer items-center gap-2.5 border-none bg-transparent px-5 py-4 text-left"
      >
        <Icon width={18} height={18} className="text-accent shrink-0" />
        <h3 className="text-[0.95rem] font-semibold">{title}</h3>
        {count !== undefined && (
          <span className="bg-surface text-text-muted border-border rounded-full border px-2 py-0.5 text-[0.68rem] font-bold">
            {count}
          </span>
        )}
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-text-muted ml-auto transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        id={bodyId}
        inert={!open}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-border border-t p-5">{children}</div>
        </div>
      </div>
    </section>
  )
}

/** Label + value grid for a DetailSection. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 min-[520px]:grid-cols-2 xl:grid-cols-3">
      {children}
    </dl>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-muted mb-1 text-[0.68rem] font-bold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-[0.92rem] font-medium break-words">
        {children === null || children === undefined || children === '' ? (
          <span className="text-text-muted">—</span>
        ) : (
          children
        )}
      </dd>
    </div>
  )
}
