'use client';

import { MacroChart, WorldLines, seriesTone } from './charts';
import type { WorldLinePoint, WorldLineSeries } from './charts';
import { DerivedReading } from './derived-reading';
import { Icon } from './icons';
import type { IconName } from './icons';
import {
  RESOURCE_GROUP_LABEL,
  RESOURCE_INDICATORS,
  RESOURCE_PLACES,
  type ResourceBoard,
  type ResourceGroup,
  type YearValue,
} from '@/lib/resources-board';

/**
 * El subsuelo, dibujado.
 *
 * Primero la lectura y después un panel por pregunta: qué deja cada recurso,
 * qué parte de lo que se vende sale de la tierra, cuánto patrimonio se consume
 * al sacarlo, y si eso se convierte en algo que dura. Bolivia va contra sus
 * vecinos donde la comparación es el punto —la renta total, el ahorro
 * ajustado— y sola donde el punto es la historia.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const CONCLUSION_ICON: Record<string, IconName> = {
  relevo: 'gema',
  canasta: 'camion',
  ahorro: 'balanza',
  agotamiento: 'capas',
  transformacion: 'fabrica',
  vecinos: 'globo',
};

const indicator = (code: string) => RESOURCE_INDICATORS.find((entry) => entry.code === code);

/** Varias series bolivianas sobre un mismo eje de años. */
function lines(
  board: ResourceBoard,
  codes: readonly string[],
  labels?: readonly string[],
): { data: WorldLinePoint[]; series: WorldLineSeries[] } {
  const years = new Set<number>();
  for (const code of codes) for (const point of board.series[code] ?? []) years.add(point.year);
  const data = [...years]
    .sort((left, right) => left - right)
    .map((year) => {
      const row: WorldLinePoint = { year: String(year) };
      for (const code of codes) {
        row[code] = board.series[code]?.find((point) => point.year === year)?.value ?? null;
      }
      return row;
    });
  const series = codes.map((code, index) => ({
    key: code,
    label: labels?.[index] ?? indicator(code)?.label ?? code,
    tone: seriesTone(index),
    emphasis: index === 0,
  }));
  return { data, series };
}

/** Un indicador en todos los lugares, con Bolivia gruesa y el resto de contexto. */
function placesLines(points: readonly { place: string; year: number; value: number }[]): {
  data: WorldLinePoint[];
  series: WorldLineSeries[];
} {
  const years = [...new Set(points.map((point) => point.year))].sort((left, right) => left - right);
  const data = years.map((year) => {
    const row: WorldLinePoint = { year: String(year) };
    for (const place of RESOURCE_PLACES) {
      row[place.code] =
        points.find((point) => point.place === place.code && point.year === year)?.value ?? null;
    }
    return row;
  });
  const series = RESOURCE_PLACES.filter((place) =>
    points.some((point) => point.place === place.code),
  ).map((place) => ({
    key: place.code,
    label: place.label,
    tone: place.code === 'BOL' ? 'var(--official)' : 'var(--series-rest)',
    emphasis: place.code === 'BOL',
  }));
  return { data, series };
}

function Latest({ code, board }: { code: string; board: ResourceBoard }) {
  const meta = indicator(code);
  const reading = board.series[code]?.at(-1);
  if (!meta || !reading) return null;
  return (
    <div className="stat">
      <span className="stat-label">{meta.label}</span>
      <span className="stat-value">{number(reading.value, meta.decimals)}</span>
      <span className="stat-hint">
        {meta.unit} · {reading.year}
      </span>
    </div>
  );
}

function GroupHead({ group, children }: { group: ResourceGroup; children: string }) {
  return (
    <div className="panel-head">
      <h2>{RESOURCE_GROUP_LABEL[group]}</h2>
      <p className="panel-sub">{children}</p>
    </div>
  );
}

const percent = (value: number): string => `${number(value, 2)} %`;
const share = (value: number): string => `${number(value, 1)} %`;
const tick = (value: number): string => number(value, 0);

/**
 * El último dato de cada país en las series que distinguen un caso del otro.
 *
 * La columna que importa es la última: la renta alta se puede sostener, y el
 * ahorro ajustado es lo que dice si se está sosteniendo o gastando.
 */
function NeighboursTable({ board }: { board: ResourceBoard }) {
  const columns: ReadonlyArray<{ code: string; label: string; decimals: number; unit: string }> = [
    { code: 'NY.GDP.MINR.RT.ZS', label: 'Renta minera', decimals: 2, unit: ' %' },
    { code: 'NY.GDP.NGAS.RT.ZS', label: 'Renta del gas', decimals: 2, unit: ' %' },
    { code: 'NY.GDP.PETR.RT.ZS', label: 'Renta del petróleo', decimals: 2, unit: ' %' },
    { code: 'NY.GDP.TOTL.RT.ZS', label: 'Renta total', decimals: 2, unit: ' %' },
    { code: 'TX.VAL.MMTL.ZS.UN', label: 'Minerales exportados', decimals: 0, unit: ' %' },
    { code: 'NV.IND.MANF.ZS', label: 'Manufactura', decimals: 1, unit: ' %' },
    { code: 'NY.ADJ.DRES.GN.ZS', label: 'Agotamiento', decimals: 2, unit: ' %' },
    { code: 'NY.ADJ.SVNX.GN.ZS', label: 'Ahorro ajustado', decimals: 2, unit: ' %' },
  ];
  const cell = (place: string, column: (typeof columns)[number]): string => {
    const reading: YearValue | undefined = board.latest[column.code]?.[place];
    if (!reading) return '—';
    return `${number(reading.value, column.decimals)}${column.unit} (${reading.year})`;
  };
  return (
    <div className="table-wrap">
      <table className="grid-table">
        <thead>
          <tr>
            <th>País</th>
            {columns.map((column) => (
              <th key={column.code}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESOURCE_PLACES.map((place) => (
            <tr key={place.code}>
              <td>
                <b>{place.label}</b>
              </td>
              {columns.map((column) => (
                <td key={column.code}>{cell(place.code, column)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResourcesExplorer({ board }: { board: ResourceBoard }) {
  const rents = lines(board, [
    'NY.GDP.MINR.RT.ZS',
    'NY.GDP.NGAS.RT.ZS',
    'NY.GDP.PETR.RT.ZS',
    'NY.GDP.FRST.RT.ZS',
  ]);
  const basket = lines(board, [
    'TX.VAL.MMTL.ZS.UN',
    'TX.VAL.FUEL.ZS.UN',
    'TX.VAL.FOOD.ZS.UN',
    'TX.VAL.MANF.ZS.UN',
  ]);
  const depletion = lines(board, [
    'NY.ADJ.DRES.GN.ZS',
    'NY.ADJ.DMIN.GN.ZS',
    'NY.ADJ.DNGY.GN.ZS',
    'NY.ADJ.DFOR.GN.ZS',
  ]);
  const savings = lines(
    board,
    ['NY.ADJ.SVNX.GN.ZS', 'NY.ADJ.DRES.GN.ZS', 'NY.ADJ.AEDU.GN.ZS'],
    ['Ahorro neto ajustado', 'Agotamiento de recursos', 'Gasto en educación'],
  );
  const structure = lines(board, ['NV.IND.MANF.ZS', 'NV.AGR.TOTL.ZS', 'NE.GDI.FTOT.ZS']);
  const totalRent = placesLines(board.history['NY.GDP.TOTL.RT.ZS'] ?? []);
  const savingsAcross = placesLines(board.history['NY.ADJ.SVNX.GN.ZS'] ?? []);
  const income = (board.series['NY.ADJ.NNTY.PC.KD'] ?? []).map((point) => ({
    period: String(point.year),
    value: point.value,
  }));

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Recursos naturales</h2>
          <p className="panel-sub">
            Qué deja el subsuelo, cuánto patrimonio se consume al sacarlo y en qué se convierte. Las
            cifras son del Banco Mundial con la misma definición para Bolivia y para cada vecino, así
            que se pueden poner en un mismo eje. El dato más reciente es de {board.asOfYear ?? '—'};
            las rentas y las cuentas ajustadas cierran con dos o tres años de retraso, que es lo que
            tarda el compilador en valorarlas.
          </p>
        </div>
        <DerivedReading
          title="Qué dicen estos datos"
          note="Cada frase sale de las series de este capítulo y se recalcula con cada carga. Dice qué nivel hay y contra qué se compara; no dice por qué ni qué va a pasar."
          conclusions={board.conclusions}
          icons={CONCLUSION_ICON}
        />
      </div>

      <div className="panel">
        <GroupHead group="RENTA">
          Lo que cada recurso deja por encima de su costo de extracción, como parte del PIB. Donde la
          línea mineral cruza a la del gas está el relevo que cambió de qué vive el país.
        </GroupHead>
        <div className="stat-strip">
          <Latest code="NY.GDP.MINR.RT.ZS" board={board} />
          <Latest code="NY.GDP.NGAS.RT.ZS" board={board} />
          <Latest code="NY.GDP.PETR.RT.ZS" board={board} />
          <Latest code="NY.GDP.FRST.RT.ZS" board={board} />
          <Latest code="NY.GDP.TOTL.RT.ZS" board={board} />
        </div>
        {rents.data.length > 1 ? (
          <WorldLines data={rents.data} series={rents.series} format={percent} tick={tick} />
        ) : null}
      </div>

      <div className="grid-pair">
        <div className="panel">
          <GroupHead group="CANASTA">
            Peso de cada cosa en lo que el país vende afuera. Las manufacturas son el espejo: suben
            cuando lo primario baja, y en sesenta años no han pasado de un cuarto de la canasta.
          </GroupHead>
          <div className="stat-strip">
            <Latest code="TX.VAL.MMTL.ZS.UN" board={board} />
            <Latest code="TX.VAL.FUEL.ZS.UN" board={board} />
            <Latest code="TX.VAL.FOOD.ZS.UN" board={board} />
          </div>
          {basket.data.length > 1 ? (
            <WorldLines data={basket.data} series={basket.series} format={share} tick={tick} />
          ) : null}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Renta total, Bolivia contra sus vecinos (% del PIB)</h2>
            <p className="panel-sub">
              Minerales, gas, petróleo, carbón y bosque sumados, como parte del PIB de cada país. La
              línea gruesa es Bolivia; las demás dan la escala de lo que en la región es normal.
            </p>
          </div>
          {totalRent.data.length > 1 ? (
            <WorldLines
              data={totalRent.data}
              series={totalRent.series}
              format={percent}
              tick={tick}
            />
          ) : null}
        </div>
      </div>

      <div className="panel">
        <GroupHead group="AGOTAMIENTO">
          Las cuentas ajustadas del Banco Mundial: al ahorro del año se le resta la depreciación del
          capital y el patrimonio natural consumido, y se le suma el gasto en educación. Por debajo
          de cero el país está financiando su consumo con lo que saca de la tierra.
        </GroupHead>
        <div className="stat-strip">
          <Latest code="NY.ADJ.SVNX.GN.ZS" board={board} />
          <Latest code="NY.ADJ.DRES.GN.ZS" board={board} />
          <Latest code="NY.ADJ.DMIN.GN.ZS" board={board} />
          <Latest code="NY.ADJ.DNGY.GN.ZS" board={board} />
          <Latest code="NY.ADJ.AEDU.GN.ZS" board={board} />
        </div>
        {savings.data.length > 1 ? (
          <WorldLines data={savings.data} series={savings.series} format={percent} tick={tick} />
        ) : null}
      </div>

      <div className="grid-pair">
        <div className="panel">
          <div className="panel-head">
            <h2>Patrimonio consumido por recurso (% del INB)</h2>
            <p className="panel-sub">
              El patrimonio consumido en el año, repartido entre mina, pozo y bosque. La suma es la
              línea gruesa; el relevo del gas por los minerales se ve aquí igual que en la renta.
            </p>
          </div>
          {depletion.data.length > 1 ? (
            <WorldLines
              data={depletion.data}
              series={depletion.series}
              format={percent}
              tick={tick}
            />
          ) : null}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Ahorro neto ajustado, Bolivia y vecinos (% del INB)</h2>
            <p className="panel-sub">
              La misma cuenta para cada vecino. Sirve para separar «vive de minerales» de «se está
              gastando el patrimonio»: son cosas distintas y sólo esta serie las distingue.
            </p>
          </div>
          {savingsAcross.data.length > 1 ? (
            <WorldLines
              data={savingsAcross.data}
              series={savingsAcross.series}
              format={percent}
              tick={tick}
            />
          ) : null}
        </div>
      </div>

      <div className="grid-pair">
        <div className="panel">
          <GroupHead group="TRANSFORMACION">
            Qué parte del PIB sale de una fábrica, qué parte del campo y qué parte se invierte en
            capital fijo. Es la respuesta larga a si la renta se convierte en otra cosa.
          </GroupHead>
          <div className="stat-strip">
            <Latest code="NV.IND.MANF.ZS" board={board} />
            <Latest code="NV.IND.TOTL.ZS" board={board} />
            <Latest code="NE.GDI.FTOT.ZS" board={board} />
          </div>
          {structure.data.length > 1 ? (
            <WorldLines data={structure.data} series={structure.series} format={share} tick={tick} />
          ) : null}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Ingreso neto ajustado por habitante (US$ de 2015)</h2>
            <p className="panel-sub">
              Dólares constantes de 2015 por persona, una vez descontados la depreciación del
              capital y el agotamiento del subsuelo. Es el PIB per cápita menos lo que costó
              producirlo en patrimonio.
            </p>
          </div>
          {income.length > 1 ? (
            <MacroChart
              data={income}
              unit="US$"
              tone="var(--series-3)"
              label="Ingreso neto ajustado por habitante"
            />
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Bolivia entre sus vecinos</h2>
          <p className="panel-sub">
            El último dato de cada país en las series que distinguen un caso de otro. Perú y Chile
            también viven de minerales; lo que cambia entre ellos y Bolivia está en las dos últimas
            columnas.
          </p>
        </div>
        <NeighboursTable board={board} />
      </div>

      <p className="panel-sub">
        <Icon name="info" size={12} /> Series del Banco Mundial (Indicadores del Desarrollo Mundial),
        leídas del panel de treinta economías que recoge el núcleo del observatorio. Las rentas y el
        agotamiento salen de las cuentas de riqueza del banco, no de la contabilidad nacional
        boliviana, y por eso cierran más tarde. Las definiciones de cada serie están en «Social
        Info».
      </p>
    </>
  );
}
