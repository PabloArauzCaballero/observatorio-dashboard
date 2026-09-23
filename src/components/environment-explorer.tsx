'use client';

import type { ReactNode } from 'react';

import { MacroChart, WorldLines, seriesTone } from './charts';
import type { WorldLinePoint, WorldLineSeries } from './charts';
import { DerivedReading } from './derived-reading';
import { Icon } from './icons';
import type { IconName } from './icons';
import {
  ENVIRONMENT_GROUP_LABEL,
  ENVIRONMENT_INDICATORS,
  ENVIRONMENT_PLACES,
  WHO_PM25_GUIDELINE,
  type EnvironmentBoard,
  type EnvironmentGroup,
} from '@/lib/environment-board';

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

/* `ReactNode` y no `string`: la entradilla del aire lleva dentro la guía de la OMS. */
function GroupHead({ group, children }: { group: EnvironmentGroup; children: ReactNode }) {
  return (
    <div className="panel-head">
      <h2>{ENVIRONMENT_GROUP_LABEL[group]}</h2>
      <p className="panel-sub">{children}</p>
    </div>
  );
}

const share = (value: number): string => `${number(value, 1)} %`;
const megatonnes = (value: number): string => `${number(value, 1)} Mt`;
const tick = (value: number): string => number(value, 0);

export function EnvironmentExplorer({ board }: { board: EnvironmentBoard }) {
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

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Medio ambiente</h2>
          <p className="panel-sub">
            El bosque que queda, lo que el país emite, el aire que respira y el agua que extrae.
            Todas las cifras son del Banco Mundial con la misma definición para Bolivia y para cada
            vecino. El dato más reciente es de {board.asOfYear ?? '—'}: los inventarios de emisiones
            cierran antes que los de bosque, así que no todos los paneles terminan en el mismo año y
            cada uno lleva el suyo escrito.
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
        Diez paneles, de tres en tres: el bosque con sus dos vistas; las
        emisiones con la comparación por habitante y el agro; el aire, la
        intensidad y el agua; y lo protegido al final, ensanchado por la
        rejilla, que son cinco cifras sin gráfico y leen bien a lo ancho.
      */}
      <div className="grid-three">
        <div className="panel">
          <GroupHead group="BOSQUE">
            El bosque y el suelo: qué parte del país está cubierta de bosque y qué parte es tierra
            agrícola. Las dos líneas se mueven en espejo, que es lo que quiere decir frontera
            agrícola.
          </GroupHead>
          <div className="stat-strip">
            <Latest code="AG.LND.FRST.ZS" board={board} />
            <Latest code="AG.LND.FRST.K2" board={board} />
            <Latest code="AG.LND.AGRI.ZS" board={board} />
            <Latest code="AG.LND.ARBL.ZS" board={board} />
          </div>
          {land.data.length > 1 ? (
            <WorldLines data={land.data} series={land.series} format={share} tick={tick} />
          ) : null}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Bosque que queda (km²)</h2>
            <p className="panel-sub">
              La misma superficie en kilómetros cuadrados, que es donde se ve el tamaño de lo
              perdido: el porcentaje baja despacio porque el territorio es grande.
            </p>
          </div>
          {forestArea.length > 1 ? (
            <MacroChart data={forestArea} unit="km²" tone="var(--series-2)" label="Bosque" />
          ) : null}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Bosque, Bolivia contra sus vecinos (% del territorio)</h2>
            <p className="panel-sub">
              La cobertura de cada país sobre el mismo eje. La línea gruesa es Bolivia; la pendiente
              importa más que el nivel, porque el nivel lo fija la geografía.
            </p>
          </div>
          {forestAcross.data.length > 1 ? (
            <WorldLines
              data={forestAcross.data}
              series={forestAcross.series}
              format={share}
              tick={tick}
            />
          ) : null}
        </div>

        <div className="panel">
          <GroupHead group="EMISIONES">
            Lo que el país emite, en las dos medidas que existen: sin contar el cambio de uso del
            suelo y contándolo. Van juntas a propósito — dar sólo la primera, que es la que suelen
            citar los informes, dice casi lo contrario de lo que pasa.
          </GroupHead>
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
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Emisiones por habitante, Bolivia y vecinos (t de CO₂ equivalente)</h2>
            <p className="panel-sub">
              Sin contar el uso del suelo, que es la única forma de que la comparación entre países
              de tamaños distintos signifique algo.
            </p>
          </div>
          {perCapitaAcross.data.length > 1 ? (
            <WorldLines
              data={perCapitaAcross.data}
              series={perCapitaAcross.series}
              format={(value) => `${number(value, 2)} t`}
              tick={(value) => number(value, 1)}
            />
          ) : null}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Gases del agro (Mt de CO₂ equivalente)</h2>
            <p className="panel-sub">
              Metano del ganado y del arroz, y óxido nitroso de los fertilizantes y del manejo del
              suelo. Es la parte de las emisiones que crece con la frontera agrícola y no con la
              industria.
            </p>
          </div>
          {agro.data.length > 1 ? (
            <WorldLines
              data={agro.data}
              series={agro.series}
              format={(value) => `${number(value, 2)} Mt`}
              tick={(value) => number(value, 1)}
            />
          ) : null}
        </div>

        <div className="panel">
          <GroupHead group="AIRE">
            El aire que se respira, medido como exposición media de la población a partículas finas.
            La guía de la OMS desde 2021 es de {WHO_PM25_GUIDELINE} µg/m³, y es contra ella —y no
            contra el propio pasado— como se lee esta serie.
          </GroupHead>
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
        </div>
        <div className="panel">
          <div className="panel-head">
            <h2>Intensidad de carbono (kg de CO₂ por US$ de 2015)</h2>
            <p className="panel-sub">
              Cuánto CO₂ cuesta producir un dólar. Baja cuando la economía se limpia y también
              cuando simplemente se mueve hacia servicios, así que no es por sí sola una buena
              noticia.
            </p>
          </div>
          {intensity.length > 1 ? (
            <MacroChart
              data={intensity}
              unit="kg/US$"
              tone="var(--series-3)"
              label="Intensidad de carbono"
            />
          ) : null}
        </div>
        <div className="panel">
          <GroupHead group="AGUA">
            El agua extraída y el agua disponible. La cifra nacional es engañosa y conviene decirlo
            en el mismo sitio donde se dibuja: el recurso renovable está casi todo en la cuenca
            amazónica y la extracción está en el altiplano y en el valle, así que un estrés hídrico
            nacional bajo convive con escasez local.
          </GroupHead>
          <div className="stat-strip">
            <Latest code="ER.H2O.FWST.ZS" board={board} />
            <Latest code="ER.H2O.FWAG.ZS" board={board} />
            <Latest code="ER.H2O.INTR.PC" board={board} />
            <Latest code="ER.GDP.FWTL.M3.KD" board={board} />
          </div>
          {water.data.length > 1 ? (
            <WorldLines data={water.data} series={water.series} format={share} tick={tick} />
          ) : null}
        </div>

        <div className="panel">
          <GroupHead group="PROTECCION">
            Lo que está declarado protegido y lo que la lista roja de la UICN cuenta aparte. La
            primera cifra es de papel: dice qué tiene figura legal, no qué se vigila.
          </GroupHead>
          <div className="stat-strip">
            <Latest code="ER.LND.PTLD.ZS" board={board} />
            <Latest code="EN.MAM.THRD.NO" board={board} />
            <Latest code="EN.BIR.THRD.NO" board={board} />
            <Latest code="EN.HPT.THRD.NO" board={board} />
            <Latest code="EN.FSH.THRD.NO" board={board} />
          </div>
        </div>
      </div>

      <p className="panel-sub">
        <Icon name="info" size={12} /> El cuadro «Bolivia y sus vecinos» —el último dato de cada
        país en las series que distinguen un territorio de otro— está ahora en la pestaña «Bolivia
        ante el mundo», junto a los de energía y recursos naturales.
      </p>

      <p className="panel-sub">
        <Icon name="info" size={12} /> Series del Banco Mundial (Indicadores del Desarrollo
        Mundial), leídas del panel de treinta economías que recoge el núcleo del observatorio. El
        bosque viene del inventario de la FAO, las emisiones del inventario EDGAR bajo las métricas
        del quinto informe del IPCC, y las especies amenazadas de la lista roja de la UICN. Las
        definiciones de cada serie están en «Social Info».
      </p>
    </>
  );
}
