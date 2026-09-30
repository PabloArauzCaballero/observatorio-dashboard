import type { SeedValidation } from '@/lib/admin/contracts';

/**
 * The four things a difference can be, kept apart on screen.
 *
 * **Faltantes** are rows the package declares and the table does not have.
 * **Modificados** are rows whose managed fields differ, and whether that is a
 * repair or a conflict depends on who owns the package — a `create_only`
 * package must not overwrite what somebody edited on purpose. **Adicionales**
 * are rows the table holds and the package does not declare, which is allowed
 * and is never a defect. Everything else matches.
 *
 * A corpus reports that it was not compared row by row, and says why, rather
 * than reporting zero differences it never looked for.
 */
export function SeedDifference({
  difference,
  ownership,
}: {
  difference: SeedValidation['difference'];
  ownership: string;
}) {
  if (!difference) {
    return (
      <p className="admin-note">
        No se calculó diferencia: el paquete fue rechazado antes de compararlo.
      </p>
    );
  }
  if (!difference.compared) {
    return <p className="admin-note">{difference.reason}</p>;
  }

  const totals = difference.catalogues.reduce(
    (sum, catalogue) => ({
      missing: sum.missing + catalogue.missing.length,
      modified: sum.modified + catalogue.modified.length,
      additional: sum.additional + catalogue.additional,
    }),
    { missing: 0, modified: 0, additional: 0 },
  );

  return (
    <>
      <p className="admin-note">
        {totals.missing} faltantes · {totals.modified} modificados · {totals.additional} adicionales
        permitidos
        {ownership === 'create_only' && totals.modified > 0
          ? ' · este paquete no sobrescribe lo modificado a mano: esos casos son conflictos'
          : ''}
      </p>
      <div className="admin-scroll" tabIndex={0} role="region" aria-label="Tabla desplazable">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Catálogo</th>
              <th scope="col" className="num">
                Declarados
              </th>
              <th scope="col" className="num">
                Presentes
              </th>
              <th scope="col" className="num">
                Faltantes
              </th>
              <th scope="col" className="num">
                Modificados
              </th>
              <th scope="col" className="num">
                Adicionales
              </th>
            </tr>
          </thead>
          <tbody>
            {difference.catalogues.map((catalogue) => (
              <tr key={`${catalogue.table}-${catalogue.label}`}>
                <td className="wrap">
                  {catalogue.label}
                  <br />
                  <small className="admin-mono">{catalogue.table}</small>
                </td>
                <td className="num">{catalogue.declared}</td>
                <td className="num">{catalogue.present}</td>
                <td className="num">{catalogue.missing.length}</td>
                <td className="num">{catalogue.modified.length}</td>
                <td className="num">{catalogue.additional}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {difference.catalogues
        .filter((catalogue) => catalogue.modified.length > 0)
        .map((catalogue) => (
          <details key={`detail-${catalogue.table}-${catalogue.label}`}>
            <summary>{catalogue.label}: campos que difieren</summary>
            <ul>
              {catalogue.modified.slice(0, 20).map((row) => (
                <li key={row.identity} className="admin-mono">
                  {row.identity}
                  <ul>
                    {row.fields.map((field) => (
                      <li key={field.field}>
                        {field.field}: «{field.stored}» → «{field.expected}»
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </details>
        ))}
    </>
  );
}
