import type { ReactNode } from 'react'
import type { CreateDraft } from '../../utils/createDraft.ts'
import type { DraftErrors } from '../../utils/editDraft.ts'

/** What each card of the "Add product" form receives. */
export interface CreateSectionProps {
  draft: CreateDraft
  /** Problems to show (none until a create has been attempted). */
  errors: DraftErrors
  /** Changes some fields of the draft (variants follow when the options change). */
  update: (patch: Partial<CreateDraft>) => void
}

/** A card of the form: a titled box holding related fields. */
export function CreateCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="border-border bg-bg flex min-w-0 flex-col gap-4 rounded-2xl border p-5"
    >
      <div>
        <h3 className="text-[0.95rem] font-semibold">{title}</h3>
        {description && (
          <p className="text-text-muted mt-0.5 text-[0.8rem]">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}
