'use client';

import { MacroChart, WorldLines, seriesTone } from './charts';
import type { WorldLinePoint, WorldLineSeries } from './charts';
import { DerivedReading } from './derived-reading';
import type { IconName } from './icons';
import { Panel } from '@/components/ui/panel';
import { TabHeader } from '@/components/ui/tab-header';
import {
  ENVIRONMENT_GROUP_LABEL,
  ENVIRONMENT_INDICATORS,
  ENVIRONMENT_PLACES,
  WHO_PM25_GUIDELINE,
  type EnvironmentBoard,
} from '@/lib/environment-board';
import { useSinceYear } from './year-floor';

/**
 * El ambiente, dibujado.
 *
 * El orden no es el de un informe ambiental de país industrial. Primero el
 * bosque y el suelo, porque es lo que en Bolivia mueve la aguja; después las
 * emisiones —siempre las dos medidas, con y sin uso del suelo, nunca una
 * sola—; después el aire, que es donde vive la gente; y al final el agua y lo
 * protegido, que son las dos cifras que peor se leen solas y llevan su
 * advertencia escrita al lado.
 *
 * El cuadro del último dato de cada vecino ya no cierra este capítulo: está en
 * «Bolivia ante el mundo», con los de energía y recursos naturales, que es la
 * pestaña que compara países. Aquí queda el aviso de dónde fue.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const CONCLUSION_ICON: Record<string, IconName> = {
  bosque: 'hoja',
  suelo: 'fabrica',
  porhabitante: 'globo',
  aire: 'pulso',
  frontera: 'espiga',
  agua: 'gota',
  proteccion: 'escudo',
};

const indicator = (code: string) => ENVIRONMENT_INDICATORS.find((entry) => entry.code === code);

/** Varias series bolivianas sobre un mismo eje de años. */
function lines(
  board: EnvironmentBoard,
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
    for (const place of ENVIRONMENT_PLACES) {
      row[place.code] =
        points.find((point) => point.place === place.code && point.year === year)?.value ?? null;
    }
    return row;
  });
  const series = ENVIRONMENT_PLACES.filter((place) =>
    points.some((point) => point.place === place.code),
  ).map((place) => ({
    key: place.code,
    label: place.label,
    tone: place.code === 'BOL' ? 'var(--official)' : 'var(--series-rest)',
    emphasis: place.code === 'BOL',
  }));
  return { data, series };
}

function Latest({ code, board }: { code: string; board: EnvironmentBoard }) {
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

/**
 * Quién publica las cifras. Todas llegan por el Banco Mundial; el bosque es del
 * inventario de la FAO, las emisiones del inventario EDGAR bajo las métricas del
 * quinto informe del IPCC y las especies amenazadas de la lista roja de la UICN.
 */
const SOURCE = 'Banco Mundial (Indicadores del Desarrollo Mundial)';
const SOURCE_FOREST = `${SOURCE}, con el inventario de la FAO`;
const SOURCE_GAS = `${SOURCE}, con el inventario EDGAR (métricas del quinto informe del IPCC)`;
const SOURCE_PROTECTED = `${SOURCE}, con la Lista Roja de la UICN`;

const share = (value: number): string => `${number(value, 1)} %`;
const megatonnes = (value: number): string => `${number(value, 1)} Mt`;
const tick = (value: number): string => number(value, 0);

/**
 * `embedded`: el capítulo va dentro de otra página («Clima y ambiente») que ya
 * abre con su cabecera de sección; ahí no repite la suya.
 */
export function EnvironmentExplorer({
  board: entire,
  embedded = false,
}: {
  board: EnvironmentBoard;
  embedded?: boolean;
}) {
  /* El «desde» de la barra de filtros de encima; sin barra, el tablero entero. */
  const board = useSinceYear(entire);
  const land = lines(board, ['AG.LND.FRST.ZS', 'AG.LND.AGRI.ZS', 'AG.LND.ARBL.ZS']);
  const emissions = lines(
    board,
    ['EN.GHG.ALL.LU.MT.CE.AR5', 'EN.GHG.ALL.MT.CE.AR5', 'EN.GHG.CO2.LU.DF.MT.CE.AR5'],
    ['Con uso del suelo', 'Sin uso del suelo', 'Sólo deforestación'],
  );
  const agro = lines(
    board,
    ['EN.GHG.CH4.AG.MT.CE.AR5', 'EN.GHG.N2O.AG.MT.CE.AR5'],
    ['Metano del agro', 'Óxido nitroso del agro'],
  );
  const water = lines(board, ['ER.H2O.FWTL.ZS', 'ER.H2O.FWST.ZS', 'ER.H2O.FWAG.ZS']);
  const forestAcross = placesLines(board.history['AG.LND.FRST.ZS'] ?? []);
  const perCapitaAcross = placesLines(board.history['EN.GHG.ALL.PC.CE.AR5'] ?? []);
  const airAcross = placesLines(board.history['EN.ATM.PM25.MC.M3'] ?? []);
  const forestArea = (board.series['AG.LND.FRST.K2'] ?? []).map((point) => ({
    period: String(point.year),
    value: point.value,
  }));
  const intensity = (board.series['EN.GHG.CO2.RT.GDP.KD'] ?? []).map((point) => ({
    period: String(point.year),
    value: point.value,
  }));

  /** Las cifras de un panel que son solo tarjetas, para que se puedan bajar. */
  const latestRows = (codes: readonly string[]) => ({
    columnas: ['Indicador', 'Valor', 'Unidad', 'Año'],
    filas: codes.flatMap((code) => {
      const meta = indicator(code);
      const reading = board.series[code]?.at(-1);
      return meta && reading ? [[meta.label, reading.value, meta.unit, reading.year]] : [];
    }),
  });

  return (
    <div className="stack guest-board">
      {embedded ? null : (
        <TabHeader
          id="ambiente"
          title="Medio ambiente"
          lede={`Cobertura de bosque, emisiones, calidad del aire y extracción de agua. Todas las cifras son del Banco Mundial, con una definición común para Bolivia y sus vecinos. El dato más reciente es de ${board.asOfYear ?? '—'}; los inventarios de emisiones y de bosque cierran en años distintos, por lo que cada panel indica el suyo.`}
        />
      )}
      <DerivedReading
        title="Qué dicen estos datos"
        note="Cada frase se calcula con las series de este capítulo y se actualiza con cada carga. Indica el nivel y la referencia con que se compara; no explica causas ni anticipa tendencias."
        conclusions={board.conclusions}
        icons={CONCLUSION_ICON}
      />

      {/*
        Diez paneles, de tres en tres: el bosque con sus dos vistas; las
        emisiones con la comparación por habitante y el agro; el aire, la
        intensidad y el agua; y lo protegido al final, ensanchado por la
        rejilla, que son cinco cifras sin gráfico y leen bien a lo ancho.
      */}
      <div className="grid-three">
        <Panel
          id="ambiente-bosque"
          title={ENVIRONMENT_GROUP_LABEL.BOSQUE}
          lede="Parte del territorio cubierta de bosque y parte dedicada a la agricultura. Las dos líneas se mueven en espejo: lo que gana la frontera agrícola lo pierde el bosque."
          source={SOURCE_FOREST}
        >
          <div className="stat-strip">
            <Latest code="AG.LND.FRST.ZS" board={board} />
            <Latest code="AG.LND.FRST.K2" board={board} />
            <Latest code="AG.LND.AGRI.ZS" board={board} />
            <Latest code="AG.LND.ARBL.ZS" board={board} />
          </div>
          {land.data.length > 1 ? (
            <WorldLines data={land.data} series={land.series} format={share} tick={tick} />
          ) : null}
        </Panel>
        <Panel
          id="ambiente-bosque-km2"
          title="Superficie de bosque (km²)"
          lede="La misma superficie en kilómetros cuadrados, que muestra la magnitud de la pérdida: el porcentaje baja despacio porque el territorio es extenso."
          source={SOURCE_FOREST}
        >
          {forestArea.length > 1 ? (
            <MacroChart data={forestArea} unit="km²" tone="var(--series-2)" label="Bosque" />
          ) : null}
        </Panel>
        <Panel
          id="ambiente-bosque-vecinos"
          title="Bosque, Bolivia y sus vecinos (% del territorio)"
          lede="La cobertura de cada país sobre el mismo eje. La línea gruesa es Bolivia. La pendiente dice más que el nivel, porque el nivel lo fija la geografía."
          source={SOURCE_FOREST}
        >
          {forestAcross.data.length > 1 ? (
            <WorldLines
              data={forestAcross.data}
              series={forestAcross.series}
              format={share}
              tick={tick}
            />
          ) : null}
        </Panel>

        <Panel
          id="ambiente-emisiones"
          title={ENVIRONMENT_GROUP_LABEL.EMISIONES}
          lede="Las emisiones del país en sus dos medidas: sin el cambio de uso del suelo y con él. Se presentan juntas porque la primera, la que suelen citar los informes, deja fuera la deforestación, la mayor fuente de emisiones de Bolivia."
          source={SOURCE_GAS}
        >
          <div className="stat-strip">
            <Latest code="EN.GHG.ALL.LU.MT.CE.AR5" board={board} />
            <Latest code="EN.GHG.ALL.MT.CE.AR5" board={board} />
            <Latest code="EN.GHG.CO2.LU.DF.MT.CE.AR5" board={board} />
            <Latest code="EN.GHG.ALL.PC.CE.AR5" board={board} />
            <Latest code="EN.GHG.TOT.ZG.AR5" board={board} />
          </div>
          {emissions.data.length > 1 ? (
            <WorldLines
              data={emissions.data}
              series={emissions.series}
              format={megatonnes}
              tick={tick}
            />
          ) : null}
        </Panel>
        <Panel
          id="ambiente-emisiones-habitante"
          title="Emisiones por habitante, Bolivia y vecinos (t de CO₂ equivalente)"
          lede="Toneladas por persona, sin el cambio de uso del suelo, para comparar países de tamaños distintos. La línea gruesa es Bolivia."
          source={SOURCE_GAS}
        >
          {perCapitaAcross.data.length > 1 ? (
            <WorldLines
              data={perCapitaAcross.data}
              series={perCapitaAcross.series}
              format={(value) => `${number(value, 2)} t`}
              tick={(value) => number(value, 1)}
            />
          ) : null}
        </Panel>
        <Panel
          id="ambiente-gases-agro"
          title="Gases del agro (Mt de CO₂ equivalente)"
          lede="Metano del ganado y del arroz, y óxido nitroso de los fertilizantes y del manejo del suelo. Es la parte de las emisiones que crece con la frontera agrícola, no con la industria."
          source={SOURCE_GAS}
        >
          {agro.data.length > 1 ? (
            <WorldLines
              data={agro.data}
              series={agro.series}
              format={(value) => `${number(value, 2)} Mt`}
              tick={(value) => number(value, 1)}
            />
          ) : null}
        </Panel>

        <Panel
          id="ambiente-aire"
          title={ENVIRONMENT_GROUP_LABEL.AIRE}
          lede={`Exposición media de la población a partículas finas, Bolivia y sus vecinos. La referencia es la guía de la Organización Mundial de la Salud (OMS) de 2021, de ${WHO_PM25_GUIDELINE} µg/m³, no la propia historia de la serie.`}
          source={SOURCE}
        >
          <div className="stat-strip">
            <Latest code="EN.ATM.PM25.MC.M3" board={board} />
            <Latest code="EN.ATM.PM25.MC.ZS" board={board} />
            <Latest code="NY.ADJ.DPEM.GN.ZS" board={board} />
          </div>
          {airAcross.data.length > 1 ? (
            <WorldLines
              data={airAcross.data}
              series={airAcross.series}
              format={(value) => `${number(value, 1)} µg/m³`}
              tick={(value) => number(value, 0)}
            />
          ) : null}
        </Panel>
        <Panel
          id="ambiente-intensidad-carbono"
          title="Intensidad de carbono (kg de CO₂ por USD de 2015)"
          lede="CO₂ emitido por cada dólar de PIB. Baja cuando la producción se vuelve más limpia, pero también cuando la economía se desplaza hacia los servicios; un descenso no distingue entre ambas causas."
          source={SOURCE}
        >
          {intensity.length > 1 ? (
            <MacroChart
              data={intensity}
              unit="kg/USD"
              tone="var(--series-3)"
              label="Intensidad de carbono"
            />
          ) : null}
        </Panel>
        <Panel
          id="ambiente-agua"
          title={ENVIRONMENT_GROUP_LABEL.AGUA}
          lede="El promedio nacional oculta la escasez local: el recurso renovable está casi todo en la cuenca amazónica y la extracción se concentra en el altiplano y los valles. Un estrés hídrico nacional bajo convive así con falta de agua en las zonas más pobladas."
          source={SOURCE}
        >
          <div className="stat-strip">
            <Latest code="ER.H2O.FWST.ZS" board={board} />
            <Latest code="ER.H2O.FWAG.ZS" board={board} />
            <Latest code="ER.H2O.INTR.PC" board={board} />
            <Latest code="ER.GDP.FWTL.M3.KD" board={board} />
          </div>
          {water.data.length > 1 ? (
            <WorldLines data={water.data} series={water.series} format={share} tick={tick} />
          ) : null}
        </Panel>

        <Panel
          id="ambiente-proteccion"
          title={ENVIRONMENT_GROUP_LABEL.PROTECCION}
          lede="Superficie declarada protegida y especies amenazadas según la Lista Roja de la Unión Internacional para la Conservación de la Naturaleza (UICN). La primera cifra mide la figura legal, no el control efectivo sobre el terreno."
          source={SOURCE_PROTECTED}
          data={() =>
            latestRows([
              'ER.LND.PTLD.ZS',
              'EN.MAM.THRD.NO',
              'EN.BIR.THRD.NO',
              'EN.HPT.THRD.NO',
              'EN.FSH.THRD.NO',
            ])
          }
        >
          <div className="stat-strip">
            <Latest code="ER.LND.PTLD.ZS" board={board} />
            <Latest code="EN.MAM.THRD.NO" board={board} />
            <Latest code="EN.BIR.THRD.NO" board={board} />
            <Latest code="EN.HPT.THRD.NO" board={board} />
            <Latest code="EN.FSH.THRD.NO" board={board} />
          </div>
        </Panel>
      </div>

      <p className="guest-note">
        El cuadro «Bolivia y sus vecinos» —el último dato de cada país en las series que distinguen
        un territorio de otro— se encuentra en la página «Bolivia ante el mundo», junto a los de
        energía y recursos naturales.
      </p>
      <p className="guest-note">
        Series del Banco Mundial (Indicadores del Desarrollo Mundial), tomadas del panel de treinta
        economías que recopila DatosBolivia. El bosque procede del inventario de la FAO, las
        emisiones del inventario EDGAR con las métricas del quinto informe del IPCC, y las especies
        amenazadas de la Lista Roja de la UICN. Las definiciones de cada serie están en
        «Indicadores sociales».
      </p>
    </div>
  );
}
