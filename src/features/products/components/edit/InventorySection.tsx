import { useProductStockLocations } from '../../hooks/useProductStockLocations.ts'
import type { VariantDraft } from '../../utils/editDraft.ts'
import type { SectionProps } from './fields.tsx'
import { VariantInventoryCard } from './VariantSections.tsx'

/**
 * The Inventory tab being edited: one **Inventory** card per variant — the same card as in the
 * Variants editor and in Add product (the "Inventory tracked" switch, the Locations table with
 * the Available quantity to edit, and More details: SKU, barcode, continue selling). Both tabs edit
 * the same fields of the same variants, so a change made in either is saved the same way.
 */
export function InventorySection({ product, draft, errors, onChange }: SectionProps) {
  const locations = useProductStockLocations(product)

  const update = (index: number, patch: Partial<VariantDraft>) =>
    onChange({
      variants: draft.variants.map((variant, i) =>
        i === index ? { ...variant, ...patch } : variant,
      ),
    })

  return (
    <ul aria-label="Variant inventory" className="flex flex-col gap-5">
      {draft.variants.map((variant, index) =>
        variant.removed ? null : (
          <li key={variant.key} className="flex flex-col gap-2">
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-[0.9rem] font-semibold">
              {variant.title}
              {variant.sku.trim() && (
                <span className="text-text-muted font-mono text-[0.78rem] font-normal">
                  {variant.sku}
                </span>
              )}
            </h3>
            <VariantInventoryCard
              product={product}
              variant={variant}
              index={index}
              errors={errors}
              prefix={`inventory-${variant.key}`}
              locations={locations}
              update={(patch) => update(index, patch)}
            />
          </li>
        ),
      )}
    </ul>
  )
}
