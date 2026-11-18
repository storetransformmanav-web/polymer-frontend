import { useState } from 'react'
import { ApiError } from '../../../lib/api/ApiError.ts'
import type {
  CollectionDetail,
  CollectionUpdateBody,
} from '../../../lib/api/endpoints.ts'
import { uploadCollectionImage } from '../utils/uploadImage.ts'
import { CollectionConfirm } from './CollectionConfirm.tsx'
import { ImageUploadField } from './CollectionFormParts.tsx'
import type { SaveCollection } from './CollectionInlineEdits.tsx'

/**
 * Add or change a collection's picture **from the computer** (the Image area of the details page).
 * It is the question itself: choose a JPG / PNG / WebP / GIF (up to 20 MB) and, if you like, its alt
 * text, then **Yes, upload** — the picture goes to the store's file storage
 * (`POST /collections/upload-target`) and its address is saved with one `PUT /collections/{id}`
 * (`{ image_url, image_alt? }`), which Shopify also gets. A refusal shows inside the dialog, which
 * stays open; nothing changes until the store accepts it.
 */
export function CollectionImageDialog({
  collection,
  onSave,
  onClose,
}: {
  collection: CollectionDetail
  onSave: SaveCollection
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState(collection.image_alt ?? '')
  // The collection's own store (the upload and the save both need it).
  const shop = collection.shop?.key ?? collection.shop?.domain ?? ''

  return (
    <CollectionConfirm
      title={collection.image_url ? 'Change the picture?' : 'Add a picture?'}
      confirmLabel="Yes, upload"
      onClose={onClose}
      onConfirm={async () => {
        if (!file) throw new ApiError('Choose a picture from your computer first.')
        const url = await uploadCollectionImage(file, shop)
        const body: CollectionUpdateBody = { image_url: url }
        if (alt.trim()) body.image_alt = alt.trim()
        await onSave(body)
        onClose()
      }}
    >
      <p className="m-0">
        {collection.image_url
          ? 'The new picture replaces the current one, also in Shopify.'
          : 'The picture is also added in Shopify.'}
      </p>
      <ImageUploadField
        file={file}
        onFile={setFile}
        alt={alt}
        onAlt={setAlt}
        idPrefix="collection-image-upload"
      />
    </CollectionConfirm>
  )
}
