/*
 * El monograma DB de DatosBolivia.com: una D en tinta con el grabado numismático
 * del manual y una B en oro montada sobre su panza.
 *
 * Los contornos son de Newsreader (OFL) a peso 800, convertidos a trazado para
 * que la marca no dependa de que la fuente haya cargado. Es una versión
 * simplificada del arte del manual, hecha para pantalla: por debajo de 48 px
 * el grabado se quita (regla móvil del manual) y queda la silueta.
 *
 * Generado por scratchpad/tools/build-brand.mjs; para cambiar la geometría se
 * vuelve a correr, no se edita a mano.
 */

import {
  MONO_B as B,
  MONO_B_X as B_X,
  MONO_D as D,
  MONO_GRABADO as GRABADO,
  MONO_VIEWBOX,
} from './monogram-geometry';

export function Monogram({
  size = 40,
  detail,
  title = 'DatosBolivia.com',
  className,
}: {
  /** Ancho en píxeles; el alto sale de la proporción. */
  size?: number;
  /** Con grabado. Por defecto, solo cuando el monograma mide 48 px o más. */
  detail?: boolean;
  /** Nombre accesible; vacío si el monograma va junto al nombre escrito. */
  title?: string;
  className?: string;
}) {
  const conGrabado = detail ?? size >= 48;
  const id = `db-${size}`;
  return (
    <svg
      className={className ? `monogram ${className}` : 'monogram'}
      viewBox={MONO_VIEWBOX}
      width={size}
      height={Math.round((size * 1440) / 2743)}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <clipPath id={`${id}-d`}>
          <path d={D} />
        </clipPath>
      </defs>
      <path d={B} transform={`translate(${B_X} 0)`} fill="var(--gold)" />
      <path d={D} fill="var(--masthead-ink)" stroke="var(--paper)" strokeWidth={56} paintOrder="stroke" />
      {conGrabado ? (
        <g clipPath={`url(#${id}-d)`}>
          <path
            d={GRABADO}
            fill="none"
            stroke="var(--gold)"
            strokeWidth={15}
            strokeLinecap="round"
            opacity={0.9}
          />
        </g>
      ) : null}
    </svg>
  );
}

/** La misma geometría para quien la dibuja fuera de React (la imagen que se descarga). */
export { MONO_B, MONO_B_X, MONO_D, MONO_GRABADO, MONO_VIEWBOX } from './monogram-geometry';
