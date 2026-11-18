import { api } from '../../../lib/api/endpoints.ts'

/**
 * Sends a picture chosen from the computer to the backend (`POST /products/media/upload`, form
 * `files` + `shop`) and answers the address it stores the picture at (`items[0].url`), which then
 * goes in `image_url` of `POST /collections` or `PUT /collections/{ref}` within a few minutes.
 * Whatever the backend refuses with is passed on untouched, so its own message is what shows.
 * Never retried: a failed upload is tried again by the person.
 */
export function uploadCollectionImage(file: File, shop: string): Promise<string> {
  return api.products.uploadMedia(file, shop)
}
