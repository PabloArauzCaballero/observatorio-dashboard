'use client';

import { useMemo, useState } from 'react';
import { EXPORT_WORDS, GrowthWorldMap, IMPORT_WORDS, growthRows } from './growth-world-map';
import { TradeCountryCard } from './trade-country-card';
import { useTradeViews } from './trade-records-fetch';
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
 * - **Nivel o crecimiento.** El mismo mundo, pintado por cuánto se comerció
 *   en el periodo o por cuánto cambió el último año frente al anterior. Sólo
 *   se compara el año final del rango con el previo: «2016-2025 frente a
 *   2006-2015» no lo pide nadie, y un «2025 frente a 2016» esconde el camino.
 * - **Lo que no se puede dibujar se dice.** Importaciones por país no traen
 *   departamento ni mes: con esos filtros la vista no tiene respuesta y se da
 *   el motivo en vez de un mapa vacío. La «Zona Franca de Bolivia» y los «No
 *   declarados» no son países con contorno y se cuentan aparte.
 */

type Measure = 'usd' | 'kg';
type Mode = 'level' | 'growth';

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
  growth,
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
  /** Para el modo crecimiento: la dirección de un año con los mismos filtros. */
  growth: {
    url: (year: number) => string;
    /** El primer año con datos: antes no hay con qué comparar. */
    first: number;
    /** «enero-julio» cuando los dos años se recortan a los meses publicados. */
    period: string | null;
  };
  country: Choice;
  /** El país cuya ficha se abre debajo, o `null` si no hay ninguno elegido. */
  focus: string | null;
  nameOf: (code: string) => string;
  onPick: (members: string[], additive: boolean, label: string) => void;
}) {
  const [measure, setMeasure] = useState<Measure>('usd');
  const [mode, setMode] = useState<Mode>('level');
  const map = useMemo(() => countryMap(view?.items ?? [], measure), [view, measure]);

  const comparable = to - 1 >= growth.first;
  const showGrowth = mode === 'growth' && comparable;
  const now = useTradeViews(showGrowth ? growth.url(to) : null);
  const before = useTradeViews(showGrowth ? growth.url(to - 1) : null);
  const nowView = now.views?.mapa;
  const beforeView = before.views?.mapa;
  const growthMap = useMemo(
    () =>
      growthRows(
        countryMap(nowView?.items ?? [], measure).rows,
        countryMap(beforeView?.items ?? [], measure).rows,
      ),
    [nowView, beforeView, measure],
  );
  const growthUnavailable = nowView?.unavailable ?? beforeView?.unavailable;

  const subject =
    flow === 'X' ? 'exportaciones por país de destino' : 'importaciones por país de origen';
  const value = flow === 'X' ? 'FOB' : 'CIF en frontera';
  const unit = measure === 'usd' ? 'MM USD' : 'mil t';
  const what = measure === 'usd' ? `valor ${value}` : flow === 'X' ? 'peso neto' : 'peso bruto';
  const years = `${from}-${to}${period ? `, ${period}` : ''}`;
  const compared = `${to} frente a ${to - 1}${growth.period ? `, ${growth.period}` : ''}`;
  const unplaced = map.unplaced.reduce((sum, row) => sum + row.value, 0);

  const pick = (token: string, additive: boolean) => {
    const row =
      map.rows.find((entry) => entry.token === token) ??
      growthMap.find((entry) => entry.token === token);
    onPick(row ? [...row.members] : [token], additive, row?.label ?? nameOf(token));
  };

  return (
    <>
      <Panel
        id="aduana-mapa"
        title={
          showGrowth
            ? `Crecimiento de las ${subject} (variación % del ${
                measure === 'usd' ? 'valor' : 'peso'
              }, ${compared})`
            : `Mapa de ${subject} (${
                measure === 'usd' ? 'millones de USD' : 'miles de toneladas'
              }, ${years})`
        }
        lede={
          showGrowth
            ? `Cada país según ${
                flow === 'X' ? 'compró' : 'le vendió a Bolivia'
              } más o menos en ${to} que en ${to - 1}, en ${what}${
                growth.period ? ` de ${growth.period} (los meses publicados de ${to})` : ''
              }. Rayados, los que aparecen o desaparecen. La cifra exacta, al pasar sobre el país.`
            : `Cuanto más intenso el tono, mayor el ${what} acumulado en el periodo con cada país.`
        }
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
          {comparable ? (
            <div className="chart-kind" role="group" aria-label="Qué pinta el mapa">
              {(
                [
                  ['level', 'Nivel'],
                  ['growth', `Crecimiento ${to} frente a ${to - 1}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={mode === key ? 'chip chip-on' : 'chip'}
                  aria-pressed={mode === key}
                  onClick={() => setMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
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

        {showGrowth ? (
          growthUnavailable ? (
            <div className="callout">{growthUnavailable}</div>
          ) : now.failed || before.failed ? (
            <div className="callout">No fue posible leer los dos años que compara el mapa.</div>
          ) : !nowView || !beforeView ? (
            <div className="callout">
              Leyendo {to} y {to - 1}…
            </div>
          ) : !growthMap.length ? (
            <div className="callout">
              Sin comercio declarado con estos filtros ni en {to} ni en {to - 1}.
            </div>
          ) : (
            <GrowthWorldMap
              rows={growthMap}
              unit={unit}
              year={to}
              words={flow === 'X' ? EXPORT_WORDS : IMPORT_WORDS}
              label={`crecimiento de las ${
                flow === 'X' ? 'exportaciones' : 'importaciones'
              } de Bolivia por país, ${compared}`}
              picked={country}
              onPick={pick}
              exact={smart}
            />
          )
        ) : view?.unavailable ? (
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

        {!showGrowth && map.unplaced.length ? (
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
            En «Crecimiento», cada país va en una de dos clases —creció o cayó frente al año
            anterior— y no en una escala, porque en porcentajes los países chicos dominarían el
            mapa. Un país rayado no tenía comercio en uno de los dos años: su variación no se
            expresa en porcentaje.
          </p>
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
