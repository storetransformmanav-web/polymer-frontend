import { SectionsEditor } from '../edit/DescriptionSectionsSection.tsx'
import { CreateCard, type CreateSectionProps } from './CreateCard.tsx'

/**
 * **Product description & information** on the Add product form: the sections the product page
 * shows — a Product Description and the Product Information, two fixed titles each with a text
 * editor. They are sent with the new product as its `apd` metafield (one section open at a time),
 * and read back and edited the same way on the product's page afterwards.
 */
export function CreateSectionsCard({ draft, errors, update }: CreateSectionProps) {
  return (
    <CreateCard title="Product description & information" headingAbove>
      <p className="text-text-muted m-0 text-[0.85rem]">
        Optional. What customers read on the product page, one section after another.
      </p>
      <SectionsEditor
        sections={draft.descriptionSections}
        errors={errors}
        onChange={(descriptionSections) => update({ descriptionSections })}
        idPrefix="create"
      />
    </CreateCard>
  )
}
