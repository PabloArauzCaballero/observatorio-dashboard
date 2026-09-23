'use client';

import { useMemo, useState } from 'react';
import { MacroChart, ShareBars, WorldLines, seriesTone } from './charts';
import { DepartmentActivities } from './department-activities-panel';
import { BENCHMARK, indexBase, indexed, onOneAxis, trio } from './department-lines';
import type { NamedLine } from './department-lines';
import { DepartmentsMap } from './departments-map';
import { DerivedReading } from './derived-reading';
import { Icon } from './icons';
import type { IconName } from './icons';
import { DEPARTMENTS, MEASURES, placeName } from '@/lib/departments';
import type { Measure } from '@/lib/departments';
import { placeRank, productMix, topProducts } from '@/lib/departments-board';
import type { DepartmentBoard, ProductLine, YearValue } from '@/lib/departments-board';

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
          {ACCOUNTS.map((measure) => {
            const byPlace = board.series[measure.slug] ?? {};
            const own = last(byPlace[place]);
            if (!own) return null;
            const country = at(byPlace['BOLIVIA'], own.year);
            const bench = at(byPlace[BENCHMARK], own.year);
            const rank = placeRank(board, measure.slug, place);
            return (
              <tr key={measure.slug}>
                <td>
                  {measure.label}
                  <br />
                  <span className="stat-hint">{measure.unit}</span>
                </td>
                <td className="num">
                  <code>{number(own.value, measure.decimals)}</code>
                </td>
                <td className="num">{bench ? number(bench.value, measure.decimals) : '—'}</td>
                <td className="num">{country ? number(country.value, measure.decimals) : '—'}</td>
                <td className="num">{rank ? ordinal(rank) : '—'}</td>
                <td className="num">{own.year}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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
      <div className="panel">
        <div className="tile-head">
          <Icon name="mapa" size={17} />
          <h2>{name}, en todas las medidas del INE</h2>
          <span className="tile-hint">cuentas regionales y comercio</span>
        </div>
        <p className="panel-sub">
          Las ocho cifras en su último año publicado, con el puesto que ocupa {name} entre los nueve
          departamentos en ese mismo año. El per cápita cierra un año antes que las demás porque
          necesita la proyección de población.
        </p>
        <div className="stat-strip">
          {MEASURES.map((one) => (
            <Headline key={one.slug} board={board} measure={one} place={place} />
          ))}
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <h2>
              Las ocho medidas de {name}, {placeName(BENCHMARK)} y Bolivia (cada una en su unidad)
            </h2>
            <p className="panel-sub">
              La tabla es donde la comparación con el país cabe siempre y en su unidad: una cifra al
              lado de otra no tiene el problema de escala que tiene una línea al lado de otra. En
              participación la fila de Bolivia es cien por definición y en producto es la suma de
              las nueve, así que ahí la cifra del país sitúa al departamento pero no lo califica.
            </p>
          </div>
          <AccountsTable board={board} place={place} />
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>
              {measure.label} de {listed(compared.drawn)} (
              {compared.base === null ? measure.unit : `índice, ${compared.base} = 100`})
            </h2>
            <p className="panel-sub">
              La medida que pinta el mapa, seguida en el tiempo. Tres líneas y no nueve: nueve es un
              peine en el que se ve que hay dispersión y no se ve ninguna de las nueve. Un año sin
              dato corta la línea en vez de unirla, porque unir dos años publicados afirmaría el de
              en medio, que nadie publicó.
            </p>
          </div>
          {compared.data.length > 1 ? (
            <WorldLines
              data={compared.data}
              series={compared.series}
              format={(value) => number(value, measure.decimals)}
              tick={(value) => number(value, 0)}
            />
          ) : null}
        </div>
      </div>

      <div className="grid-three">
        {accounts.map(({ measure: one, data, series, base, drawn }) => (
          <div className="panel" key={one.slug}>
            <div className="panel-head">
              <h2>
                {one.label} de {listed(drawn)} ({base === null ? one.unit : `índice, ${base} = 100`}
                )
              </h2>
              <p className="panel-sub">
                {one.what}
                {base === null
                  ? ''
                  : ' Va en índice porque la fila del país es la suma de los nueve y en su escala un departamento chico no se ve; el nivel en su unidad está en la tabla de arriba.'}
              </p>
            </div>
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
          </div>
        ))}
      </div>

      <DepartmentActivities board={board} place={place} />

      <div className="grid-three">
        <div className="panel">
          <div className="panel-head">
            <h2>
              Qué vende {name} (millones de USD, {board.tradeYear ?? '—'})
            </h2>
            <p className="panel-sub">
              Los productos que el INE publica para este departamento, más el residuo de «otros
              productos». La lista no es la misma en cada departamento y esa asimetría es el dato:
              dice de qué vive cada uno.
            </p>
          </div>
          {soldUsd.length ? (
            <ShareBars data={soldUsd} unit=" MM USD" tone="var(--official)" height={260} />
          ) : (
            <div className="callout">Todavía no hay comercio exterior cargado para {name}.</div>
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>
              Cuánto pesa lo que vende {name} (toneladas, {board.tradeYear ?? '—'})
            </h2>
            <p className="panel-sub">
              El mismo año en peso neto. El orden cambia: el mineral pesa y el oro no, y esa es la
              diferencia entre de qué vive un departamento y qué carga en el camión.
            </p>
          </div>
          {soldTonnes.length ? (
            <ShareBars data={soldTonnes} unit=" t" tone="var(--official)" height={260} />
          ) : (
            <div className="callout">Sin peso publicado para {name}.</div>
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Exportaciones de {name} (millones de USD)</h2>
            <p className="panel-sub">
              Todo lo que salió del departamento, año a año, desde 2010. Es el valor declarado en
              aduana; el acumulado parcial del año en curso no se dibuja.
            </p>
          </div>
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
        </div>
      </div>

      <div className="grid-three">
        <div className="panel">
          <div className="panel-head">
            <h2>
              Los {leading.length} principales productos de {name} (millones de USD)
            </h2>
            <p className="panel-sub">
              Los que más valieron en {board.tradeYear ?? '—'}, seguidos hacia atrás. «Otros
              productos» queda fuera: es la suma de lo que no se nombró, no un producto.
            </p>
          </div>
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
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Los mismos {leading.length} productos en peso (toneladas)</h2>
            <p className="panel-sub">
              Separa precio de volumen: un año que vale más puede ser el mismo mineral más caro, y
              se ve porque la línea de dólares sube mientras la de toneladas no.
            </p>
          </div>
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
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Exportaciones de {name} en peso (toneladas)</h2>
            <p className="panel-sub">
              El peso neto de todo lo que salió, año a año. Contra la figura de dólares dice si el
              departamento vendió más o sólo vendió más caro.
            </p>
          </div>
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
        </div>
      </div>
    </>
  );
}

export function DepartmentsExplorer({ board }: { board: DepartmentBoard }) {
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
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Bolivia por departamento</h2>
          <p className="panel-sub">
            Las cuentas regionales del INE —seis medidas para cada uno de los nueve departamentos,
            de 1988 a {board.accountsYear ?? '—'}— y lo que cada uno vende al exterior, producto por
            producto, desde 2010 hasta {board.tradeYear ?? '—'}. Hasta aquí el observatorio medía un
            solo país: una caída de un tercio en un departamento y una subida de la mitad en otro se
            cancelaban en la cifra nacional hasta parecer quietud.
          </p>
        </div>
        <DerivedReading
          title="Qué dicen estos datos"
          note="Cada frase sale de las series de este capítulo y se recalcula con cada carga. Dice qué nivel hay y contra qué se compara; no dice por qué ni qué va a pasar."
          conclusions={board.conclusions}
          icons={CONCLUSION_ICON}
          defaultOpen={false}
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>
            {painted.label} por departamento ({painted.unit}, {paintedYear ?? '—'})
          </h2>
          <p className="panel-sub">
            Toca un departamento para abrir debajo su vista completa. El color es la medida elegida
            aquí, en su último año; la clave de debajo del mapa dice qué extremo de la rampa es el
            mínimo y cuál el máximo.
          </p>
        </div>

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
        <p className="panel-sub">{painted.what}</p>

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
            <h3 className="map-side-head">De más a menos</h3>
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
      </div>

      {place ? <DepartmentDetail board={board} place={place} measure={painted} /> : null}
    </>
  );
}
