'use client';

import { useMemo, useState } from 'react';
import { MacroChart, ShareBars, WorldLines, seriesTone } from './charts';
import type { WorldLinePoint, WorldLineSeries } from './charts';
import { DerivedReading } from './derived-reading';
import { Icon } from './icons';
import type { IconName } from './icons';
import { DEPARTMENTS, MEASURES, placeName } from '@/lib/departments';
import { placeMix, productMix } from '@/lib/departments-board';
import type { DepartmentBoard, YearValue } from '@/lib/departments-board';

/**
 * Bolivia por departamento, dibujada.
 *
 * El capítulo tiene una sola idea de navegación: **se elige un departamento y
 * todo lo de abajo habla de él**. Es lo contrario de lo que hace el resto del
 * informe, donde se elige un indicador y se comparan países, y la diferencia no
 * es capricho: aquí el lector no llega preguntando «cuánto creció el PIB» sino
 * «qué pasa en Tarija», y un selector de indicadores le obligaría a recorrer
 * seis figuras para reunir la respuesta que quería.
 *
 * Arriba de la elección van las dos comparaciones que sólo existen entre
 * departamentos —quién pesa más en el producto, quién vende más afuera— porque
 * son las que ponen en escala lo que se lea después. Un 30 % de participación
 * no significa nada hasta saber que el siguiente tiene 22 y el último 0,8.
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
};

/** Los cuatro números que resumen un departamento, con su historia debajo. */
const HEADLINES = ['GDP_SHARE', 'GDP_GROWTH', 'GDP_PER_CAPITA', 'EXPORTS_USD'] as const;

const measureOf = (slug: string) => MEASURES.find((one) => one.slug === slug);

const last = (values: readonly YearValue[] | undefined): YearValue | undefined => values?.at(-1);

function Headline({
  board,
  measure,
  place,
}: {
  board: DepartmentBoard;
  measure: string;
  place: string;
}) {
  const definition = measureOf(measure);
  const point = last(board.series[measure]?.[place]);
  if (!definition || !point) return null;
  return (
    <div className="stat">
      <span className="stat-label">{definition.label}</span>
      <span className="stat-value">{number(point.value, definition.decimals)}</span>
      <span className="stat-hint">
        {definition.unit} · {point.year}
      </span>
    </div>
  );
}

/**
 * Las nueve series de una medida en un mismo eje.
 *
 * Líneas y no barras por lo mismo que el tablero mundial: nueve juegos de
 * barras sobre treinta y siete años es un peine que nadie lee. Un año sin dato
 * corta la línea en vez de unirla, porque unir dos años publicados afirma el de
 * en medio.
 */
function acrossPlaces(
  board: DepartmentBoard,
  measure: string,
  highlight: string,
): { data: WorldLinePoint[]; series: WorldLineSeries[] } {
  const byPlace = board.series[measure] ?? {};
  const years = new Set<number>();
  for (const department of DEPARTMENTS) {
    for (const point of byPlace[department.slug] ?? []) years.add(point.year);
  }

  const data: WorldLinePoint[] = [...years]
    .sort((left, right) => left - right)
    .map((year) => {
      const row: WorldLinePoint = { year: String(year) };
      for (const department of DEPARTMENTS) {
        const found = (byPlace[department.slug] ?? []).find((point) => point.year === year);
        row[department.slug] = found ? found.value : null;
      }
      return row;
    });

  const series: WorldLineSeries[] = DEPARTMENTS.map((department, index) => ({
    key: department.slug,
    label: department.name,
    tone: department.slug === highlight ? 'var(--parallel)' : seriesTone(index),
    ...(department.slug === highlight ? { emphasis: true } : {}),
  }));

  return { data, series };
}

export function DepartmentsExplorer({ board }: { board: DepartmentBoard }) {
  const [place, setPlace] = useState<string>('SANTA_CRUZ');
  const [measure, setMeasure] = useState<string>('GDP_CONSTANT');

  const shares = useMemo(() => placeMix(board, 'GDP_SHARE'), [board]);
  const sales = useMemo(() => placeMix(board, 'EXPORTS_USD'), [board]);
  const mix = useMemo(() => productMix(board, place, board.tradeYear).slice(0, 10), [board, place]);
  const compared = useMemo(() => acrossPlaces(board, measure, place), [board, measure, place]);

  const chosen = measureOf(measure);
  const own = (board.series[measure]?.[place] ?? []).map((point) => ({
    period: String(point.year),
    value: point.value,
  }));

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
        />
      </div>

      <div className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <h2>Participación en el PIB nacional (% del país)</h2>
            <p className="panel-sub">
              Qué parte del producto aporta cada departamento en {board.accountsYear ?? '—'}, a
              precios corrientes. Las nueve suman cien. Toca una barra para llevar el departamento a
              los paneles de abajo.
            </p>
          </div>
          <ShareBars data={shares} unit="%" onPick={(pick) => setPlace(pick)} />
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Exportaciones por departamento (millones de USD)</h2>
            <p className="panel-sub">
              Valor declarado en aduana en {board.tradeYear ?? '—'}. No se parece al reparto del
              producto: un departamento puede producir poco y exportar casi todo lo que produce, y
              es el caso de Potosí.
            </p>
          </div>
          <ShareBars
            data={sales}
            unit=" MM USD"
            tone="var(--parallel)"
            onPick={(pick) => setPlace(pick)}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{placeName(place)}</h2>
          <p className="panel-sub">
            Elige el departamento y la medida; todo lo de abajo habla de él. La serie propia va al
            lado de las nueve juntas, porque un crecimiento del 3 % dice una cosa si el país creció
            2 y otra si creció 6.
          </p>
        </div>

        <div className="chips">
          {DEPARTMENTS.map((department) => (
            <button
              key={department.slug}
              type="button"
              aria-pressed={department.slug === place}
              className={department.slug === place ? 'chip chip-on' : 'chip'}
              onClick={() => setPlace(department.slug)}
            >
              <Icon name="mapa" size={13} /> {department.name}
            </button>
          ))}
        </div>

        <div className="stat-strip">
          {HEADLINES.map((one) => (
            <Headline key={one} board={board} measure={one} place={place} />
          ))}
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
        {chosen ? <p className="panel-sub">{chosen.what}</p> : null}
      </div>

      <div className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <h2>
              {chosen?.label} de {placeName(place)} ({chosen?.unit})
            </h2>
            <p className="panel-sub">La serie del departamento elegido, año a año.</p>
          </div>
          {own.length > 1 ? (
            <MacroChart
              data={own}
              unit={chosen?.unit ?? ''}
              tone="var(--parallel)"
              label={`${chosen?.label} · ${placeName(place)}`}
            />
          ) : (
            <div className="callout">Esta medida no tiene serie para {placeName(place)}.</div>
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>
              {chosen?.label}: los nueve departamentos ({chosen?.unit})
            </h2>
            <p className="panel-sub">
              El elegido va resaltado. Un año sin dato corta la línea en vez de unirla: unir dos
              años publicados afirmaría el de en medio, que nadie publicó.
            </p>
          </div>
          {compared.data.length > 1 ? (
            <WorldLines
              data={compared.data}
              series={compared.series}
              format={(value) => number(value, chosen?.decimals ?? 1)}
              tick={(value) => number(value, 0)}
            />
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>
            Qué vende {placeName(place)} (millones de USD, {board.tradeYear ?? '—'})
          </h2>
          <p className="panel-sub">
            Los principales productos que el INE publica para este departamento, más el residuo de
            «otros productos». La lista no es la misma en cada departamento y esa asimetría es el
            dato: dice de qué vive cada uno.
          </p>
        </div>
        {mix.length ? (
          <ShareBars data={mix} unit=" MM USD" tone="var(--official)" height={260} />
        ) : (
          <div className="callout">
            Todavía no hay comercio exterior cargado para {placeName(place)}.
          </div>
        )}
      </div>
    </>
  );
}
