'use client';

import { useEffect, useState } from 'react';
import { ShareBars } from './charts';
import { BarsKey } from './chart-kind';
import { Icon } from './icons';
import { Panel } from '@/components/ui/panel';
import type { Choice } from '@/lib/choice';
import type { TradeItem, TradeView } from '@/lib/trade-records';

/**
 * Las piezas que dibujan una vista de la base aduanera.
 *
 * Separadas del explorador porque no saben nada de filtros ni de la API:
 * reciben filas ya sumadas y dicen qué hacer cuando el lector toca una.
 */

/** Quién publica la base aduanera: el pie de cada panel de esta página. */
export const SOURCE_ADUANA =
  'Instituto Nacional de Estadística (INE), base aduanera de comercio exterior';

const formatter = (decimals: number) =>
  new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const say = (value: number, decimals = 1): string => formatter(decimals).format(value);

/**
 * Cuántas letras caben en el rótulo de una barra. El eje de nombres se mide
 * solo (`width="auto"`) y con rótulos de sesenta letras en un teléfono se lleva
 * todo el ancho: las barras quedan en cero píxeles. El nombre entero sigue en
 * el emergente y en la tabla.
 */
export function useLabelRoom(): number {
  const [room, setRoom] = useState(58);
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 640px)');
    const update = () => setRoom(narrow.matches ? 22 : 58);
    update();
    narrow.addEventListener('change', update);
    return () => narrow.removeEventListener('change', update);
  }, []);
  return room;
}

/** Millones de dólares con un decimal; los montos chicos no se redondean a cero. */
export const millions = (usd: number): string =>
  Math.abs(usd) >= 100_000 ? say(usd / 1_000_000, 1) : say(usd / 1_000_000, 3);

export const change = (last: number | null, prior: number | null): number | null =>
  last !== null && prior !== null && prior > 0 ? (last / prior - 1) * 100 : null;

function Change({ value }: { value: number | null }) {
  if (value === null) return <td className="num">—</td>;
  const sign = value > 0 ? '+' : '';
  return (
    <td className="num" style={{ color: value >= 0 ? 'var(--up)' : 'var(--down)' }}>
      {sign}
      {say(value, 1)} %
    </td>
  );
}

export interface Headline {
  label: string;
  value: string;
  hint: string;
}

export function Headlines({ items }: { items: readonly Headline[] }) {
  return (
    <div className="stat-strip">
      {items.map((item) => (
        <div className="stat" key={item.label}>
          <span className="stat-label">{item.label}</span>
          <span className="stat-value">{item.value}</span>
          <span className="stat-hint">{item.hint}</span>
        </div>
      ))}
    </div>
  );
}

/** El texto de la unidad de peso, según el flujo: neto en exportación, bruto en importación. */
export const weightName = (flow: 'X' | 'M'): string => (flow === 'X' ? 'peso neto' : 'peso bruto');

/**
 * Un ránking: barras que filtran al tocarlas, o la tabla con variación y
 * valor unitario. La tabla es la misma información con más columnas, para
 * quien necesita la cifra y no la forma.
 *
 * Es un `Panel`: su menú «Descargar» baja las filas completas de la vista —valor,
 * participación, último año, año previo, peso y valor unitario—, con el filtro
 * escrito en la nota del archivo. Era el botón «Descargar CSV» de la cabecera de
 * la página, que bajaba todas las vistas juntas; ahora cada panel baja la suya.
 */
export function RankingPanel({
  id,
  title,
  lede,
  note,
  view,
  chosen,
  onPick,
  flow,
  lastYear,
  controls,
  context,
}: {
  id: string;
  title: string;
  lede: string;
  /** La lectura detallada, plegada bajo la figura. */
  note?: string;
  view: TradeView | undefined;
  chosen: Choice;
  onPick?: (key: string, additive: boolean) => void;
  flow: 'X' | 'M';
  lastYear: number;
  controls?: React.ReactNode;
  /** Qué periodo y qué filtros recortan la vista, para la nota del archivo que se baja. */
  context: string;
}) {
  const [kind, setKind] = useState<'barras' | 'tabla'>('barras');
  const room = useLabelRoom();
  const items = view?.items ?? [];
  const total = items.reduce((sum, item) => sum + item.usd, 0);
  const fine = flow === 'X' && items.some((item) => (item.fineKg ?? 0) > 0);
  const toMillions = (usd: number | null): number | null => (usd === null ? null : usd / 1_000_000);

  return (
    <Panel
      id={id}
      title={title}
      lede={lede}
      source={SOURCE_ADUANA}
      data={() => ({
        etiqueta: 'Detalle',
        unidad: 'millones de USD',
        columnas: [
          'Nombre',
          'Código',
          'Valor (millones de USD)',
          'Participación (%)',
          `Valor ${lastYear} (millones de USD)`,
          `Valor ${lastYear - 1} (millones de USD)`,
          `Peso (toneladas, ${weightName(flow)})`,
          'USD por kg',
          ...(fine ? ['Toneladas finas'] : []),
        ],
        filas: items.map((item) => [
          item.label,
          item.key ?? '',
          toMillions(item.usd),
          total ? (item.usd / total) * 100 : null,
          toMillions(item.lastUsd),
          toMillions(item.priorUsd),
          item.kg / 1000,
          item.kg > 0 ? item.usd / item.kg : null,
          ...(fine ? [(item.fineKg ?? 0) / 1000] : []),
        ]),
        nota: context,
      })}
    >
      <div className="fx-filters">
        {controls}
        <div className="chart-kind" role="group" aria-label="Cómo se muestra">
          {(['barras', 'tabla'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={option === kind ? 'chip chip-on' : 'chip'}
              aria-pressed={option === kind}
              onClick={() => setKind(option)}
            >
              <Icon name={option === 'barras' ? 'barras' : 'capas'} size={13} />
              {option === 'barras' ? 'Barras' : 'Tabla'}
            </button>
          ))}
        </div>
      </div>
      {view?.unavailable ? (
        <div className="callout">{view.unavailable}</div>
      ) : !items.length ? (
        <div className="callout">Sin comercio declarado con estos filtros.</div>
      ) : kind === 'barras' ? (
        <>
          <ShareBars
            data={items.map((item) => ({
              name: item.label.length > room ? `${item.label.slice(0, room - 1)}…` : item.label,
              value: item.usd / 1_000_000,
              ...(item.key && onPick ? { pick: item.key } : {}),
              ...(item.key && chosen.has(item.key) ? { emphasis: true } : {}),
              parts: [
                {
                  name: 'Participación en lo dibujado',
                  value: total ? (item.usd / total) * 100 : 0,
                  unit: '%',
                },
                { name: `Toneladas (${weightName(flow)})`, value: item.kg / 1000 },
              ],
            }))}
            unit=" M USD"
            height={Math.max(240, items.length * 24)}
            {...(onPick ? { onPick } : {})}
          />
          <BarsKey label={`Valor ${flow === 'X' ? 'FOB' : 'CIF en frontera'}, millones de USD`} />
        </>
      ) : (
        <RankingTable items={items} total={total} flow={flow} lastYear={lastYear} />
      )}
      {note ? (
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>{note}</p>
        </details>
      ) : null}
    </Panel>
  );
}

export function RankingTable({
  items,
  total,
  flow,
  lastYear,
}: {
  items: readonly TradeItem[];
  total: number;
  flow: 'X' | 'M';
  lastYear: number;
}) {
  const fine = flow === 'X' && items.some((item) => (item.fineKg ?? 0) > 0);
  return (
    <div className="table-wrap">
      <table className="grid-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th className="num">Millones de USD</th>
            <th className="num">Participación</th>
            <th className="num">Millones de USD {lastYear}</th>
            <th className="num">vs. {lastYear - 1}</th>
            <th className="num">Toneladas ({weightName(flow)})</th>
            <th className="num">USD por kg</th>
            {fine ? <th className="num">Toneladas finas</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key ?? 'sin'}>
              <td>{item.label}</td>
              <td className="num">
                <b>{millions(item.usd)}</b>
              </td>
              <td className="num">{total ? say((item.usd / total) * 100, 1) : '—'} %</td>
              <td className="num">{item.lastUsd === null ? '—' : millions(item.lastUsd)}</td>
              <Change value={change(item.lastUsd, item.priorUsd)} />
              <td className="num">{say(item.kg / 1000, 0)}</td>
              <td className="num">{item.kg > 0 ? say(item.usd / item.kg, 2) : '—'}</td>
              {fine ? <td className="num">{say((item.fineKg ?? 0) / 1000, 1)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
