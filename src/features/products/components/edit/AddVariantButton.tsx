import { PlusIcon } from '../../../../components/ui/icons.tsx'
import { blankAddedOption, LIMITS, optionCount } from '../../utils/editDraft.ts'
import type { SectionProps } from './fields.tsx'

/**
 * **Add variant**, beside the ✓ Save / ✕ Discard icons of the Variants tab: adds a new variant name
 * (an option: Size, Colour…) with its values, as a card of its own in the Variant options card,
 * which opens with the cursor in its name box.
 */
export function AddVariantButton({
  draft,
  onChange,
}: Pick<SectionProps, 'draft' | 'onChange'>) {
  const full = optionCount(draft) >= LIMITS.options
  return (
    <button
      type="button"
      onClick={() => {
        const index = draft.addedOptions.length
        onChange({ addedOptions: [...draft.addedOptions, blankAddedOption()] })
        setTimeout(
          () => document.getElementById(`added-option-${index}-name`)?.focus(),
          0,
        )
      }}
      disabled={full}
      title={full ? `A product can have at most ${LIMITS.options} options.` : undefined}
      className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-none px-3.5 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
    >
      <PlusIcon width={14} height={14} />
      Add variant
    </button>
  )
}
