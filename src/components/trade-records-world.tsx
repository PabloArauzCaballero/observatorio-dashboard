'use client';

import { useMemo, useState } from 'react';
import { TradeCountryCard } from './trade-country-card';
import { SOURCE_ADUANA, say } from './trade-records-panels';
import { WorldTradeMap } from './world-trade-map';
import { Panel } from '@/components/ui/panel';
import type { Choice } from '@/lib/choice';
import { countryMap, sameOutline } from '@/lib/trade-countries';
import type { TradeView } from '@/lib/trade-records';

/**
 * El mundo de la base aduanera: el mismo mapa de calor de «Comercio exterior»,
 * con lo que cambia cuando el dato es la declaración del INE y no el agregado
 * de Comtrade.
 *
 * - **Están todos los países**, no los veinte principales: el gris dice «sin
 *   comercio declarado con estos filtros», y es una afirmación sobre la base.
 * - **Se cruza con lo demás.** El mapa respeta el producto, la sección, el
 *   departamento y los meses que el lector eligió, y sólo suelta el filtro de
 *   país (como cada ránking: para ver las alternativas). Elegir el litio pinta
 *   a quién se le vende litio.
 * - **Valor o peso.** Cada declaración trae el peso, y un país que compra poco
 *   valor y mucha carga —minerales a granel— se ve distinto en toneladas.
 * - **Lo que no se puede dibujar se dice.** Importaciones por país no traen
 *   departamento ni mes: con esos filtros la vista no tiene respuesta y se da
 *   el motivo en vez de un mapa vacío. La «Zona Franca de Bolivia» y los «No
 *   declarados» no son países con contorno y se cuentan aparte.
 */

type Measure = 'usd' | 'kg';

/** Más decimales donde la cifra es chica: un país de 0,004 MM USD no es «0». */
const smart = (value: number): string => say(value, value >= 100 ? 0 : value >= 1 ? 1 : 3);

const MEASURES: ReadonlyArray<{ by: Measure; label: string }> = [
  { by: 'usd', label: 'Valor' },
  { by: 'kg', label: 'Peso' },
];

export function TradeWorld({
  flow,
  onFlow,
  view,
  from,
  to,
  period,
  country,
  focus,
  nameOf,
  onPick,
}: {
  flow: 'X' | 'M';
  onFlow: (flow: 'X' | 'M') => void;
  /** La vista por país, ya recortada por todos los filtros menos el de país. */
  view: TradeView | undefined;
  from: number;
  to: number;
  /** «enero-julio» cuando el lector comparó el mismo periodo de cada año. */
  period: string | null;
  country: Choice;
  /** El país cuya ficha se abre debajo, o `null` si no hay ninguno elegido. */
  focus: string | null;
  nameOf: (code: string) => string;
  onPick: (members: string[], additive: boolean, label: string) => void;
}) {
  const [measure, setMeasure] = useState<Measure>('usd');
  const map = useMemo(() => countryMap(view?.items ?? [], measure), [view, measure]);

  const subject =
    flow === 'X' ? 'exportaciones por país de destino' : 'importaciones por país de origen';
  const value = flow === 'X' ? 'FOB' : 'CIF en frontera';
  const unit = measure === 'usd' ? 'MM USD' : 'mil t';
  const what = measure === 'usd' ? `valor ${value}` : flow === 'X' ? 'peso neto' : 'peso bruto';
  const years = `${from}-${to}${period ? `, ${period}` : ''}`;
  const unplaced = map.unplaced.reduce((sum, row) => sum + row.value, 0);

  const pick = (token: string, additive: boolean) => {
    const row = map.rows.find((entry) => entry.token === token);
    onPick(row?.members ?? [token], additive, row?.label ?? nameOf(token));
  };

  return (
    <>
      <Panel
        id="aduana-mapa"
        title={`Mapa de ${subject} (${
          measure === 'usd' ? 'millones de USD' : 'miles de toneladas'
        }, ${years})`}
        lede={`Cuanto más intenso el tono, mayor el ${what} acumulado en el periodo con cada país.`}
        source={SOURCE_ADUANA}
      >
        <div className="fx-filters">
          <div className="chart-kind" role="group" aria-label="Flujo representado en el mapa">
            {(
              [
                ['X', 'Exportaciones'],
                ['M', 'Importaciones'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={flow === key ? 'chip chip-on' : 'chip'}
                aria-pressed={flow === key}
                onClick={() => onFlow(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="chart-kind" role="group" aria-label="Medida del mapa">
            {MEASURES.map((option) => (
              <button
                key={option.by}
                type="button"
                className={measure === option.by ? 'chip chip-on' : 'chip'}
                aria-pressed={measure === option.by}
                onClick={() => setMeasure(option.by)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {view?.unavailable ? (
          <div className="callout">{view.unavailable}</div>
        ) : !map.rows.length ? (
          <div className="callout">Sin comercio declarado con estos filtros.</div>
        ) : (
          <WorldTradeMap
            rows={map.rows}
            unit={unit}
            label={`${flow === 'X' ? 'exportaciones' : 'importaciones'} de Bolivia por país, ${years}`}
            picked={country}
            onPick={pick}
            absent="sin comercio declarado con estos filtros"
            absentKey="sin comercio declarado"
            format={smart}
            exact={smart}
          />
        )}

        {map.unplaced.length ? (
          <p className="chart-note">
            No figura en el mapa por no ser un territorio con contorno:{' '}
            {map.unplaced
              .slice(0, 3)
              .map((row) => `${row.label} (${smart(row.value)} ${unit})`)
              .join(', ')}
            {map.unplaced.length > 3 ? ` y ${map.unplaced.length - 3} más` : ''}
            {map.unplaced.length > 1 ? `; en total ${smart(unplaced)} ${unit}` : ''}. Sí se incluye
            en las clasificaciones y en las cifras clave.
          </p>
        ) : null}

        {focus ? null : (
          <p className="chart-note">
            Al seleccionar un país en el mapa o en el filtro se abre su ficha: el comercio en el
            tiempo, los productos exportados e importados y los departamentos de origen.
          </p>
        )}

        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            La escala bajo el mapa indica qué extremo corresponde al mayor valor. Figuran todos los
            países que nombra la declaración aduanera, no solo los principales: el gris significa
            «sin comercio declarado con estos filtros». El mapa aplica el producto, el departamento
            y los meses elegidos, pero no el filtro de país. Al seleccionar un país se añade al
            filtro; con Ctrl/⌘ se suman varios.
          </p>
        </details>
      </Panel>

      {focus ? (
        <TradeCountryCard
          key={sameOutline(focus).join('-')}
          name={nameOf(focus)}
          countries={sameOutline(focus)}
          from={from}
          to={to}
        />
      ) : null}
    </>
  );
}
