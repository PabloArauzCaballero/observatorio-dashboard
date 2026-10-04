'use client';

import { useMemo, useState } from 'react';
import { ChartLegend, MacroChart, ShareBars, WorldLines, seriesTone } from './charts';
import { DepartmentActivities } from './department-activities-panel';
import { BENCHMARK, indexBase, indexed, onOneAxis, trio } from './department-lines';
import type { NamedLine } from './department-lines';
import { DepartmentsMap } from './departments-map';
import { DerivedReading } from './derived-reading';
import type { IconName } from './icons';
import { Panel } from '@/components/ui/panel';
import { TabHeader } from '@/components/ui/tab-header';
import { DEPARTMENTS, MEASURES, placeName } from '@/lib/departments';
import type { Measure } from '@/lib/departments';
import { placeRank, productMix, topProducts } from '@/lib/departments-board';
import type { DepartmentBoard, ProductLine, YearValue } from '@/lib/departments-board';
import { useSinceYear } from './year-floor';

/**
 * Bolivia por departamento, dibujada.
 *
 * El capítulo tiene una sola idea de navegación: **se toca un departamento en
 * el mapa y todo lo de abajo habla de él**. Es lo contrario de lo que hace el
 * resto del informe, donde se elige un indicador y se comparan países, y la
 * diferencia no es capricho: aquí el lector no llega preguntando «cuánto creció
 * el PIB» sino «qué pasa en Tarija», y un selector de indicadores le obligaría
 * a recorrer seis figuras para reunir la respuesta que quería.
 *
 * El mapa hace dos cosas a la vez. Es el selector —nueve formas que se tocan,
 * en vez de nueve fichas en fila— y es la primera figura: pintado por la
 * medida que se elija arriba, enseña el reparto entero antes de que nadie
 * elija nada. Un 30 % de participación no significa nada hasta ver que el
 * siguiente es 22 y el último 0,8, y en el mapa eso se ve sin leer un número.
 *
 * Debajo, cuando hay un departamento elegido, va **todo lo que el INE publica
 * de él**: las seis medidas de cuentas regionales con su serie entera desde
 * 1988, cada una al lado de la mediana de los nueve y —donde la escala lo
 * permite— de la fila de Bolivia; y lo que vende afuera, producto por producto,
 * en dólares y en toneladas. Nada de esto se carga en la portada: el tablero
 * llega cuando alguien abre el rubro.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const CONCLUSION_ICON: Record<string, IconName> = {
  concentracion: 'mapa',
  ganador: 'tendencia',
  perdedor: 'balanza',
  exportador: 'camion',
  rubro: 'fabrica',
  hundida: 'area',
};

/** Quién publica las cuentas regionales y el comercio exterior de cada departamento. */
const SOURCE_ACCOUNTS = 'Instituto Nacional de Estadística (INE), cuentas regionales';
const SOURCE_TRADE = 'Instituto Nacional de Estadística (INE), comercio exterior por departamento';

/** Las seis medidas de cuentas regionales; las otras dos son comercio. */
const ACCOUNTS = MEASURES.filter((one) => !one.slug.startsWith('EXPORTS_'));

/** La medida con la que se pinta el mapa cuando nadie ha elegido otra. */
const DEFAULT_MEASURE = 'GDP_SHARE';

/**
 * Las medidas que se dibujan en índice y no en su unidad.
 *
 * Un crecimiento, un índice de precios o un producto por habitante se comparan
 * con el país de tú a tú. Un nivel en bolivianos o en dólares no: la fila del
 * país es la suma de los nueve, así que en su escala Pando es una raya pegada
 * al cero. Llevarlas a índice con el primer año común valiendo cien deja las
 * tres líneas legibles y cambia la pregunta por la que de verdad se hace —quién
 * creció más—; la cifra en su unidad sigue en la ficha y en la tabla.
 */
const AS_INDEX = new Set(['GDP_CONSTANT', 'GDP_CURRENT', 'EXPORTS_USD', 'EXPORTS_TONNES']);

/**
 * La participación no lleva la línea del país: es cien por definición.
 *
 * Dibujar una recta en cien al lado de dos series que valen entre uno y treinta
 * aplasta las dos contra el eje para decir algo que ya dice el título.
 */
const WITHOUT_COUNTRY = new Set(['GDP_SHARE']);

/** Con qué fila cierra el país cada corpus: el comercio no la llama «Bolivia». */
const countryKey = (measure: string): string | false =>
  WITHOUT_COUNTRY.has(measure) ? false : measure.startsWith('EXPORTS_') ? 'NATIONAL' : 'BOLIVIA';

/** Cuántos productos se siguen en el tiempo. Más de cinco líneas no se leen. */
const TOP = 5;

const measureOf = (slug: string): Measure | undefined => MEASURES.find((one) => one.slug === slug);

const last = (values: readonly YearValue[] | undefined): YearValue | undefined => values?.at(-1);

const at = (values: readonly YearValue[] | undefined, year: number): YearValue | undefined =>
  values?.find((point) => point.year === year);

/**
 * Una medida del departamento elegido, contra Santa Cruz y contra el país.
 *
 * Tres líneas y siempre las mismas tres. Antes eran las nueve con la elegida
 * resaltada, y eso tenía dos problemas: nueve líneas no se leen, y elegir un
 * departamento no cambiaba nada de lo que había en pantalla. Las tres de ahora
 * son las que contestan la pregunta que se hace delante de una cifra
 * departamental —cuánto es eso en el país, cuánto en la economía más grande y
 * cuánto aquí— y `department-lines.ts` explica por qué Santa Cruz y no la
 * mediana.
 */
function compare(board: DepartmentBoard, measure: string, place: string) {
  const byPlace = board.series[measure] ?? {};
  const lines = trio((one) => byPlace[one] ?? [], place, { country: countryKey(measure) });
  const scaled = AS_INDEX.has(measure) ? indexed(lines) : lines;
  return {
    ...onOneAxis(scaled),
    base: AS_INDEX.has(measure) ? indexBase(lines) : null,
    drawn: lines.map((line) => line.label),
  };
}

/**
 * «Tarija, Santa Cruz y Bolivia», o las dos que queden.
 *
 * El título nombra las líneas que hay, no las que debería haber: en la
 * participación el país no entra —es cien por definición— y con Santa Cruz
 * elegida no hay vara que dibujar. Un título que prometiera tres series y
 * dibujara dos sería un error de lectura, no de redacción.
 */
const listed = (names: readonly string[]): string =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : (names[0] ?? '');

/** Los productos principales de un departamento, en el tiempo, en una unidad. */
function productLines(lines: readonly ProductLine[], unit: 'usd' | 'tonnes') {
  return onOneAxis(
    lines.map((line, index) => ({
      key: line.slug,
      label: line.label,
      values: line[unit],
      tone: seriesTone(index),
    })),
  );
}

const ordinal = (rank: { position: number; of: number }): string =>
  `${rank.position}.º de ${rank.of}`;

function Headline({
  board,
  measure,
  place,
}: {
  board: DepartmentBoard;
  measure: Measure;
  place: string;
}) {
  const point = last(board.series[measure.slug]?.[place]);
  const rank = placeRank(board, measure.slug, place);
  if (!point) return null;
  return (
    <div className="stat">
      <span className="stat-label">{measure.label}</span>
      <span className="stat-value">{number(point.value, measure.decimals)}</span>
      <span className="stat-hint">
        {measure.unit} · {point.year}
        {rank ? ` · ${ordinal(rank)}` : ''}
      </span>
    </div>
  );
}

/** Las seis medidas de cuentas regionales de un departamento, en su último año. */
function accountRows(board: DepartmentBoard, place: string) {
  return ACCOUNTS.flatMap((measure) => {
    const byPlace = board.series[measure.slug] ?? {};
    const own = last(byPlace[place]);
    if (!own) return [];
    return [
      {
        measure,
        own,
        bench: at(byPlace[BENCHMARK], own.year),
        country: at(byPlace['BOLIVIA'], own.year),
        rank: placeRank(board, measure.slug, place),
      },
    ];
  });
}

/**
 * Las seis medidas de cuentas regionales, en su último año, contra Santa Cruz y
 * contra el país.
 *
 * La tabla es donde la comparación con Bolivia cabe siempre y en su unidad: una
 * cifra al lado de otra no tiene el problema de escala que tiene una línea al
 * lado de otra, así que aquí no hace falta llevar nada a índice. Es el sitio
 * donde el nivel en bolivianos sigue escrito.
 */
function AccountsTable({ board, place }: { board: DepartmentBoard; place: string }) {
  return (
    <div className="table-wrap">
      <table className="grid-table">
        <thead>
          <tr>
            <th>Medida</th>
            <th className="num">{placeName(place)}</th>
            <th className="num">{placeName(BENCHMARK)}</th>
            <th className="num">Bolivia</th>
            <th className="num">Puesto</th>
            <th className="num">Año</th>
          </tr>
        </thead>
        <tbody>
          {accountRows(board, place).map(({ measure, own, bench, country, rank }) => (
            <tr key={measure.slug}>
              <td>
                {measure.label}
                <br />
                <span className="stat-hint">{measure.unit}</span>
              </td>
              <td className="num">
                <b>{number(own.value, measure.decimals)}</b>
              </td>
              <td className="num">{bench ? number(bench.value, measure.decimals) : '—'}</td>
              <td className="num">{country ? number(country.value, measure.decimals) : '—'}</td>
              <td className="num">{rank ? ordinal(rank) : '—'}</td>
              <td className="num">{own.year}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Lo que pesa cada barra de un reparto, dicho bajo el gráfico. */
const barsKey = (label: string) => <ChartLegend items={[{ color: 'var(--official)', label }]} />;

/**
 * La vista completa de un departamento: todo lo que el INE publica de él.
 *
 * Va aparte del explorador porque no existe hasta que hay un departamento
 * elegido, y porque son diez figuras y una tabla: mezclarlas con el mapa en un
 * solo cuerpo era un componente que nadie podía leer entero.
 */
function DepartmentDetail({
  board,
  place,
  measure,
}: {
  board: DepartmentBoard;
  place: string;
  /** La medida que pinta el mapa, para la figura que la sigue en el tiempo. */
  measure: Measure;
}) {
  const name = placeName(place);
  const compared = useMemo(() => compare(board, measure.slug, place), [board, measure, place]);
  const accounts = useMemo(
    () => ACCOUNTS.map((one) => ({ measure: one, ...compare(board, one.slug, place) })),
    [board, place],
  );
  const soldUsd = useMemo(() => productMix(board, place, board.tradeYear, 'usd'), [board, place]);
  const soldTonnes = useMemo(
    () => productMix(board, place, board.tradeYear, 'tonnes'),
    [board, place],
  );
  const leading = useMemo(() => topProducts(board, place, board.tradeYear, TOP), [board, place]);
  const leadingUsd = useMemo(() => productLines(leading, 'usd'), [leading]);
  const leadingTonnes = useMemo(() => productLines(leading, 'tonnes'), [leading]);

  const own = (slug: string) =>
    (board.series[slug]?.[place] ?? []).map((point) => ({
      period: String(point.year),
      value: point.value,
    }));
  const exportsUsd = own('EXPORTS_USD');
  const exportsTonnes = own('EXPORTS_TONNES');

  return (
    <>
      <Panel
        id="dep-resumen"
        title={`${name}: las ocho medidas del INE en su último año (cada una en su unidad)`}
        lede={`Las ocho cifras en su último año publicado, con el puesto que ocupa ${name} entre los nueve departamentos en ese mismo año. El per cápita cierra un año antes que las demás porque necesita la proyección de población.`}
        source={`${SOURCE_ACCOUNTS}; ${SOURCE_TRADE}`}
        data={() => ({
          columnas: ['Medida', 'Unidad', 'Año', 'Valor', 'Puesto entre los nueve'],
          filas: MEASURES.flatMap((one) => {
            const point = last(board.series[one.slug]?.[place]);
            if (!point) return [];
            const rank = placeRank(board, one.slug, place);
            return [[one.label, one.unit, point.year, point.value, rank ? ordinal(rank) : null]];
          }),
        })}
      >
        <div className="stat-strip">
          {MEASURES.map((one) => (
            <Headline key={one.slug} board={board} measure={one} place={place} />
          ))}
        </div>
      </Panel>

      <Panel
        id="dep-cuadro"
        title={`Las seis cuentas regionales de ${name}, ${placeName(BENCHMARK)} y Bolivia (cada una en su unidad)`}
        lede="La tabla es donde la comparación con el país cabe siempre y en su unidad: una cifra al lado de otra no tiene el problema de escala que tiene una línea al lado de otra. En participación la fila de Bolivia es cien por definición y en producto es la suma de las nueve, así que ahí la cifra del país sitúa al departamento pero no lo califica."
        source={SOURCE_ACCOUNTS}
        data={() => ({
          columnas: [
            'Medida',
            'Unidad',
            name,
            placeName(BENCHMARK),
            'Bolivia',
            'Puesto entre los nueve',
            'Año',
          ],
          filas: accountRows(board, place).map(
            ({ measure: one, own: mine, bench, country, rank }) => [
              one.label,
              one.unit,
              mine.value,
              bench?.value ?? null,
              country?.value ?? null,
              rank ? ordinal(rank) : null,
              mine.year,
            ],
          ),
        })}
      >
        <AccountsTable board={board} place={place} />
      </Panel>

      <Panel
        id="dep-medida-del-mapa"
        title={`${measure.label} de ${listed(compared.drawn)} (${
          compared.base === null ? measure.unit : `índice, ${compared.base} = 100`
        })`}
        lede="La medida que pinta el mapa, seguida en el tiempo. Tres líneas y no nueve: nueve es un peine en el que se ve que hay dispersión y no se ve ninguna de las nueve. Un año sin dato corta la línea en vez de unirla, porque unir dos años publicados afirmaría el de en medio, que nadie publicó."
        source={SOURCE_ACCOUNTS}
      >
        {compared.data.length > 1 ? (
          <WorldLines
            data={compared.data}
            series={compared.series}
            format={(value) => number(value, measure.decimals)}
            tick={(value) => number(value, 0)}
          />
        ) : null}
      </Panel>

      <div className="grid-three">
        {accounts.map(({ measure: one, data, series, base, drawn }) => (
          <Panel
            key={one.slug}
            id={`dep-cuenta-${one.slug.toLowerCase().replace(/_/g, '-')}`}
            title={`${one.label} de ${listed(drawn)} (${
              base === null ? one.unit : `índice, ${base} = 100`
            })`}
            lede={`${one.what}${
              base === null
                ? ''
                : ' Va en índice porque la fila del país es la suma de los nueve y en su escala un departamento chico no se ve; el nivel en su unidad está en la tabla de arriba.'
            }`}
            source={SOURCE_ACCOUNTS}
          >
            {data.length > 1 ? (
              <WorldLines
                data={data}
                series={series}
                format={(value) => number(value, one.decimals)}
                tick={(value) => number(value, 0)}
              />
            ) : (
              <div className="callout">Esta medida no tiene serie para {name}.</div>
            )}
          </Panel>
        ))}
      </div>

      <DepartmentActivities board={board} place={place} />

      <div className="grid-three">
        <Panel
          id="dep-vende-usd"
          title={`Qué vende ${name} (millones de USD, ${board.tradeYear ?? '—'})`}
          lede="Los productos que el INE publica para este departamento, más el residuo de «otros productos». La lista no es la misma en cada departamento y esa asimetría es el dato: dice de qué vive cada uno."
          source={SOURCE_TRADE}
        >
          {soldUsd.length ? (
            <>
              <ShareBars data={soldUsd} unit=" MM USD" tone="var(--official)" height={260} />
              {barsKey(`Valor exportado, millones de USD (${board.tradeYear ?? '—'})`)}
            </>
          ) : (
            <div className="callout">Todavía no hay comercio exterior cargado para {name}.</div>
          )}
        </Panel>
        <Panel
          id="dep-vende-toneladas"
          title={`Cuánto pesa lo que vende ${name} (toneladas, ${board.tradeYear ?? '—'})`}
          lede="El mismo año en peso neto. El orden cambia: el mineral pesa y el oro no, y esa es la diferencia entre de qué vive un departamento y qué carga en el camión."
          source={SOURCE_TRADE}
        >
          {soldTonnes.length ? (
            <>
              <ShareBars data={soldTonnes} unit=" t" tone="var(--official)" height={260} />
              {barsKey(`Peso exportado, toneladas (${board.tradeYear ?? '—'})`)}
            </>
          ) : (
            <div className="callout">Sin peso publicado para {name}.</div>
          )}
        </Panel>
        <Panel
          id="dep-exportaciones-usd"
          title={`Exportaciones de ${name} (millones de USD)`}
          lede="Todo lo que salió del departamento, año a año, desde 2010. Es el valor declarado en aduana; el acumulado parcial del año en curso no se dibuja."
          source={SOURCE_TRADE}
        >
          {exportsUsd.length > 1 ? (
            <MacroChart
              data={exportsUsd}
              unit="millones de USD"
              tone="var(--parallel)"
              label={`Exportaciones · ${name}`}
            />
          ) : (
            <div className="callout">Sin serie de exportaciones para {name}.</div>
          )}
        </Panel>
      </div>

      <div className="grid-three">
        <Panel
          id="dep-productos-usd"
          title={`Los ${leading.length} principales productos de ${name} (millones de USD)`}
          lede={`Los que más valieron en ${board.tradeYear ?? '—'}, seguidos hacia atrás. «Otros productos» queda fuera: es la suma de lo que no se nombró, no un producto.`}
          source={SOURCE_TRADE}
        >
          {leadingUsd.data.length > 1 ? (
            <WorldLines
              data={leadingUsd.data}
              series={leadingUsd.series}
              format={(value) => number(value, 1)}
              tick={(value) => number(value, 0)}
            />
          ) : (
            <div className="callout">Sin productos con serie para {name}.</div>
          )}
        </Panel>
        <Panel
          id="dep-productos-toneladas"
          title={`Los mismos ${leading.length} productos de ${name} en peso (toneladas)`}
          lede="Separa precio de volumen: un año que vale más puede ser el mismo mineral más caro, y se ve porque la línea de dólares sube mientras la de toneladas no."
          source={SOURCE_TRADE}
        >
          {leadingTonnes.data.length > 1 ? (
            <WorldLines
              data={leadingTonnes.data}
              series={leadingTonnes.series}
              format={(value) => number(value, 0)}
              tick={(value) => number(value, 0)}
            />
          ) : (
            <div className="callout">Sin peso por producto para {name}.</div>
          )}
        </Panel>
        <Panel
          id="dep-exportaciones-toneladas"
          title={`Exportaciones de ${name} en peso (toneladas)`}
          lede="El peso neto de todo lo que salió, año a año. Contra la figura de dólares dice si el departamento vendió más o sólo vendió más caro."
          source={SOURCE_TRADE}
        >
          {exportsTonnes.length > 1 ? (
            <MacroChart
              data={exportsTonnes}
              unit="toneladas"
              tone="var(--parallel)"
              label={`Exportaciones en peso · ${name}`}
            />
          ) : (
            <div className="callout">Sin serie de peso para {name}.</div>
          )}
        </Panel>
      </div>
    </>
  );
}

export function DepartmentsExplorer({ board: entire }: { board: DepartmentBoard }) {
  /* El «desde» de la barra de filtros de encima; sin barra, el tablero entero. */
  const board = useSinceYear(entire);
  const [place, setPlace] = useState<string | null>(null);
  const [measure, setMeasure] = useState<string>(DEFAULT_MEASURE);

  const painted = measureOf(measure) ?? measureOf(DEFAULT_MEASURE);
  const readings = useMemo(() => {
    const byPlace = painted ? (board.series[painted.slug] ?? {}) : {};
    return DEPARTMENTS.map((department) => {
      const point = last(byPlace[department.slug]);
      return {
        code: department.slug,
        name: department.name,
        value: point?.value ?? null,
        year: point?.year ?? null,
      };
    });
  }, [board, painted]);

  if (!painted) return null;

  const ranked = [...readings].sort(
    (left, right) => (right.value ?? -Infinity) - (left.value ?? -Infinity),
  );
  const paintedYear = readings.find((reading) => reading.year !== null)?.year ?? null;

  return (
    <div className="stack guest-board">
      <TabHeader
        id="departamentos"
        title="Bolivia por departamento"
        lede={`Las cuentas regionales del INE —seis medidas para cada uno de los nueve departamentos, de 1988 a ${board.accountsYear ?? '—'}— y lo que cada uno vende al exterior, producto por producto, desde 2010 hasta ${board.tradeYear ?? '—'}. En la cifra nacional, una caída de un tercio en un departamento y una subida de la mitad en otro se cancelan hasta parecer quietud.`}
      />
      <DerivedReading
        title="Qué dicen estos datos"
        note="Cada frase sale de las series de este capítulo y se recalcula con cada carga. Dice qué nivel hay y contra qué se compara; no dice por qué ni qué va a pasar."
        conclusions={board.conclusions}
        icons={CONCLUSION_ICON}
        defaultOpen={false}
      />

      <Panel
        id="dep-mapa"
        title={`${painted.label} por departamento (${painted.unit}, ${paintedYear ?? '—'})`}
        lede={`${painted.what} Toca un departamento, en el mapa o en la lista, para abrir debajo su vista completa.`}
        source={SOURCE_ACCOUNTS}
        data={() => ({
          unidad: painted.unit,
          columnas: ['Departamento', `${painted.label} (${painted.unit})`, 'Año'],
          filas: ranked.map((reading) => [reading.name, reading.value, reading.year]),
        })}
      >
        <div className="chips">
          {MEASURES.map((one) => (
            <button
              key={one.slug}
              type="button"
              aria-pressed={one.slug === measure}
              className={one.slug === measure ? 'chip chip-on' : 'chip'}
              onClick={() => setMeasure(one.slug)}
            >
              {one.label}
            </button>
          ))}
        </div>

        <div className="map-layout">
          <DepartmentsMap
            readings={readings}
            label={painted.label}
            unit={painted.unit}
            decimals={painted.decimals}
            chosen={place}
            onPick={setPlace}
          />
          <div className="map-side">
            <h4 className="map-side-head">De más a menos</h4>
            <ul className="map-list">
              {ranked.map((reading, index) => (
                <li key={reading.code}>
                  <button
                    type="button"
                    className={reading.code === place ? 'map-row map-row-on' : 'map-row'}
                    aria-pressed={reading.code === place}
                    onClick={() => setPlace(reading.code)}
                  >
                    <span className="map-row-name">
                      <span className="rank-position">{index + 1}</span> {reading.name}
                    </span>
                    <span className="map-row-kind">{reading.year ?? ''}</span>
                    <span className="map-row-count">
                      {reading.value === null ? '—' : number(reading.value, painted.decimals)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="map-note">
              {place
                ? `${placeName(place)} está abierto abajo. Toca otro departamento para cambiarlo.`
                : 'Ningún departamento elegido todavía: el mapa y la lista son las dos formas de abrir uno.'}
            </p>
          </div>
        </div>
      </Panel>

      {place ? <DepartmentDetail board={board} place={place} measure={painted} /> : null}
    </div>
  );
}
