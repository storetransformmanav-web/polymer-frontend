import { PlusIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { blankAddedOption, LIMITS, optionCount } from '../../utils/editDraft.ts'
import {
  EditField,
  FIELD_INPUT,
  ICON_BUTTON,
  TEXT_BUTTON,
  type SectionProps,
} from './fields.tsx'
import { TagsInput } from './TagsSection.tsx'

/**
 * The product's options (Size, Colour…) in the Variants editor: rename an option or any of its
 * values (`options_update`), and add a new option with its values (`options_add`). A new option
 * only gives the variants that are added in the same edit a value to choose; the variants already
 * there are not changed by it.
 */
export function VariantOptionsEditor({ draft, errors, onChange }: SectionProps) {
  const full = optionCount(draft) >= LIMITS.options

  const renameOption = (index: number, newName: string) =>
    onChange({
      options: draft.options.map((option, i) =>
        i === index ? { ...option, newName } : option,
      ),
    })
  const renameValue = (index: number, valueIndex: number, to: string) =>
    onChange({
      options: draft.options.map((option, i) =>
        i === index
          ? {
              ...option,
              values: option.values.map((value, j) =>
                j === valueIndex ? { ...value, to } : value,
              ),
            }
          : option,
      ),
    })
  const patchAdded = (index: number, patch: { name?: string; values?: string[] }) =>
    onChange({
      addedOptions: draft.addedOptions.map((option, i) =>
        i === index ? { ...option, ...patch } : option,
      ),
    })

  return (
    <section
      aria-label="Options"
      className="border-border flex flex-col gap-4 rounded-xl border p-4"
    >
      <div>
        <h3 className="text-[0.95rem] font-semibold">Options</h3>
        <p className="text-text-muted text-[0.78rem]">
          Rename an option or one of its values, or add an option. Variants are added
          below.
        </p>
      </div>

      {draft.options.map((option, index) => (
        <div key={option.key} className="flex flex-col gap-2.5">
          <EditField
            id={`option-${index}-name`}
            label={`Option name (now “${option.name}”)`}
            error={errors[`options.${index}.name`]}
          >
            <input
              id={`option-${index}-name`}
              autoComplete="off"
              value={option.newName}
              maxLength={LIMITS.optionName}
              aria-invalid={errors[`options.${index}.name`] ? true : undefined}
              onChange={(event) => renameOption(index, event.target.value)}
              className={FIELD_INPUT}
            />
          </EditField>
          <ul
            aria-label={`${option.name} values`}
            className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3"
          >
            {option.values.map((value, valueIndex) => {
              const error = errors[`options.${index}.values.${valueIndex}`]
              return (
                <li key={value.from} className="flex flex-col gap-1">
                  <input
                    aria-label={`Value “${value.from}” of ${option.name}`}
                    autoComplete="off"
                    value={value.to}
                    maxLength={LIMITS.optionValue}
                    aria-invalid={error ? true : undefined}
                    onChange={(event) =>
                      renameValue(index, valueIndex, event.target.value)
                    }
                    className={FIELD_INPUT}
                  />
                  {error && (
                    <p role="alert" className="text-danger text-[0.76rem]">
                      {error}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {draft.addedOptions.map((option, index) => (
        <div
          key={option.key}
          className="border-border flex flex-col gap-2.5 rounded-lg border border-dashed p-3"
        >
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <EditField
                id={`added-option-${index}-name`}
                label="New option name"
                error={errors[`addedOptions.${index}.name`]}
              >
                <input
                  id={`added-option-${index}-name`}
                  autoComplete="off"
                  value={option.name}
                  maxLength={LIMITS.optionName}
                  placeholder="e.g. Colour"
                  aria-invalid={errors[`addedOptions.${index}.name`] ? true : undefined}
                  onChange={(event) => patchAdded(index, { name: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
            </div>
            <button
              type="button"
              aria-label={`Remove new option ${option.name || index + 1}`}
              onClick={() =>
                onChange({
                  addedOptions: draft.addedOptions.filter((_, i) => i !== index),
                })
              }
              className={`${ICON_BUTTON} hover:text-danger mb-1`}
            >
              <TrashIcon width={16} height={16} />
            </button>
          </div>
          <TagsInput
            id={`added-option-${index}-values`}
            ariaLabel={`Values of ${option.name || 'the new option'}`}
            listLabel="Values"
            removeLabel={(value) => `Remove value ${value}`}
            placeholder="Type a value and press Enter"
            tags={option.values}
            onChange={(values) => patchAdded(index, { values })}
          />
          {errors[`addedOptions.${index}.values`] && (
            <p role="alert" className="text-danger text-[0.78rem]">
              {errors[`addedOptions.${index}.values`]}
            </p>
          )}
        </div>
      ))}

      {errors.addedOptions && (
        <p role="alert" className="text-danger text-[0.82rem] font-medium">
          {errors.addedOptions}
        </p>
      )}

      <div>
        <button
          type="button"
          disabled={full}
          onClick={() =>
            onChange({ addedOptions: [...draft.addedOptions, blankAddedOption()] })
          }
          className={`${TEXT_BUTTON} disabled:pointer-events-none disabled:opacity-50`}
        >
          <PlusIcon width={14} height={14} />
          Add option
        </button>
        {full && (
          <span className="text-text-muted ml-2 text-[0.76rem]">
            A product can have at most {LIMITS.options} options.
          </span>
        )}
      </div>
    </section>
  )
}
