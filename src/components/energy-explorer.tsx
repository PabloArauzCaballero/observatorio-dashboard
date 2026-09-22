'use client';

import { MacroChart, WorldLines, seriesTone } from './charts';
import type { WorldLinePoint, WorldLineSeries } from './charts';
import { DerivedReading } from './derived-reading';
import { Icon } from './icons';
import type { IconName } from './icons';
import {
  ENERGY_GROUP_LABEL,
  ENERGY_INDICATORS,
  ENERGY_PLACES,
  type EnergyBoard,
  type EnergyGroup,
  type YearValue,
} from '@/lib/energy-board';

/**
 * The energy matrix, drawn.
 *
 * Reading first, then one panel per question: where the electricity comes
 * from, what the country trades in fuel, what the subsoil still pays, how
 * much energy people use and who has it. Bolivia is drawn against its
 * neighbours wherever the comparison is the point, and alone where the
 * history is.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const CONCLUSION_ICON: Record<string, IconName> = {
  electricidad: 'rayo',
  balance: 'balanza',
  comercio: 'camion',
  renta: 'gema',
  consumo: 'pulso',
  acceso: 'casco',
};

const indicator = (code: string) => ENERGY_INDICATORS.find((entry) => entry.code === code);

/** Several Bolivian series on one axis of years. */
function lines(
  board: EnergyBoard,
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

/** One indicator across every place, Bolivia drawn heavy and the rest as context. */
function placesLines(points: readonly { place: string; year: number; value: number }[]): {
  data: WorldLinePoint[];
  series: WorldLineSeries[];
} {
  const years = [...new Set(points.map((point) => point.year))].sort((left, right) => left - right);
  const data = years.map((year) => {
    const row: WorldLinePoint = { year: String(year) };
    for (const place of ENERGY_PLACES) {
      row[place.code] =
        points.find((point) => point.place === place.code && point.year === year)?.value ?? null;
    }
    return row;
  });
  const series = ENERGY_PLACES.filter((place) =>
    points.some((point) => point.place === place.code),
  ).map((place) => ({
    key: place.code,
    label: place.label,
    tone: place.code === 'BOL' ? 'var(--official)' : 'var(--series-rest)',
    emphasis: place.code === 'BOL',
  }));
  return { data, series };
}

function Latest({ code, board }: { code: string; board: EnergyBoard }) {
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

function GroupHead({ group, children }: { group: EnergyGroup; children: string }) {
  return (
    <div className="panel-head">
      <h2>{ENERGY_GROUP_LABEL[group]}</h2>
      <p className="panel-sub">{children}</p>
    </div>
  );
}

const percent = (value: number): string => `${number(value, 1)} %`;
const tick = (value: number): string => number(value, 0);

function NeighboursTable({ board }: { board: EnergyBoard }) {
  const columns: ReadonlyArray<{ code: string; label: string; decimals: number }> = [
    { code: 'EG.ELC.NGAS.ZS', label: 'Gas en la electricidad', decimals: 0 },
    { code: 'EG.ELC.HYRO.ZS', label: 'Hidro', decimals: 0 },
    { code: 'EG.ELC.RNWX.ZS', label: 'Otras renovables', decimals: 0 },
    { code: 'EG.FEC.RNEW.ZS', label: 'Renovables en el consumo', decimals: 0 },
    { code: 'EG.USE.PCAP.KG.OE', label: 'Energía por hab. (kg)', decimals: 0 },
    { code: 'EG.IMP.CONS.ZS', label: 'Importación neta', decimals: 0 },
    { code: 'TX.VAL.FUEL.ZS.UN', label: 'Combustible exportado', decimals: 0 },
    { code: 'TM.VAL.FUEL.ZS.UN', label: 'Combustible importado', decimals: 0 },
  ];
  const cell = (place: string, column: (typeof columns)[number]): string => {
    const reading: YearValue | undefined = board.latest[column.code]?.[place];
    if (!reading) return '—';
    const suffix = column.code.endsWith('.ZS') || column.code.endsWith('.UN') ? ' %' : '';
    return `${number(reading.value, column.decimals)}${suffix} (${reading.year})`;
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
          {ENERGY_PLACES.map((place) => (
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

export function EnergyExplorer({ board }: { board: EnergyBoard }) {
  const mix = lines(board, [
    'EG.ELC.NGAS.ZS',
    'EG.ELC.HYRO.ZS',
    'EG.ELC.RNWX.ZS',
    'EG.ELC.PETR.ZS',
  ]);
  const sources = lines(board, ['EG.FEC.RNEW.ZS', 'EG.USE.CRNW.ZS', 'EG.USE.COMM.CL.ZS']);
  const trade = lines(
    board,
    ['TX.VAL.FUEL.ZS.UN', 'TM.VAL.FUEL.ZS.UN'],
    ['Exportaciones', 'Importaciones'],
  );
  const rents = lines(board, ['NY.GDP.NGAS.RT.ZS', 'NY.GDP.PETR.RT.ZS', 'NY.GDP.TOTL.RT.ZS']);
  const access = lines(board, [
    'EG.ELC.ACCS.ZS',
    'EG.ELC.ACCS.RU.ZS',
    'EG.CFT.ACCS.ZS',
    'EG.CFT.ACCS.RU.ZS',
  ]);
  const emissions = lines(
    board,
    ['EN.GHG.CO2.TR.MT.CE.AR5', 'EN.GHG.CO2.PI.MT.CE.AR5'],
    ['Transporte', 'Centrales'],
  );
  const perCapita = placesLines(board.history['EG.USE.PCAP.KG.OE'] ?? []);
  const net = (board.series['EG.IMP.CONS.ZS'] ?? []).map((point) => ({
    period: String(point.year),
    value: point.value,
  }));
  const intensity = (board.series['EG.EGY.PRIM.PP.KD'] ?? []).map((point) => ({
    period: String(point.year),
    value: point.value,
  }));

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Matriz energética</h2>
          <p className="panel-sub">
            De dónde sale la energía que Bolivia usa, cuánta vende y cuánta compra, y qué le deja el
            subsuelo. Todas las cifras son del Banco Mundial, con la misma definición para Bolivia y
            para cada vecino, así que se pueden poner en un mismo eje. El dato más reciente es de{' '}
            {board.asOfYear ?? '—'}; las series de energía llegan con dos o tres años de retraso,
            que es lo que tarda el compilador en cerrarlas.
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
        <GroupHead group="ELECTRICIDAD">
          Parte de la generación eléctrica por fuente, año a año. Las cuatro no suman cien porque el
          carbón y lo no clasificado quedan fuera; el gas y el agua son casi todo.
        </GroupHead>
        <div className="stat-strip">
          <Latest code="EG.ELC.NGAS.ZS" board={board} />
          <Latest code="EG.ELC.HYRO.ZS" board={board} />
          <Latest code="EG.ELC.RNWX.ZS" board={board} />
          <Latest code="EG.ELC.PETR.ZS" board={board} />
          <Latest code="EG.ELC.LOSS.ZS" board={board} />
        </div>
        {mix.data.length > 1 ? (
          <WorldLines data={mix.data} series={mix.series} format={percent} tick={tick} />
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Bolivia entre sus vecinos</h2>
          <p className="panel-sub">
            El último dato de cada país en las series que distinguen una matriz de otra. Una
            importación neta negativa es un exportador de energía.
          </p>
        </div>
        <NeighboursTable board={board} />
      </div>

      <div className="grid-two">
        <div className="panel">
          <GroupHead group="COMERCIO">
            Peso del combustible en lo que se exporta y en lo que se importa. Donde la segunda línea
            cruza a la primera, el diésel que entra empieza a pesar más que el gas que sale.
          </GroupHead>
          {trade.data.length > 1 ? (
            <WorldLines data={trade.data} series={trade.series} format={percent} tick={tick} />
          ) : null}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Energía importada neta</h2>
            <p className="panel-sub">
              Importaciones menos exportaciones de energía, como parte del uso. Por debajo de cero
              el país exporta más de lo que consume; cuanto más abajo, más excedente.
            </p>
          </div>
          {net.length > 1 ? <MacroChart data={net} unit="%" tone="var(--gap)" /> : null}
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <GroupHead group="RENTA">
            Lo que cada recurso deja por encima de su costo de extracción, como parte del PIB. La
            renta cae con el precio y con la producción, y arrastra al fisco con ella.
          </GroupHead>
          {rents.data.length > 1 ? (
            <WorldLines data={rents.data} series={rents.series} format={percent} tick={tick} />
          ) : null}
        </div>
        <div className="panel">
          <GroupHead group="FUENTES">
            De toda la energía que se consume —no solo la eléctrica—, qué parte es renovable, qué
            parte es leña y biomasa, y qué parte son hidro y otras alternativas.
          </GroupHead>
          {sources.data.length > 1 ? (
            <WorldLines data={sources.data} series={sources.series} format={percent} tick={tick} />
          ) : null}
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <GroupHead group="CONSUMO">
            Kilos de petróleo equivalente por habitante y año, Bolivia contra sus vecinos. La línea
            gruesa es Bolivia; las demás dan la escala.
          </GroupHead>
          <div className="stat-strip">
            <Latest code="EG.USE.PCAP.KG.OE" board={board} />
            <Latest code="EG.USE.ELEC.KH.PC" board={board} />
          </div>
          {perCapita.data.length > 1 ? (
            <WorldLines
              data={perCapita.data}
              series={perCapita.series}
              format={(value) => `${number(value, 0)} kg`}
              tick={tick}
            />
          ) : null}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Intensidad energética</h2>
            <p className="panel-sub">
              Megajulios por dólar de PIB a paridad de compra. Baja cuando la misma producción
              necesita menos energía; sube cuando la economía se mueve hacia sectores que queman
              más.
            </p>
          </div>
          {intensity.length > 1 ? (
            <MacroChart data={intensity} unit="MJ/$" tone="var(--series-3)" />
          ) : null}
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <GroupHead group="ACCESO">
            Quién tiene conexión eléctrica y quién cocina con gas o electricidad en vez de leña, en
            el país y en el campo. La distancia entre las dos líneas de cada par es la brecha rural.
          </GroupHead>
          {access.data.length > 1 ? (
            <WorldLines data={access.data} series={access.series} format={percent} tick={tick} />
          ) : null}
        </div>
        <div className="panel">
          <GroupHead group="EMISIONES">
            Dióxido de carbono del transporte y de las centrales eléctricas, en millones de
            toneladas. Sin el cambio de uso del suelo, que en Bolivia pesa más que las dos juntas.
          </GroupHead>
          <div className="stat-strip">
            <Latest code="EN.GHG.CO2.PC.CE.AR5" board={board} />
            <Latest code="EN.GHG.CO2.RT.GDP.PP.KD" board={board} />
          </div>
          {emissions.data.length > 1 ? (
            <WorldLines
              data={emissions.data}
              series={emissions.series}
              format={(value) => `${number(value, 2)} Mt`}
              tick={(value) => number(value, 0)}
            />
          ) : null}
        </div>
      </div>

      <p className="panel-sub">
        <Icon name="info" size={12} /> Series del Banco Mundial (Indicadores del Desarrollo
        Mundial), leídas del panel de treinta economías que recoge el núcleo del observatorio. Las
        definiciones de cada serie están en «Social Info».
      </p>
    </>
  );
}
