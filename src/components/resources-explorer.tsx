'use client';

import { MacroChart, WorldLines, seriesTone } from './charts';
import type { WorldLinePoint, WorldLineSeries } from './charts';
import { DerivedReading } from './derived-reading';
import type { IconName } from './icons';
import { Panel } from '@/components/ui/panel';
import { TabHeader } from '@/components/ui/tab-header';
import {
  COMMODITY_CHAPTER_TOTAL,
  FUEL_SLUGS,
  LITHIUM_SLUG,
  MINERAL_SLUGS,
  RESOURCE_GROUP_LABEL,
  RESOURCE_INDICATORS,
  RESOURCE_PLACES,
  type CommodityExport,
  type ResourceBoard,
} from '@/lib/resources-board';
import { useSinceYear } from './year-floor';

/**
 * El subsuelo, dibujado.
 *
 * Primero la lectura y después un panel por pregunta: qué deja cada recurso,
 * qué parte de lo que se vende sale de la tierra, cuánto patrimonio se consume
 * al sacarlo, y si eso se convierte en algo que dura. Bolivia va contra sus
 * vecinos donde la comparación es el punto —la renta total, el ahorro
 * ajustado— y sola donde el punto es la historia.
 *
 * El cuadro del último dato de cada vecino ya no cierra este capítulo: está en
 * «Bolivia ante el mundo», con los de energía y medio ambiente, que es la
 * pestaña que compara países. Aquí queda el aviso de dónde fue.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const CONCLUSION_ICON: Record<string, IconName> = {
  relevo: 'gema',
  canasta: 'camion',
  productos: 'cajas',
  litio: 'chip',
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

/** Las rentas, el agotamiento y la comparación regional salen de las cuentas de riqueza del Banco Mundial. */
const SOURCE = 'Banco Mundial (Indicadores del Desarrollo Mundial)';

/** El detalle por producto es la declaración aduanera de Bolivia, por partida, desde 1992. */
const SOURCE_CUSTOMS =
  'UN Comtrade (declaración aduanera de Bolivia ante Naciones Unidas, por partida del Sistema Armonizado)';

const percent = (value: number): string => `${number(value, 2)} %`;
const share = (value: number): string => `${number(value, 1)} %`;
const tick = (value: number): string => number(value, 0);
const millions = (value: number): string => `${number(value, 0)} M`;

/**
 * Varias partidas sobre un eje de años, en la medida que se pida.
 *
 * Los dólares se dibujan en millones y los kilos en toneladas porque un eje de
 * mil millones imprime números que nadie lee; la conversión va aquí y no en el
 * tablero para que la cifra que viaja sea la declarada.
 */
function commodityLines(
  commodities: readonly CommodityExport[],
  slugs: readonly string[],
  measure: 'value' | 'weight',
): { data: WorldLinePoint[]; series: WorldLineSeries[] } {
  const divisor = measure === 'value' ? 1_000_000 : 1_000;
  const wanted = slugs
    .map((slug) => commodities.find((one) => one.slug === slug))
    .filter((one): one is CommodityExport => one !== undefined && one[measure].length > 1);
  const years = new Set<number>();
  for (const one of wanted) for (const point of one[measure]) years.add(point.year);
  const data = [...years]
    .sort((left, right) => left - right)
    .map((year) => {
      const row: WorldLinePoint = { year: String(year) };
      for (const one of wanted) {
        const found = one[measure].find((point) => point.year === year);
        row[one.slug] = found ? found.value / divisor : null;
      }
      return row;
    });
  const series = wanted.map((one, index) => ({
    key: one.slug,
    label: one.label,
    tone: seriesTone(index),
    emphasis: index === 0,
  }));
  return { data, series };
}

export function ResourcesExplorer({
  board: entire,
  embedded = false,
}: {
  board: ResourceBoard;
  /**
   * Dentro de la página «Recursos naturales», debajo del mapa aduanero: la
   * cabecera de sección ya la pone la página, así que aquí va un encabezado de
   * grupo y no una segunda cabecera de pestaña con el mismo título.
   */
  embedded?: boolean;
}) {
  /* El «desde» de la barra de filtros de encima; sin barra, el tablero entero. */
  const board = useSinceYear(entire);
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
  const mineralValue = commodityLines(board.commodities, MINERAL_SLUGS, 'value');
  const mineralWeight = commodityLines(board.commodities, MINERAL_SLUGS, 'weight');
  const fuelValue = commodityLines(board.commodities, FUEL_SLUGS, 'value');
  const lithium = board.commodities.find((one) => one.slug === LITHIUM_SLUG);
  const lithiumWeight = (lithium?.weight ?? []).map((point) => ({
    period: String(point.year),
    value: point.value / 1_000,
  }));
  const oreTotal = board.commodities.find((one) => one.slug === COMMODITY_CHAPTER_TOTAL);
  const oreValue = (oreTotal?.value ?? []).map((point) => ({
    period: String(point.year),
    value: point.value / 1_000_000,
  }));

  return (
    <div className="stack guest-board">
      {embedded ? (
        <header className="page-intro">
          <h3 className="page-intro-title">Renta, patrimonio y canasta exportadora</h3>
          <p className="page-intro-lede">
            {`Cuánta renta deja el subsuelo, cuánto patrimonio natural se consume al extraerlo y en qué se convierte, con Bolivia frente a sus vecinos. Fuentes: el Banco Mundial, con las rentas y las cuentas ajustadas bajo una misma definición para todos los países, y la declaración aduanera de Bolivia ante Naciones Unidas, con la serie larga por producto. El dato más reciente es de ${board.asOfYear ?? '—'}; las cuentas ajustadas llegan con dos o tres años de rezago.`}
          </p>
        </header>
      ) : (
        <TabHeader
          id="recursos"
          title="Recursos naturales"
          lede={`Qué exporta el país, qué renta deja el subsuelo, cuánto patrimonio natural se consume al extraerlo y en qué se convierte. Dos fuentes: la declaración aduanera ante Naciones Unidas, con el detalle por producto —incluido el litio—, y el Banco Mundial, con las rentas y las cuentas ajustadas bajo una misma definición para Bolivia y sus vecinos. El dato más reciente es de ${board.asOfYear ?? '—'}. Las aduanas cierran con un año de rezago y las cuentas ajustadas con dos o tres, por lo que cada panel indica su último año.`}
        />
      )}
      <DerivedReading
        id="recursos-renta-lectura"
        title="Qué dicen estos datos"
        note="Cada frase se calcula a partir de las series de esta sección y se actualiza con cada carga. Indica el nivel y la referencia de comparación; no atribuye causas ni hace proyecciones."
        conclusions={board.conclusions}
        icons={CONCLUSION_ICON}
      />

      {/*
        El desglose por producto sólo se dibuja si el núcleo ya lo cargó.

        El tablero se despliega desde un repositorio distinto del que migra y
        siembra, así que entre un despliegue y el otro estas series no están.
        Un panel vacío con su leyenda sin líneas se lee como una avería; que el
        capítulo empiece por las rentas, no.

        Los cinco van en una sola rejilla de tres y cada uno entra sólo si
        tiene datos: la rejilla ensancha el que sobra, así que cuatro o cinco
        no dejan hueco.
      */}
      {mineralValue.data.length > 1 ||
      mineralWeight.data.length > 1 ||
      lithiumWeight.length > 1 ||
      fuelValue.data.length > 1 ||
      oreValue.length > 1 ? (
        <div className="grid-three">
          {mineralValue.data.length > 1 ? (
            <Panel
              id="recursos-minerales-exportados"
              title="Minerales exportados por producto (millones de USD)"
              lede="Las exportaciones de minerales partida por partida, tal como Bolivia las declaró en aduana ante Naciones Unidas desde 1992. Las rentas de los paneles siguientes miden cuánto deja el subsuelo; este, qué se vende. El concentrado de cinc y los minerales de oro y plata aparecen por separado."
              source={SOURCE_CUSTOMS}
            >
              <WorldLines
                data={mineralValue.data}
                series={mineralValue.series}
                format={(value) => `${number(value, 1)} millones de USD`}
                tick={millions}
              />
            </Panel>
          ) : null}
          {mineralWeight.data.length > 1 ? (
            <Panel
              id="recursos-minerales-peso"
              title="Peso exportado por mineral (miles de toneladas)"
              lede="La misma canasta, medida en peso y no en valor. Separa el efecto precio del efecto volumen: el valor exportado de oro puede duplicarse con el precio sin que salga un gramo más."
              source={SOURCE_CUSTOMS}
            >
              <WorldLines
                data={mineralWeight.data}
                series={mineralWeight.series}
                format={(value) => `${number(value, 0)} mil t`}
                tick={tick}
              />
            </Panel>
          ) : null}
          {lithiumWeight.length > 1 ? (
            <Panel
              id="recursos-litio"
              title="Carbonato de litio exportado (toneladas)"
              lede="El litio se exporta como carbonato, que el Sistema Armonizado clasifica entre los productos químicos (partida 2836.91) y no entre los minerales. Hay años sin declaración; la línea une los puntos disponibles, y un tramo largo y recto indica un hueco, no un dato intermedio."
              source={SOURCE_CUSTOMS}
            >
              <MacroChart
                data={lithiumWeight}
                unit="t"
                tone="var(--series-4)"
                label="Carbonato de litio"
              />
            </Panel>
          ) : null}
          {fuelValue.data.length > 1 ? (
            <Panel
              id="recursos-hidrocarburos-exportados"
              title="Hidrocarburos exportados (millones de USD)"
              lede="El gas natural y los demás hidrocarburos, en la misma unidad y del mismo registro aduanero que los minerales, de modo que la comparación entre ambos no mezcla fuentes."
              source={SOURCE_CUSTOMS}
            >
              <WorldLines
                data={fuelValue.data}
                series={fuelValue.series}
                format={(value) => `${number(value, 1)} millones de USD`}
                tick={millions}
              />
            </Panel>
          ) : null}
          {oreValue.length > 1 ? (
            <Panel
              id="recursos-minerales-metaliferos"
              title="Minerales metalíferos, capítulo 26 completo (millones de USD)"
              lede="El agregado que el registro publica para todo el capítulo 26 del Sistema Armonizado. Se muestra aparte del desglose: sumarlo con las partidas que lo componen contaría dos veces el mismo valor."
              source={SOURCE_CUSTOMS}
            >
              <MacroChart
                data={oreValue}
                unit="millones de USD"
                tone="var(--series-2)"
                label="Minerales metalíferos"
              />
            </Panel>
          ) : null}
        </div>
      ) : null}

      {/*
        Ocho gráficos del Banco Mundial, de tres en tres: la renta y la canasta
        con la comparación regional de la renta; las cuentas ajustadas con su
        desglose y su comparación; y al final la transformación y el ingreso,
        que la rejilla ensancha para que la fila quede llena.
      */}
      <div className="grid-three">
        <Panel
          id="recursos-renta"
          title={RESOURCE_GROUP_LABEL.RENTA}
          lede="La renta de cada recurso —su valor por encima del costo de extracción—, como porcentaje del PIB. El cruce de la línea de minerales con la del gas marca el relevo de la principal fuente de renta del país."
          source={SOURCE}
        >
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
        </Panel>
        <Panel
          id="recursos-canasta"
          title={RESOURCE_GROUP_LABEL.CANASTA}
          lede="Peso de cada grupo de productos en las exportaciones de mercancías. Las manufacturas se mueven en sentido contrario a los productos primarios: suben cuando estos bajan, y en seis décadas no superaron la cuarta parte de la canasta."
          source={SOURCE}
        >
          <div className="stat-strip">
            <Latest code="TX.VAL.MMTL.ZS.UN" board={board} />
            <Latest code="TX.VAL.FUEL.ZS.UN" board={board} />
            <Latest code="TX.VAL.FOOD.ZS.UN" board={board} />
          </div>
          {basket.data.length > 1 ? (
            <WorldLines data={basket.data} series={basket.series} format={share} tick={tick} />
          ) : null}
        </Panel>
        <Panel
          id="recursos-renta-vecinos"
          title="Renta total de recursos naturales, Bolivia y vecinos (% del PIB)"
          lede="Rentas de minerales, gas, petróleo, carbón y bosques sumadas, como porcentaje del PIB de cada país. La línea gruesa es Bolivia; las demás muestran el rango habitual en la región."
          source={SOURCE}
        >
          {totalRent.data.length > 1 ? (
            <WorldLines
              data={totalRent.data}
              series={totalRent.series}
              format={percent}
              tick={tick}
            />
          ) : null}
        </Panel>

        <Panel
          id="recursos-agotamiento"
          title={RESOURCE_GROUP_LABEL.AGOTAMIENTO}
          lede="Las cuentas ajustadas del Banco Mundial restan al ahorro del año la depreciación del capital y el patrimonio natural consumido, y le suman el gasto en educación. Un valor por debajo de cero indica que el país financia su consumo con el agotamiento de sus recursos."
          source={SOURCE}
        >
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
        </Panel>
        <Panel
          id="recursos-patrimonio-consumido"
          title="Patrimonio consumido por recurso (% del INB)"
          lede="El patrimonio natural consumido en el año, repartido entre minerales, energía y bosques. La línea gruesa es la suma; el relevo del gas por los minerales aparece igual que en la renta."
          source={SOURCE}
        >
          {depletion.data.length > 1 ? (
            <WorldLines
              data={depletion.data}
              series={depletion.series}
              format={percent}
              tick={tick}
            />
          ) : null}
        </Panel>
        <Panel
          id="recursos-ahorro-vecinos"
          title="Ahorro neto ajustado, Bolivia y vecinos (% del INB)"
          lede="La misma cuenta para cada vecino. Distingue a una economía que depende de sus recursos de una que consume su patrimonio: son situaciones distintas y esta serie las separa."
          source={SOURCE}
        >
          {savingsAcross.data.length > 1 ? (
            <WorldLines
              data={savingsAcross.data}
              series={savingsAcross.series}
              format={percent}
              tick={tick}
            />
          ) : null}
        </Panel>

        <Panel
          id="recursos-transformacion"
          title={RESOURCE_GROUP_LABEL.TRANSFORMACION}
          lede="Qué parte del PIB generan la manufactura y el agro, y qué parte se invierte en capital fijo. Muestra a largo plazo si la renta de los recursos se transforma en otra actividad."
          source={SOURCE}
        >
          <div className="stat-strip">
            <Latest code="NV.IND.MANF.ZS" board={board} />
            <Latest code="NV.IND.TOTL.ZS" board={board} />
            <Latest code="NE.GDI.FTOT.ZS" board={board} />
          </div>
          {structure.data.length > 1 ? (
            <WorldLines
              data={structure.data}
              series={structure.series}
              format={share}
              tick={tick}
            />
          ) : null}
        </Panel>
        <Panel
          id="recursos-ingreso-ajustado"
          title="Ingreso neto ajustado por habitante (USD de 2015)"
          lede="Dólares constantes de 2015 por persona, descontadas la depreciación del capital y el agotamiento de los recursos naturales. Equivale al ingreso por habitante menos el costo de producirlo en patrimonio."
          source={SOURCE}
        >
          {income.length > 1 ? (
            <MacroChart
              data={income}
              unit="USD"
              tone="var(--series-3)"
              label="Ingreso neto ajustado por habitante"
            />
          ) : null}
        </Panel>
      </div>

      <p className="guest-note">
        El cuadro «Bolivia y sus vecinos» —el último dato de cada país en las series que mejor
        distinguen un caso de otro— está en la página «Bolivia ante el mundo», junto a los de
        energía y medio ambiente.
      </p>
      <p className="guest-note">
        Las rentas, el agotamiento y la comparación regional proceden del Banco Mundial
        (Indicadores del Desarrollo Mundial), sobre un panel de treinta economías. Salen de sus
        cuentas de riqueza y no de la contabilidad nacional boliviana, por lo que se publican con
        más rezago. El detalle por producto es la declaración aduanera de Bolivia ante Naciones
        Unidas (UN Comtrade), por partida del Sistema Armonizado, desde 1992. Las definiciones de
        cada serie están en «Indicadores sociales».
      </p>
    </div>
  );
}
