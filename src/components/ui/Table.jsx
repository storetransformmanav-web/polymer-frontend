import './Table.css'

/**
 * Consistent table chrome (borders, header styling, row hover, empty
 * state) around a native `<table>`. Pages compose their own
 * `<thead>`/`<tbody>` as children — this only owns the shared styling,
 * not column config, so it stays useful for any tabular data.
 */
export function Table({ children }) {
  return (
    <div className="table-wrap">
      <table className="table">{children}</table>
    </div>
  )
}

/** Full-width row for a table's loading/empty/error state. */
export function TableState({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="table__state">
        {children}
      </td>
    </tr>
  )
}
