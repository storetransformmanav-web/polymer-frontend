import { useEffect, useMemo, useState } from 'react'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { HeaderBackButton } from '../../../components/ui/DetailsHeader.tsx'
import { CheckIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import type { CollectionDetail } from '../../../lib/api/endpoints.ts'
import { useCollectionRuleOptions, useCreateCollection } from '../hooks/useCollections.ts'
import {
  blankCollectionDraft,
  blankCondition,
  buildCreateBody,
  isDraftDirty,
  validateCollectionDraft,
  type CollectionDraft,
  type DraftErrors,
} from '../utils/collectionDraft.ts'
import { CollectionConfirm } from './CollectionConfirm.tsx'
import { fieldErrorsFrom } from '../utils/fieldErrors.ts'
import {
  BasicsFields,
  FormCard,
  ImageFields,
  ProductPicker,
  RulesEditor,
  SeoFields,
  SortOrderField,
} from './CollectionFormParts.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../utils/ui.ts'

interface CollectionCreateViewProps {
  /** The store the collection is made in. */
  shop: string
  shopName: string
  onBack: () => void
  /** The store answered: `message` to show, and the new collection to open. */
  onCreated: (message: string, collection: CollectionDetail) => void
  onDirtyChange?: (dirty: boolean) => void
}

/**
 * **Add collection**, in place of the list (laid out like Add product): a heading with Back to list
 * and Create collection, then a wide column — Basics (title, description), the collection type
 * (**Manual**: pick products; **Automated**: the conditions, from `GET /collections/rule-options`)
 * and the search engine listing — and beside it the picture and the product order. Create checks
 * every field, asks first and sends one `POST /collections` (`products` or `rules`, never both).
 */
export function CollectionCreateView({
  shop,
  shopName,
  onBack,
  onCreated,
  onDirtyChange,
}: CollectionCreateViewProps) {
  const [draft, setDraft] = useState<CollectionDraft>(blankCollectionDraft)
  const [showErrors, setShowErrors] = useState(false)
  const [serverErrors, setServerErrors] = useState<DraftErrors>({})
  const [confirming, setConfirming] = useState(false)
  const rules = useCollectionRuleOptions()
  const { create } = useCreateCollection()
  const columns = rules.columns

  const problems = useMemo(
    () => validateCollectionDraft(draft, columns),
    [draft, columns],
  )
  const errors: DraftErrors = { ...(showErrors ? problems : {}), ...serverErrors }
  const hasProblems = Object.keys(problems).length > 0

  const dirty = isDraftDirty(draft)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  function change(changes: Partial<CollectionDraft>) {
    setServerErrors({})
    setDraft((current) => ({ ...current, ...changes }))
  }

  function chooseKind(kind: CollectionDraft['kind']) {
    change({
      kind,
      // An automated collection starts with one condition row.
      conditions:
        kind === 'smart' && draft.conditions.length === 0 && columns.length > 0
          ? [blankCondition(columns)]
          : draft.conditions,
    })
  }

  function submit() {
    setShowErrors(true)
    if (!shop) return
    if (hasProblems) {
      // The first field with a problem gets the focus.
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }
    setConfirming(true)
  }

  return (
    <div className="relative flex flex-col gap-4">
      <header className={`${DETAIL_CARD} flex flex-wrap items-center gap-3 p-4 sm:p-5`}>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-lg font-bold sm:text-2xl">Add collection</h1>
          <p className="text-text-muted m-0 text-[0.82rem]">
            {shopName ? `In ${shopName}. ` : ''}It is made in Shopify too.
          </p>
        </div>
        <HeaderBackButton onClick={onBack} />
        <button
          type="button"
          onClick={submit}
          disabled={!shop}
          className={PRIMARY_BUTTON}
        >
          <CheckIcon width={16} height={16} />
          Create collection
        </button>
      </header>

      {showErrors && hasProblems && (
        <FormMessage tone="error">
          Fix the highlighted fields to create the collection.
        </FormMessage>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <FormCard title="Basics">
            <BasicsFields
              draft={draft}
              errors={errors}
              onChange={change}
              idPrefix="new-collection"
            />
          </FormCard>

          <FormCard
            title="Collection type"
            description="The type can't be changed once the collection is made."
          >
            <fieldset className="m-0 grid gap-3 border-none p-0 sm:grid-cols-2">
              <legend className="sr-only">Collection type</legend>
              {(
                [
                  {
                    kind: 'custom',
                    label: 'Manual',
                    text: 'Add products to this collection one by one.',
                  },
                  {
                    kind: 'smart',
                    label: 'Automated',
                    text: 'Products that match the conditions are added on their own.',
                  },
                ] as const
              ).map((item) => (
                <label
                  key={item.kind}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    draft.kind === item.kind
                      ? 'border-accent bg-accent-tint/50'
                      : 'border-border hover:border-accent'
                  }`}
                >
                  <input
                    type="radio"
                    name="new-collection-kind"
                    checked={draft.kind === item.kind}
                    onChange={() => chooseKind(item.kind)}
                    className="accent-accent mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="block text-[0.88rem] font-semibold">
                      {item.label}
                    </span>
                    <span className="text-text-muted block text-[0.78rem]">
                      {item.text}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            {draft.kind === 'custom' ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.8rem] font-semibold">
                  Products <span className="text-text-muted font-normal">(optional)</span>
                </span>
                <ProductPicker
                  shop={shop}
                  picked={draft.products}
                  onChange={(products) => change({ products })}
                  error={errors.products}
                  idPrefix="new-collection"
                />
              </div>
            ) : rules.error ? (
              <FormMessage tone="error">
                {`Could not load the condition choices: ${rules.error}`}
              </FormMessage>
            ) : rules.options ? (
              <RulesEditor
                options={rules.options}
                match={draft.match}
                conditions={draft.conditions}
                errors={errors}
                onChange={change}
                idPrefix="new-collection"
              />
            ) : (
              <p className="text-text-muted m-0 flex items-center gap-2 text-[0.82rem]">
                <SpinnerIcon width={14} height={14} className="animate-spin" />
                Loading the condition choices…
              </p>
            )}
          </FormCard>

          <FormCard
            title="Search engine listing"
            description="How the collection shows in search results."
          >
            <SeoFields
              draft={draft}
              errors={errors}
              onChange={change}
              idPrefix="new-collection"
            />
          </FormCard>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <FormCard title="Image">
            <ImageFields
              draft={draft}
              errors={errors}
              onChange={change}
              idPrefix="new-collection"
            />
          </FormCard>
          <FormCard title="Product order">
            <SortOrderField
              id="new-collection-sort-order"
              value={draft.sortOrder}
              sortOrders={rules.options?.sort_orders ?? []}
              onChange={(sortOrder) => change({ sortOrder })}
            />
          </FormCard>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onBack} className={SECONDARY_BUTTON}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!shop}
          className={PRIMARY_BUTTON}
        >
          <CheckIcon width={16} height={16} />
          Create collection
        </button>
      </div>

      {confirming && (
        <CollectionConfirm
          title={`Create “${draft.title.trim()}”?`}
          confirmLabel="Yes, create"
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            try {
              const result = await create(buildCreateBody(draft, shop, columns))
              setConfirming(false)
              onCreated(result.message, result.collection)
            } catch (error) {
              setServerErrors(fieldErrorsFrom(error))
              throw error
            }
          }}
        >
          <p className="m-0">
            A {draft.kind === 'smart' ? 'automated' : 'manual'} collection
            {draft.kind === 'custom' && draft.products.length > 0
              ? ` with ${draft.products.length} ${draft.products.length === 1 ? 'product' : 'products'}`
              : ''}
            {draft.kind === 'smart'
              ? ` with ${draft.conditions.length} ${draft.conditions.length === 1 ? 'condition' : 'conditions'}`
              : ''}{' '}
            will be made in {shopName || 'the store'}.
          </p>
          <p className="text-text-muted m-0">
            It is saved in Shopify first, which can take a few seconds.
          </p>
        </CollectionConfirm>
      )}
    </div>
  )
}
