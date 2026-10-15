import { useId, useMemo, useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { DetailSection, DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  BoxesIcon,
  ImageIcon,
  LayersIcon,
  ListChecksIcon,
  SearchIcon,
  SpinnerIcon,
  TagIcon,
} from '../../../components/ui/icons.tsx'
import { SidePanel } from '../../../components/ui/SidePanel.tsx'
import type {
  ProductDetail,
  ProductUpdateBody,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { useProductForEdit } from '../hooks/useProductForEdit.ts'
import { useSaveProduct } from '../hooks/useSaveProduct.ts'
import {
  buildUpdateBody,
  draftFromProduct,
  hasChanges,
  validateDraft,
  type DraftErrors,
  type ProductDraft,
} from '../utils/editDraft.ts'
import { BasicsSection } from './edit/BasicsSection.tsx'
import { CollectionsSection } from './edit/CollectionsSection.tsx'
import { MediaSection } from './edit/MediaSection.tsx'
import { SeoSection } from './edit/SeoSection.tsx'
import { TagsSection } from './edit/TagsSection.tsx'
import { VariantsSection } from './edit/VariantsSection.tsx'
import { ProductImage } from './ProductImage.tsx'

interface ProductEditPanelProps {
  /** The product's CRM id. */
  id: string
  onClose: () => void
  /** Called once the edit is saved (the cached product is already updated). */
  onSaved: (
    result: ProductWriteResult,
    product: ProductDetail,
    body: ProductUpdateBody,
  ) => void
}

/** Does any error belong to this part of the form? (Used to open a collapsed section.) */
const hasErrorIn = (errors: DraftErrors, ...prefixes: string[]) =>
  Object.keys(errors).some((key) =>
    prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)),
  )

/**
 * "Edit product" slide-over, opened from the pencil on a list row or on the
 * details page. Instant by design: the product comes from the same cache the
 * page already filled (hovering the pencil prefetches it), so the form is
 * normally fully populated on the first frame.
 */
export function ProductEditPanel({ id, onClose, onSaved }: ProductEditPanelProps) {
  const { product, error, retry } = useProductForEdit(id)

  if (!product) {
    // Only reached when the details weren't cached yet (e.g. a very quick click).
    return (
      <SidePanel wide title="Edit product" label="Edit product" onClose={onClose}>
        <div className="p-5">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangleIcon width={28} height={28} className="text-danger" />
              <p className="font-semibold">Couldn&apos;t load this product</p>
              <p className="text-text-muted text-[0.9rem]">{error}</p>
              <Button type="button" variant="secondary" onClick={retry}>
                Try again
              </Button>
            </div>
          ) : (
            <DetailSkeleton />
          )}
        </div>
      </SidePanel>
    )
  }

  return (
    <ProductEditForm
      key={product.id}
      product={product}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

interface ProductEditFormProps {
  product: ProductDetail
  onClose: () => void
  onSaved: (
    result: ProductWriteResult,
    product: ProductDetail,
    body: ProductUpdateBody,
  ) => void
}

function ProductEditForm({ product, onClose, onSaved }: ProductEditFormProps) {
  const formId = useId()
  // The product as it was when the form opened. Everything sent is "what this
  // person changed since then", so an edit never reverts a colleague's change
  // to a field they didn't touch (even if the cache refreshes meanwhile).
  const [baseline] = useState(product)
  const [draft, setDraft] = useState<ProductDraft>(() => draftFromProduct(product))
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const { save, isSaving, error, clearError } = useSaveProduct()

  const body = useMemo(() => buildUpdateBody(baseline, draft), [baseline, draft])
  const allErrors = useMemo(() => validateDraft(baseline, draft), [baseline, draft])
  const errors = showErrors ? allErrors : {}
  const dirty = hasChanges(body)
  const hasProblems = Object.keys(allErrors).length > 0

  function change(patch: Partial<ProductDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
    if (error) clearError()
  }

  function requestClose() {
    if (isSaving) return
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving || !dirty) return

    setShowErrors(true)
    if (hasProblems) {
      // Show the first problem once the (possibly collapsed) section has opened.
      requestAnimationFrame(() =>
        document.querySelector('[role="alert"]')?.scrollIntoView?.({ block: 'center' }),
      )
      return
    }

    const result = await save({ id: baseline.id, body, shop: baseline.shop?.key })
    if (result) onSaved(result, baseline, body)
  }

  const section = { product: baseline, draft, errors, onChange: change }
  const variantsOpen = hasErrorIn(errors, 'variants')
  const mediaOpen = hasErrorIn(errors, 'images', 'newMedia')
  const collectionsOpen = hasErrorIn(errors, 'addedCollections')
  const imageUrl = baseline.featured_image_url ?? baseline.images[0]?.url ?? null

  return (
    <SidePanel
      wide
      title="Edit product"
      label="Edit product"
      onClose={requestClose}
      closeDisabled={isSaving}
      footer={
        confirmDiscard ? (
          <div className="flex flex-col gap-3">
            <p className="text-[0.88rem] font-medium">Discard your unsaved changes?</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="hover:border-accent! flex-1"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep editing
              </Button>
              <Button type="button" className="bg-danger! flex-1" onClick={onClose}>
                Discard
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {error && <FormMessage tone="error">{error}</FormMessage>}
            {showErrors && hasProblems && !error && (
              <FormMessage tone="error">Fix the highlighted fields to save.</FormMessage>
            )}
            <div className="flex items-center gap-3">
              <p
                className={`min-w-0 flex-1 text-[0.8rem] ${dirty ? 'text-text font-medium' : 'text-text-muted'}`}
                aria-live="polite"
              >
                {dirty ? 'You have unsaved changes' : 'No changes yet'}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="hover:border-accent!"
                disabled={isSaving}
                onClick={requestClose}
              >
                Cancel
              </Button>
              <Button type="submit" form={formId} disabled={!dirty || isSaving}>
                {isSaving ? (
                  <>
                    <SpinnerIcon className="animate-spin" /> Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </div>
        )
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4 p-5"
      >
        <div className="flex items-center gap-3">
          <ProductImage src={imageUrl} alt="" size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[0.95rem] font-semibold">{baseline.title}</p>
            <p className="text-text-muted truncate text-[0.78rem]">
              {baseline.shop?.name ?? baseline.shop?.key ?? 'Product'}
              {baseline.shop?.currency ? ` · ${baseline.shop.currency}` : ''}
            </p>
          </div>
        </div>
        <p className="text-text-muted -mt-1 text-[0.82rem]">
          Saved here straight away, then sent to the store. Only the fields you change are
          sent.
        </p>

        <DetailSection title="Basics" icon={ListChecksIcon}>
          <BasicsSection {...section} />
        </DetailSection>
        <DetailSection title="Tags" count={draft.tags.length} icon={TagIcon}>
          <TagsSection {...section} />
        </DetailSection>
        <DetailSection
          title="Search engine listing"
          icon={SearchIcon}
          defaultOpen={false}
        >
          <SeoSection {...section} />
        </DetailSection>
        <DetailSection
          title="Variants & prices"
          count={draft.variants.filter((variant) => !variant.removed).length}
          icon={BoxesIcon}
          defaultOpen={false}
          forceOpen={variantsOpen}
        >
          <VariantsSection {...section} />
        </DetailSection>
        <DetailSection
          title="Images & media"
          count={
            draft.images.filter((image) => !image.removed).length + draft.newMedia.length
          }
          icon={ImageIcon}
          defaultOpen={false}
          forceOpen={mediaOpen}
        >
          <MediaSection {...section} />
        </DetailSection>
        <DetailSection
          title="Collections"
          count={baseline.collections.length}
          icon={LayersIcon}
          defaultOpen={false}
          forceOpen={collectionsOpen}
        >
          <CollectionsSection {...section} />
        </DetailSection>
      </form>
    </SidePanel>
  )
}
