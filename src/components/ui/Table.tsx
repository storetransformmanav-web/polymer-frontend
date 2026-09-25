import type { ReactNode } from 'react'

export interface TableProps {
  children: ReactNode
}

/**
 * Consistent table chrome (borders, header styling, row hover, empty
 * state) around a native `<table>`. Pages compose their own
 * `<thead>`/`<tbody>` as children — this only owns the shared styling,
 * not column config, so it stays useful for any tabular data. Styling
 * reaches into children via arbitrary descendant selectors since
 * callers own the actual `<tr>`/`<td>` markup.
 */
export function Table({ children }: TableProps) {
  return (
    <div className="border-border bg-bg overflow-x-auto rounded-xl border">
      <table className="[&_thead_th]:text-text-muted [&_thead_th]:border-border [&_tbody_tr:hover]:bg-surface [&_tbody_tr:not(:last-child)_td]:border-border w-full border-collapse text-[0.88rem] [&_tbody_tr:not(:last-child)_td]:border-b [&_td]:px-4 [&_td]:py-3 [&_td]:text-left [&_td]:whitespace-nowrap [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:whitespace-nowrap [&_thead_th]:border-b [&_thead_th]:text-[0.72rem] [&_thead_th]:font-bold [&_thead_th]:tracking-wide [&_thead_th]:uppercase">
        {children}
      </table>
    </div>
  )
}

export interface TableStateProps {
  colSpan: number
  children: ReactNode
}

/** Full-width row for a table's loading/empty/error state. */
export function TableState({ colSpan, children }: TableStateProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="text-text-muted px-4 py-8 text-center whitespace-normal"
      >
        {children}
      </td>
    </tr>
  )
}
