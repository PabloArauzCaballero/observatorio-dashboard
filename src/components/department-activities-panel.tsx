'use client';

import { useMemo, useState } from 'react';
import { ChartLegend, DivergingBars, ShareBars, WorldLines } from './charts';
import { indexBase, indexed, onOneAxis, trio } from './department-lines';
import { Icon } from './icons';
import { Panel } from '@/components/ui/panel';
import {
  ACTIVITY_GROUPS,
  activityMoves,
  activityName,
  activityStructure,
  activityValues,
  branchesOf,
  imputedBankShare,
} from '@/lib/department-activities';
import { placeName } from '@/lib/departments';
import type { DepartmentBoard } from '@/lib/departments-board';

/**
 * De qué vive un departamento, y no sólo cuánto produce.
 *
 * Es lo que le faltaba al capítulo. Las cuentas regionales contestan el tamaño
 * —«Tarija perdió un tercio de su economía»— y esa frase no se puede discutir
 * hasta saber qué perdió. El INE abre el producto de cada departamento en once
 * actividades y en las ramas de cinco de ellas, desde 1988, y con eso la misma
 * década se cuenta entera: lo que cayó fue el petróleo crudo y el gas natural,
 * que pasó del 36 % del producto tarijeño en 2005 al 21 % en 2024, mientras el
 * resto de su economía no se movía.
 *
 * **Tres figuras de estructura y tres de una actividad.** Arriba, el reparto
 * entero del departamento, su distancia con el país actividad por actividad y
 * cuánto creció de verdad cada una en la última década. Abajo, la actividad que
 * se elija, seguida en el tiempo contra Bolivia y contra Santa Cruz.
 *
 * **El denominador se iguala antes de comparar** y ese detalle decide la mitad
 * de las lecturas: el cuadro departamental reparte sobre el producto a precios
 * de mercado y el nacional sobre el valor agregado, que ya excluye los
 * impuestos indirectos. Sin igualarlo, cualquier departamento parece menos
 * industrial que el país por una razón puramente contable.
 */

/** Quién publica el producto de cada departamento abierto por actividad. */
const SOURCE =
  'Instituto Nacional de Estadística (INE), cuentas regionales por actividad económica';

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const signed = (value: number, decimals = 1): string =>
  `${value > 0 ? '+' : ''}${number(value, decimals)}`;

export function DepartmentActivities({ board, place }: { board: DepartmentBoard; place: string }) {
  const name = placeName(place);
  const year = board.activityYear ?? null;
  /*
   * El tablero y el núcleo se despliegan por separado, así que este componente
   * puede recibir un tablero armado por una versión anterior, sin el corpus por
   * actividad dentro. Sin este respaldo la página entera se cae con un
   * «cannot read properties of undefined» en vez de enseñar el capítulo que sí
   * tiene: es exactamente el fallo que la ruta evita devolviendo `null` cuando
   * no reconoce un código.
   */
  const activities = board.activities ?? {};

  const structure = useMemo(
    () => activityStructure(activities, place, year),
    [activities, place, year],
  );
  const country = useMemo(() => activityStructure(activities, 'BOLIVIA', year), [activities, year]);
  const moves = useMemo(() => activityMoves(activities, place, year), [activities, place, year]);
  const imputed = useMemo(
    () => imputedBankShare(activities, place, year),
    [activities, place, year],
  );

  /*
   * La actividad que más pesa abre el panel. Empezar por la primera del
   * catálogo habría abierto siempre en agricultura, que en La Paz o en Oruro no
   * es la lectura; abrir por la mayor hace que la figura de abajo hable de lo
   * que la de arriba acaba de señalar.
   */
  const [chosen, setChosen] = useState<string>('');
  const biggest = [...structure].sort((left, right) => right.value - left.value).at(0);
  const shown = chosen || (biggest?.slug ?? ACTIVITY_GROUPS[0]?.slug ?? '');
  const branches = branchesOf(shown);

  const weight = useMemo(
    () => onOneAxis(trio((one) => activityValues(activities, 'SHARE', one, shown), place)),
    [activities, place, shown],
  );
  const growth = useMemo(
    () => onOneAxis(trio((one) => activityValues(activities, 'GROWTH', one, shown), place)),
    [activities, place, shown],
  );
  const size = useMemo(() => {
    const raw = trio((one) => activityValues(activities, 'VALUE', one, shown), place);
    return { chart: onOneAxis(indexed(raw)), base: indexBase(raw) };
  }, [activities, place, shown]);

  const gap = useMemo(() => {
    const byCountry = new Map(country.map((slice) => [slice.slug, slice.value]));
    return structure
      .map((slice) => ({
        name: slice.name,
        value: slice.value - (byCountry.get(slice.slug) ?? 0),
        meta: `${number(slice.value)} % en ${name}, ${number(byCountry.get(slice.slug) ?? 0)} % en Bolivia`,
      }))
      .filter((row) => Number.isFinite(row.value));
  }, [structure, country, name]);

  if (!structure.length) {
    return (
      <div className="callout">
        Todavía no hay cuadros por actividad económica cargados para {name}. La sección se completa
        cuando la base incorpora los cuadros del INE.
      </div>
    );
  }

  const shownName = activityName(shown).toLocaleLowerCase('es');
  /** ¿La actividad elegida es una de las barras? Entonces el gráfico la resalta y callan las demás. */
  const marked = structure.some((slice) => slice.slug === shown);

  return (
    <>
      <section className="panel-group" aria-labelledby="dep-act-estructura-titulo">
        <header className="panel-group-head">
          <h3 id="dep-act-estructura-titulo">Estructura productiva de {name}</h3>
          <p>
            El INE desagrega el producto departamental en once actividades económicas desde 1988.
            Las figuras muestran el reparto del producto, la distancia con la estructura nacional y
            el crecimiento real de cada actividad en la última década.
          </p>
        </header>

        <div className="grid-three">
          <Panel
            id="dep-act-reparto"
            title={`Reparto del producto de ${name} por actividad (% del producto, ${year ?? '—'})`}
            lede={`Peso de cada actividad en el producto del departamento; las once suman 100. Los servicios bancarios imputados —el cobro que los bancos no facturan y que la contabilidad resta${
              imputed === null ? '' : ` (${number(Math.abs(imputed))} % del producto de ${name})`
            }— quedan fuera del reparto porque son un descuento, no una actividad.`}
            source={SOURCE}
          >
            <ShareBars
              data={structure.map((slice) => ({
                name: slice.name,
                value: slice.value,
                pick: slice.slug,
                emphasis: slice.slug === shown,
              }))}
              unit=" %"
              height={300}
              onPick={(pick) => setChosen(pick)}
            />
            <ChartLegend
              items={
                marked
                  ? [
                      { color: 'var(--official)', label: `${activityName(shown)} (seleccionada)` },
                      { color: 'var(--series-rest)', label: 'Las demás actividades' },
                    ]
                  : [{ color: 'var(--official)', label: 'Peso en el producto (%)' }]
              }
            />
          </Panel>

          <Panel
            id="dep-act-distancia"
            title={`Distancia de ${name} con Bolivia, por actividad (puntos porcentuales, ${year ?? '—'})`}
            lede="Diferencia entre el peso de cada actividad en el departamento y en Bolivia. El denominador se iguala: el cuadro departamental reparte sobre el producto a precios de mercado y el nacional, sobre el valor agregado. Sin ese ajuste, cualquier departamento parecería menos industrial que el país."
            source={`${SOURCE}; cálculo de DatosBolivia.com`}
          >
            <DivergingBars data={gap} unit="puntos" height={300} />
          </Panel>

          <Panel
            id="dep-act-crecimiento-acumulado"
            title={`Crecimiento real por actividad en ${name} (${moves.at(0)?.from ?? '—'}–${
              moves.at(0)?.to ?? '—'
            }, % acumulado)`}
            lede="Variación acumulada del valor de cada actividad a precios constantes de 1990. Se mide sobre el nivel y no sobre el reparto, que suma siempre 100: una actividad puede ganar peso sin crecer si otra cae."
            source={`${SOURCE}; cálculo de DatosBolivia.com`}
          >
            <DivergingBars
              data={moves.map((row) => ({
                name: row.name,
                value: row.change,
                meta: `${signed(row.change)} % entre ${row.from} y ${row.to}`,
              }))}
              unit="%"
              height={300}
            />
          </Panel>
        </div>
      </section>

      <section className="panel-group" aria-labelledby="dep-act-elegida-titulo">
        <header className="panel-group-head">
          <h3 id="dep-act-elegida-titulo">{activityName(shown)}</h3>
          <p>
            Las tres figuras siguen la actividad seleccionada en {name}, Santa Cruz y Bolivia.
            Cuando el INE desagrega el grupo aparecen sus ramas, que distinguen, por ejemplo, el gas
            del mineral dentro de «minas y canteras». La actividad se selecciona con los botones o
            con una barra del reparto.
          </p>

          <div className="chips" role="group" aria-label="Actividad económica">
            {ACTIVITY_GROUPS.map((one) => (
              <button
                key={one.slug}
                type="button"
                aria-pressed={one.slug === shown}
                className={one.slug === shown ? 'chip chip-on' : 'chip'}
                onClick={() => setChosen(one.slug)}
              >
                {one.name}
              </button>
            ))}
          </div>

          {branches.length ? (
            <div className="chips" role="group" aria-label="Rama de la actividad">
              {branches.map((one) => (
                <button
                  key={one.slug}
                  type="button"
                  aria-pressed={one.slug === shown}
                  className={one.slug === shown ? 'chip chip-on' : 'chip'}
                  onClick={() => setChosen(one.slug)}
                >
                  <Icon name="capas" size={12} /> {one.name}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <div className="grid-three">
          <Panel
            id="dep-act-peso"
            title={`Peso de ${shownName} en la economía (% del producto)`}
            lede="Participación anual de la actividad en el producto. Un descenso sostenido en una línea, con las demás estables, indica un cambio en la estructura productiva de ese lugar."
            source={SOURCE}
          >
            {weight.data.length > 1 ? (
              <WorldLines
                data={weight.data}
                series={weight.series}
                format={(value) => `${number(value)} %`}
                tick={(value) => number(value, 0)}
              />
            ) : (
              <div className="callout">El INE no publica esta actividad para {name}.</div>
            )}
          </Panel>

          <Panel
            id="dep-act-crecimiento-anual"
            title={`Crecimiento anual de ${shownName} (% anual)`}
            lede="Variación anual que publica el INE sobre el nivel a precios constantes de 1990. Cuando el cuadro nacional publica solo las ramas del grupo, la línea de Bolivia se calcula sobre el nivel sumado de esas ramas, porque sumar variaciones no da la variación de la suma."
            source={SOURCE}
          >
            {growth.data.length > 1 ? (
              <WorldLines
                data={growth.data}
                series={growth.series}
                format={(value) => `${signed(value)} %`}
                tick={(value) => number(value, 0)}
              />
            ) : (
              <div className="callout">Sin variación publicada para esta actividad.</div>
            )}
          </Panel>

          <Panel
            id="dep-act-tamano"
            title={`Tamaño real de ${shownName} (índice, ${size.base ?? '—'} = 100)`}
            lede="Valor de la actividad a precios constantes de 1990, en índice y no en Bs: el total nacional suma los nueve departamentos y, en su escala, uno pequeño quedaría pegado al eje."
            source={SOURCE}
          >
            {size.chart.data.length > 1 ? (
              <WorldLines
                data={size.chart.data}
                series={size.chart.series}
                format={(value) => number(value)}
                tick={(value) => number(value, 0)}
              />
            ) : (
              <div className="callout">Sin nivel publicado para esta actividad.</div>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}
