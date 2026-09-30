import Link from 'next/link';
import { StateBadge, type Tone } from '@/components/admin/state-badge';

export interface StatProps {
  readonly label: string;
  /** `null` es «no se midió»: se escribe con palabras, nunca como un cero. */
  readonly value: string | null;
  readonly unit?: string | undefined;
  readonly detail?: string | undefined;
  readonly state?: { readonly tone: Tone; readonly label: string } | undefined;
  readonly href?: string | undefined;
}

function Body({ label, value, unit, detail, state }: StatProps) {
  return (
    <>
      <span className="pg-stat-label">{label}</span>
      <span className="pg-stat-value" data-unknown={value === null}>
        {value === null ? 'Sin medición' : value}
        {value !== null && unit ? <span className="pg-stat-unit">{unit}</span> : null}
      </span>
      {state ? <StateBadge tone={state.tone} label={state.label} /> : null}
      {detail ? <span className="pg-stat-detail">{detail}</span> : null}
    </>
  );
}

/**
 * La banda de cifras que sostienen el veredicto de una pantalla.
 *
 * Cada cifra lleva su unidad y su ventana en el texto, no en la memoria de
 * quien la mira, y si tiene un listado que la reproduce es un enlace a él.
 */
export function StatStrip({ stats, label }: { stats: readonly StatProps[]; label: string }) {
  return (
    <section className="pg-stats" aria-label={label}>
      {stats.map((stat) =>
        stat.href ? (
          <Link className="pg-stat" href={stat.href} key={stat.label}>
            <Body {...stat} />
          </Link>
        ) : (
          <div className="pg-stat" key={stat.label}>
            <Body {...stat} />
          </div>
        ),
      )}
    </section>
  );
}
