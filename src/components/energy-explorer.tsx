'use client';

import { MacroChart, WorldLines, seriesTone } from './charts';
import type { WorldLinePoint, WorldLineSeries } from './charts';
import { DerivedReading } from './derived-reading';
import type { IconName } from './icons';
import { Panel } from '@/components/ui/panel';
import { TabHeader } from '@/components/ui/tab-header';
import {
  ENERGY_GROUP_LABEL,
  ENERGY_INDICATORS,
  ENERGY_PLACES,
  type EnergyBoard,
} from '@/lib/energy-board';
import { useSinceYear } from './year-floor';

/**
 * The energy matrix, drawn.
 *
 * Reading first, then one panel per question: where the electricity comes
 * from, what the country trades in fuel, what the subsoil still pays, how
 * much energy people use and who has it. Bolivia is drawn against its
 * neighbours wherever the comparison is the point, and alone where the
 * history is.
 *
 * El cuadro del último dato de cada vecino ya no cierra este capítulo: está en
 * «Bolivia ante el mundo», con los de recursos naturales y medio ambiente, que
 * es la pestaña que compara países. Aquí queda el aviso de dónde fue.
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

/** Quién publica todas las cifras de este capítulo. */
const SOURCE = 'Banco Mundial (Indicadores del Desarrollo Mundial)';

const percent = (value: number): string => `${number(value, 1)} %`;
const tick = (value: number): string => number(value, 0);

export function EnergyExplorer({ board: entire }: { board: EnergyBoard }) {
  /* El «desde» de la barra de filtros de encima; sin barra, el tablero entero. */
  const board = useSinceYear(entire);
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
    <div className="stack guest-board">
      <TabHeader
        id="energia"
        title="Matriz energética"
        lede={`Las fuentes de la energía que usa Bolivia, cuánta vende y compra, y qué renta deja el subsuelo. Todas las cifras son del Banco Mundial, con una definición común para Bolivia y sus vecinos. El dato más reciente es de ${board.asOfYear ?? '—'}: las series de energía se publican con dos o tres años de retraso.`}
      />
      <DerivedReading
        title="Qué dicen estos datos"
        note="Cada frase se calcula con las series de este capítulo y se actualiza con cada carga. Indica el nivel y la referencia con que se compara; no explica causas ni anticipa tendencias."
        conclusions={board.conclusions}
        icons={CONCLUSION_ICON}
      />

      {/*
        Nueve gráficos, de tres en tres: tres filas justas.

        El orden sigue siendo el de las preguntas —de dónde sale la
        electricidad, qué se comercia, qué deja el subsuelo, cuánta energía se
        usa y quién la tiene— y cada fila junta tres que se leen seguidas.
      */}
      <div className="grid-three">
        <Panel
          id="energia-electricidad"
          title={ENERGY_GROUP_LABEL.ELECTRICIDAD}
          lede="El gas natural y la hidroeléctrica generan casi toda la electricidad del país. Las cuatro fuentes no suman 100 % porque el carbón y la generación sin clasificar quedan fuera."
          source={SOURCE}
        >
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
        </Panel>
        <Panel
          id="energia-comercio"
          title={ENERGY_GROUP_LABEL.COMERCIO}
          lede="Peso del combustible en las exportaciones y en las importaciones de mercancías. Cuando la línea de importaciones supera a la de exportaciones, el diésel y la gasolina que entran pesan más que el gas que sale."
          source={SOURCE}
        >
          {trade.data.length > 1 ? (
            <WorldLines data={trade.data} series={trade.series} format={percent} tick={tick} />
          ) : null}
        </Panel>
        <Panel
          id="energia-importada-neta"
          title="Energía importada neta (% del uso total)"
          lede="Importaciones menos exportaciones de energía, como porcentaje del uso total. Un valor negativo indica que el país exporta más energía de la que importa; cuanto más bajo, mayor el excedente."
          source={SOURCE}
        >
          {net.length > 1 ? (
            <MacroChart data={net} unit="%" tone="var(--gap)" label="Energía importada neta" />
          ) : null}
        </Panel>

        <Panel
          id="energia-renta"
          title={ENERGY_GROUP_LABEL.RENTA}
          lede="Lo que cada recurso rinde por encima de su costo de extracción, como porcentaje del PIB. La renta baja cuando caen el precio o la producción, y con ella los ingresos fiscales que dependen de esos recursos."
          source={SOURCE}
        >
          {rents.data.length > 1 ? (
            <WorldLines data={rents.data} series={rents.series} format={percent} tick={tick} />
          ) : null}
        </Panel>
        <Panel
          id="energia-fuentes"
          title={ENERGY_GROUP_LABEL.FUENTES}
          lede="Del total de la energía consumida —no solo la eléctrica—, la parte renovable, la que aportan la leña y la biomasa, y la que aportan la hidroelectricidad y otras fuentes alternativas."
          source={SOURCE}
        >
          {sources.data.length > 1 ? (
            <WorldLines data={sources.data} series={sources.series} format={percent} tick={tick} />
          ) : null}
        </Panel>
        <Panel
          id="energia-consumo"
          title={ENERGY_GROUP_LABEL.CONSUMO}
          lede="Kilos de petróleo equivalente por habitante y año, Bolivia frente a sus vecinos. La línea gruesa es Bolivia; las demás dan la escala regional."
          source={SOURCE}
        >
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
        </Panel>

        <Panel
          id="energia-intensidad"
          title="Intensidad energética (MJ por USD de PIB, PPA)"
          lede="Megajulios necesarios para producir un dólar de PIB a paridad de poder adquisitivo. Baja cuando la misma producción requiere menos energía y sube cuando la economía se desplaza hacia sectores de mayor consumo energético."
          source={SOURCE}
        >
          {intensity.length > 1 ? (
            <MacroChart
              data={intensity}
              unit="MJ/USD"
              tone="var(--series-3)"
              label="Intensidad energética"
            />
          ) : null}
        </Panel>
        <Panel
          id="energia-acceso"
          title={ENERGY_GROUP_LABEL.ACCESO}
          lede="Población con conexión eléctrica y población que cocina con gas o electricidad en lugar de leña, en todo el país y en el área rural. La distancia entre las dos líneas de cada par mide la brecha rural."
          source={SOURCE}
        >
          {access.data.length > 1 ? (
            <WorldLines data={access.data} series={access.series} format={percent} tick={tick} />
          ) : null}
        </Panel>
        <Panel
          id="energia-emisiones"
          title={ENERGY_GROUP_LABEL.EMISIONES}
          lede="Dióxido de carbono emitido por el transporte y por las centrales eléctricas. No incluye el cambio de uso del suelo, que en Bolivia emite más que ambos sectores juntos."
          source={SOURCE}
        >
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
        </Panel>
      </div>

      <p className="guest-note">
        El cuadro «Bolivia y sus vecinos» —el último dato de cada país en las series que distinguen
        una matriz de otra— se encuentra en la página «Bolivia ante el mundo», junto a los de
        recursos naturales y medio ambiente.
      </p>
      <p className="guest-note">
        Series del Banco Mundial (Indicadores del Desarrollo Mundial), tomadas del panel de treinta
        economías que recopila DatosBolivia. Las definiciones de cada serie están en «Indicadores
        sociales».
      </p>
    </div>
  );
}
