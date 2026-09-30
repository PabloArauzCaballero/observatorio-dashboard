import { count, percent } from '@/components/admin/format';

export interface ShareSegment {
  readonly label: string;
  readonly value: number;
  /** Una variable CSS de serie o de estado; el gris `--series-rest` es el resto plegado. */
  readonly color: string;
}

/**
 * Un todo partido en sus partes, en una sola barra.
 *
 * Tres comprobaciones, cuatro fallidas y una desconocida no son tres números
 * sueltos: son las partes de un total, y la barra dice cuánto pesa cada una
 * sin obligar a dividir de cabeza. Cada parte escribe su cifra y su porcentaje
 * debajo, así que el color nunca es lo único que la identifica.
 */
export function ShareBar({
  title,
  segments,
  unit,
}: {
  title: string;
  segments: readonly ShareSegment[];
  unit: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div>
      <p className="pg-chart-title">{title}</p>
      <div
        className="pg-share"
        role="img"
        aria-label={`${title}: ${segments.map((s) => `${s.label} ${count(s.value)}`).join(', ')}`}
        style={{ marginTop: '0.5rem' }}
      >
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.label}
              style={{ flexGrow: segment.value, ['--swatch' as string]: segment.color }}
              title={`${segment.label}: ${count(segment.value)} ${unit}`}
            />
          ))}
      </div>
      <ul className="pg-legend" style={{ gap: '0.25rem 1.1rem' }}>
        {segments.map((segment) => (
          <li key={segment.label}>
            <i className="pg-swatch" style={{ ['--swatch' as string]: segment.color }} />
            {segment.label} ·{' '}
            <b style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>{count(segment.value)}</b> (
            {percent(segment.value, total)})
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Varias barras de proporción, una por categoría, con la misma escala.
 *
 * Sirve para «origen de las visitas» o «descargas por conjunto»: cada fila es
 * un nombre, su cifra y una barra cuya longitud es su parte del mayor.
 */
export function BarList({
  rows,
  unit,
  color = 'var(--series-1)',
}: {
  rows: ReadonlyArray<{ label: string; value: number; detail?: string }>;
  unit: string;
  color?: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="pg-breakdown">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="pg-breakdown-head">
            <span>
              {row.label}
              {row.detail ? <small> · {row.detail}</small> : null}
            </span>
            <b>
              {count(row.value)} <small>{unit}</small>
            </b>
          </div>
          <div className="pg-share" aria-hidden="true">
            <span style={{ flexGrow: row.value, ['--swatch' as string]: color }} />
            <span style={{ flexGrow: Math.max(max - row.value, 0), background: 'transparent' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * La barra de una ejecución: qué parte de lo recibido se aceptó, se rechazó o
 * quedó en cuarentena. Va en línea en la tabla, con las cifras al lado: el color
 * solo dibuja la proporción, nunca es lo único que dice qué es cada tramo.
 */
export function OutcomeBar({
  received,
  accepted,
  rejected,
  quarantined,
}: {
  received: number;
  accepted: number;
  rejected: number;
  quarantined: number;
}) {
  if (received <= 0) return <span className="pg-stat-detail">sin recibidos</span>;
  const rest = Math.max(received - accepted - rejected - quarantined, 0);
  const parts = [
    { label: 'aceptados', value: accepted, color: 'var(--series-1)' },
    { label: 'rechazados', value: rejected, color: 'var(--critical)' },
    { label: 'en cuarentena', value: quarantined, color: 'var(--series-3)' },
    { label: 'sin resolver', value: rest, color: 'var(--series-rest)' },
  ];
  return (
    <div
      className="pg-share pg-share-inline"
      role="img"
      aria-label={parts.map((part) => `${count(part.value)} ${part.label}`).join(', ')}
    >
      {parts
        .filter((part) => part.value > 0)
        .map((part) => (
          <span
            key={part.label}
            title={`${count(part.value)} ${part.label}`}
            style={{ flexGrow: part.value, ['--swatch' as string]: part.color }}
          />
        ))}
    </div>
  );
}

/**
 * Un medidor: una parte contra su total, con el denominador a la vista.
 *
 * «80 %» sin decir de cuántos no dice nada, así que la cifra escrita lleva
 * numerador y denominador y la barra solo la dibuja. Sin población, no hay
 * barra: «0 de 0» no es cien por ciento y no se pinta como tal.
 */
export function Meter({
  numerator,
  denominator,
  text,
  color = 'var(--series-1)',
}: {
  numerator: number | null;
  denominator: number | null;
  /** La frase ya formateada («80 de 100 (80 %)»), que es lo que se lee. */
  text: string;
  color?: string;
}) {
  const valid = numerator !== null && denominator !== null && denominator > 0;
  return (
    <span className="pg-meter">
      <span>{text}</span>
      {valid ? (
        <span className="pg-share pg-share-inline" aria-hidden="true">
          <span style={{ flexGrow: numerator, ['--swatch' as string]: color }} />
          <span
            style={{ flexGrow: Math.max(denominator - numerator, 0), background: 'transparent' }}
          />
        </span>
      ) : null}
    </span>
  );
}
