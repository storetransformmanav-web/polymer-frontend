/**
 * The new order of a product's images when files added from the Add product form have just
 * arrived: they go in front of the pictures that went in with the product (a variant's, say),
 * so the first one becomes the main image.
 *
 * The store lists arrived files after everything else, so they sit at `baseline …
 * baseline + count`. The ones that were moved to the front earlier (`placed`) stay first, in
 * the order they were chosen; the new ones follow them. Returns null when there is nothing to
 * do: no older picture to go in front of, or the product doesn't list all of them yet.
 */
export function frontOrder(
  images: readonly { id: string }[],
  baseline: number,
  placed: number,
  count: number,
): string[] | null {
  const fresh = images.slice(baseline, baseline + count)
  if (baseline <= placed || count === 0 || fresh.length !== count) return null
  return [
    ...images.slice(0, placed),
    ...fresh,
    ...images.slice(placed, baseline),
    ...images.slice(baseline + count),
  ].map((image) => image.id)
}
