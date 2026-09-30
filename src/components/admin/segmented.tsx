import Link from 'next/link';

/**
 * Un selector de una opción entre pocas, hecho de enlaces.
 *
 * Es de enlaces y no de botones porque cada opción es una dirección: se puede
 * copiar, recargar y compartir con el filtro puesto. La opción activa se ve
 * —`aria-current` tiene su propio estilo— y no solo se declara.
 */
export function SegmentedLinks({
  label,
  options,
}: {
  label: string;
  options: ReadonlyArray<{ href: string; label: string; current: boolean }>;
}) {
  return (
    <div className="pg-filter">
      <span>{label}</span>
      <div className="pg-seg" role="group" aria-label={label}>
        {options.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            aria-current={option.current ? 'page' : undefined}
            scroll={false}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
