/**
 * Which columns a list table shows, and in what order — the pure rules behind the Columns menu
 * (`components/ui/ColumnsMenu.tsx`) that the Customers and Orders tables share. A table has a
 * fixed set of column names (`all`) and the ones shown to begin with (`defaults`); the choice is a
 * `ColumnConfig`. A table's own first and last columns (the name or number, Actions) are fixed and
 * are not part of it.
 */
export interface ColumnConfig<Id extends string = string> {
  /** Every column, in the order the menu lists them and the table shows the visible ones. */
  order: Id[]
  visible: Id[]
}

export function defaultColumnConfig<Id extends string>(
  all: readonly Id[],
  defaults: readonly Id[],
): ColumnConfig<Id> {
  const hidden = all.filter((id) => !defaults.includes(id))
  return { order: [...defaults, ...hidden], visible: [...defaults] }
}

/**
 * Reads a saved configuration (it comes from storage, so it may be anything): unknown or repeated
 * names are dropped and a column the saved copy doesn't know yet is added at the end, hidden.
 * Anything unusable gives the default.
 */
export function normalizeColumnConfig<Id extends string>(
  value: unknown,
  all: readonly Id[],
  defaults: readonly Id[],
): ColumnConfig<Id> {
  if (typeof value !== 'object' || value === null)
    return defaultColumnConfig(all, defaults)
  const { order, visible } = value as { order?: unknown; visible?: unknown }
  if (!Array.isArray(order) || !Array.isArray(visible)) {
    return defaultColumnConfig(all, defaults)
  }

  const known = new Set<string>(all)
  const isId = (item: unknown): item is Id => typeof item === 'string' && known.has(item)

  const seen = new Set<Id>()
  const cleanOrder: Id[] = []
  for (const id of order) {
    if (isId(id) && !seen.has(id)) {
      seen.add(id)
      cleanOrder.push(id)
    }
  }
  for (const id of all) if (!seen.has(id)) cleanOrder.push(id)

  const shown = new Set(visible.filter(isId))
  return { order: cleanOrder, visible: cleanOrder.filter((id) => shown.has(id)) }
}

export function isColumnVisible<Id extends string>(
  config: ColumnConfig<Id>,
  id: Id,
): boolean {
  return config.visible.includes(id)
}

/** Is this the default choice (the same columns, in the same order)? */
export function isDefaultColumnConfig<Id extends string>(
  config: ColumnConfig<Id>,
  all: readonly Id[],
  defaults: readonly Id[],
): boolean {
  const base = defaultColumnConfig(all, defaults)
  const same = (a: Id[], b: Id[]) =>
    a.length === b.length && a.every((id, index) => id === b[index])
  return same(config.order, base.order) && same(config.visible, base.visible)
}

/** Show a hidden column or hide a shown one. */
export function toggleColumn<Id extends string>(
  config: ColumnConfig<Id>,
  id: Id,
): ColumnConfig<Id> {
  const visible = isColumnVisible(config, id)
    ? config.visible.filter((item) => item !== id)
    : config.order.filter((item) => item === id || config.visible.includes(item))
  return { order: config.order, visible }
}

/** Puts `id` where `target` is (the others shift); an unknown name or the same one changes nothing. */
export function moveColumn<Id extends string>(
  config: ColumnConfig<Id>,
  id: Id,
  target: Id,
): ColumnConfig<Id> {
  const from = config.order.indexOf(id)
  const to = config.order.indexOf(target)
  if (from < 0 || to < 0 || from === to) return config
  const order = [...config.order]
  order.splice(from, 1)
  order.splice(to, 0, id)
  return { order, visible: order.filter((item) => config.visible.includes(item)) }
}
