import type { ReactNode } from 'react';

export interface Column<Row> {
  /** Lo que dice la cabecera y, en móvil, lo que antecede a cada celda. */
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
  readonly align?: 'num';
  readonly mono?: boolean;
  readonly wrap?: boolean;
  readonly title?: (row: Row) => string | undefined;
}

/**
 * La tabla del portal, escrita una sola vez.
 *
 * Reúne lo que estaba copiado en una docena de pantallas: el envoltorio con
 * desplazamiento propio (una tabla ancha nunca desplaza el documento), la
 * cabecera con alcance de columna, la alineación numérica y, desde 700 px, el
 * paso a fichas —cada fila una tarjeta, cada celda con su encabezado delante—
 * en lugar de seis columnas que dejaban ver solo la primera.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  stack = true,
}: {
  caption?: string;
  columns: ReadonlyArray<Column<Row>>;
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  stack?: boolean;
}) {
  return (
    <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
      <table className="admin-table" data-stack={stack ? '' : undefined}>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column.header} className={column.align}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.header}
                  data-label={column.header}
                  className={[
                    column.align,
                    column.mono ? 'admin-mono' : '',
                    column.wrap ? 'wrap' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  title={column.title?.(row)}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
