'use client';

import { useDatosDeFigura, celda } from '@/components/ui/panel-data';
import { Avatar } from './people-ui';
import s from './people.module.css';

export interface RankSegment {
  key: string;
  /** Ancho del tramo, en % de la pista completa. */
  width: number;
  color: string;
  /** Qué mide el tramo, para la descripción accesible. */
  label: string;
}

export interface RankItem {
  slug: string;
  name: string;
  /** Lo que va bajo el nombre: el sector y el puesto en él. */
  sub?: string | undefined;
  place: number;
  /** La cifra de la derecha, ya escrita con su unidad. */
  shown: string;
  segments: RankSegment[];
  /** Banda de margen de error sobre la barra, en % de la pista. */
  band?: { from: number; to: number } | undefined;
  /** La cifra cruda para la descarga. */
  raw: number;
}

/**
 * Un ránking como lista: puesto, monograma, nombre, cifra y una barra debajo.
 *
 * La barra va en su propia línea y no al lado del nombre para que la fila aguante un
 * panel de 24 rem sin recortar nombres como «Marcelo Martins Moreno». Cada tramo de la
 * barra es una fuente del índice; la leyenda del panel nombra los colores. Tocar el nombre
 * abre la ficha. El orden de lectura es el del DOM: puesto, nombre, cifra, barra.
 */
export function RankList({
  items,
  onPick,
  selectedSlug,
  label,
  unit,
  valueHeader,
  tall = false,
}: {
  items: readonly RankItem[];
  onPick: (slug: string) => void;
  selectedSlug?: string | null | undefined;
  /** Para el lector de pantalla: qué es esta lista. */
  label: string;
  unit: string;
  valueHeader: string;
  tall?: boolean;
}) {
  useDatosDeFigura(
    () => ({
      etiqueta: 'Ránking',
      unidad: unit,
      columnas: ['Puesto', 'Nombre', valueHeader],
      filas: items.map((item) => [item.place, item.name, celda(item.raw)]),
    }),
    [items, unit, valueHeader],
  );

  return (
    <ol className={s.rank} aria-label={label}>
      {items.map((item) => (
        <li className={s.rankRow} key={item.slug}>
          <span className={s.place}>{item.place}</span>
          <Avatar name={item.name} on={item.slug === selectedSlug} />
          <span className={s.who}>
            <button
              type="button"
              className={s.nameBtn}
              onClick={() => onPick(item.slug)}
              title={`Ver la ficha de ${item.name}`}
            >
              {item.name}
            </button>
            {item.sub ? <span className={s.sub}>{item.sub}</span> : null}
          </span>
          <span className={s.value}>{item.shown}</span>
          <span className={s.trackWrap}>
            <span
              className={s.track + (tall ? ` ${s.trackTall}` : '')}
              role="img"
              aria-label={`${item.name}: ${item.shown}. ${item.segments
                .filter((segment) => segment.width > 0)
                .map((segment) => segment.label)
                .join(', ')}`}
            >
              {item.segments.map((segment, index) => (
                <span
                  key={segment.key}
                  className={index > 0 ? `${s.seg} ${s.segGap}` : s.seg}
                  style={{ width: `${segment.width}%`, background: segment.color }}
                />
              ))}
            </span>
            {item.band ? (
              <span
                className={s.moe}
                style={{
                  left: `${item.band.from}%`,
                  width: `${Math.max(0, item.band.to - item.band.from)}%`,
                }}
                aria-hidden="true"
              />
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
