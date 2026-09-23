'use client';

import { MacroChart, WorldLines, seriesTone } from './charts';
import type { WorldLinePoint, WorldLineSeries } from './charts';
import { DerivedReading } from './derived-reading';
import { Icon } from './icons';
import type { IconName } from './icons';
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
  type ResourceGroup,
} from '@/lib/resources-board';

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
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Recursos naturales</h2>
          <p className="panel-sub">
            Qué sale del país, qué deja el subsuelo, cuánto patrimonio se consume al sacarlo y en
            qué se convierte. Dos fuentes: la declaración aduanera ante Naciones Unidas, que da el
            detalle por producto —de ahí sale el litio—, y el Banco Mundial, que da las rentas y las
            cuentas ajustadas con la misma definición para Bolivia y para cada vecino. El dato más
            reciente es de {board.asOfYear ?? '—'}; las aduanas cierran un año después y las cuentas
            ajustadas dos o tres, así que no todos los paneles terminan igual y cada uno lleva su
            año escrito.
          </p>
        </div>
        <DerivedReading
          title="Qué dicen estos datos"
          note="Cada frase sale de las series de este capítulo y se recalcula con cada carga. Dice qué nivel hay y contra qué se compara; no dice por qué ni qué va a pasar."
          conclusions={board.conclusions}
          icons={CONCLUSION_ICON}
        />
      </div>

      {/*
        El desglose por producto sólo se dibuja si el núcleo ya lo cargó.

        El tablero se despliega desde un repositorio distinto del que migra y
        siembra, así que entre un despliegue y el otro estas series no están.
        Un panel vacío con su leyenda sin líneas se lee como una avería; que el
        capítulo empiece por las rentas, no.
      */}
      {mineralValue.data.length > 1 ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Minerales exportados por producto (millones de US$)</h2>
            <p className="panel-sub">
              Lo que de verdad sale del país, partida por partida, tal como Bolivia lo declaró en
              aduana ante Naciones Unidas desde 1992. Las rentas de arriba dicen cuánto deja el
              subsuelo; esto dice qué se vende. El concentrado de cinc y los minerales de oro y
              plata son dos negocios distintos y aquí se ven separados por primera vez.
            </p>
          </div>
          <WorldLines
            data={mineralValue.data}
            series={mineralValue.series}
            format={(value) => `${number(value, 1)} millones de US$`}
            tick={millions}
          />
        </div>
      ) : null}

      {mineralWeight.data.length > 1 || lithiumWeight.length > 1 ? (
        <div className="grid-pair">
          {mineralWeight.data.length > 1 ? (
            <div className="panel">
              <div className="panel-head">
                <h2>Peso exportado por mineral (miles de toneladas)</h2>
                <p className="panel-sub">
                  La misma canasta medida en peso y no en plata. Es la diferencia entre «subió el
                  precio» y «salió más»: el valor de una exportación de oro se duplica con el precio
                  sin que salga un gramo más, y sólo esta medida lo distingue.
                </p>
              </div>
              <WorldLines
                data={mineralWeight.data}
                series={mineralWeight.series}
                format={(value) => `${number(value, 0)} mil t`}
                tick={tick}
              />
            </div>
          ) : null}
          {lithiumWeight.length > 1 ? (
            <div className="panel">
              <div className="panel-head">
                <h2>Carbonato de litio exportado (toneladas)</h2>
                <p className="panel-sub">
                  El litio no tiene partida de mineral: lo que cruza la frontera es carbonato, que el
                  Sistema Armonizado clasifica entre los productos químicos (2836.91) y no entre los
                  minerales. Buscarlo en el capítulo de minería es no encontrarlo nunca, que es la
                  razón por la que este informe no tenía una sola cifra suya. Hay años sin
                  declaración en el registro y la línea une los puntos que existen: donde el tramo
                  es largo y recto no hay dato intermedio, hay un hueco.
                </p>
              </div>
              <MacroChart
                data={lithiumWeight}
                unit="t"
                tone="var(--series-4)"
                label="Carbonato de litio"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {fuelValue.data.length > 1 || oreValue.length > 1 ? (
        <div className="grid-pair">
          {fuelValue.data.length > 1 ? (
            <div className="panel">
              <div className="panel-head">
                <h2>Hidrocarburos exportados (millones de US$)</h2>
                <p className="panel-sub">
                  El gas y sus compañeros, en la misma unidad y sobre el mismo registro que los
                  minerales, para que la comparación entre los dos no dependa de dos fuentes
                  distintas.
                </p>
              </div>
              <WorldLines
                data={fuelValue.data}
                series={fuelValue.series}
                format={(value) => `${number(value, 1)} millones de US$`}
                tick={millions}
              />
            </div>
          ) : null}
          {oreValue.length > 1 ? (
            <div className="panel">
              <div className="panel-head">
                <h2>Minerales metalíferos, capítulo entero (millones de US$)</h2>
                <p className="panel-sub">
                  El agregado que el registro publica para todo el capítulo 26. Va aparte del
                  desglose y no encima de él: sumarlo con las partidas que lo componen contaría lo
                  mismo dos veces.
                </p>
              </div>
              <MacroChart
                data={oreValue}
                unit="millones de US$"
                tone="var(--series-2)"
                label="Minerales metalíferos"
              />
            </div>
          ) : null}
        </div>
      ) : null}

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

      <p className="panel-sub">
        <Icon name="info" size={12} /> El cuadro «Bolivia y sus vecinos» —el último dato de cada
        país en las series que distinguen un caso de otro— está ahora en la pestaña «Bolivia ante el
        mundo», junto a los de energía y medio ambiente.
      </p>

      <p className="panel-sub">
        <Icon name="info" size={12} /> Las rentas, el agotamiento y la comparación regional salen
        del Banco Mundial (Indicadores del Desarrollo Mundial), leídos del panel de treinta
        economías que recoge el núcleo del observatorio; vienen de sus cuentas de riqueza y no de la
        contabilidad nacional boliviana, y por eso cierran más tarde. El detalle por producto es la
        declaración aduanera de Bolivia ante Naciones Unidas (UN Comtrade), por partida del Sistema
        Armonizado, desde 1992. Las definiciones de cada serie del panel están en «Social Info».
      </p>
    </>
  );
}
