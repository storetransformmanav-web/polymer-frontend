import { useId, useState } from 'react'
import { ChevronDownIcon } from '../../../components/ui/icons.tsx'
import { SafeHtml } from '../../../components/ui/SafeHtml.tsx'
import type { DescriptionSections } from '../utils/descriptionSections.ts'

/**
 * The product's description sections (Product Description, Product Information…) as
 * an accordion: one bordered row per section with its title, opening to show the
 * section's text. All start closed. When the store's setting says only one section
 * stays open at a time (`multi` false), opening one closes the others.
 */
export function DescriptionAccordion({ sections, multi }: DescriptionSections) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set())
  const base = useId()

  function toggle(index: number) {
    setOpen((current) => {
      const next = new Set(multi ? current : [])
      if (current.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <div className="border-border divide-border bg-bg divide-y overflow-hidden rounded-xl border">
      {sections.map((section, index) => {
        const isOpen = open.has(index)
        const bodyId = `${base}-${index}`
        return (
          <div key={`${section.title}-${index}`}>
            <h4 className="m-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => toggle(index)}
                className="hover:bg-surface focus-visible:outline-accent flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-3.5 text-left text-[0.95rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                {section.title}
                <ChevronDownIcon
                  width={16}
                  height={16}
                  className={`text-text-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </h4>
            {isOpen && (
              <div
                id={bodyId}
                role="region"
                aria-label={section.title}
                className="text-text px-4 pt-1 pb-4 text-[0.9rem] leading-relaxed"
              >
                {section.content.trim() ? (
                  <SafeHtml html={section.content} />
                ) : (
                  <p className="text-text-muted">Nothing in this section.</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
