'use client';

import { useState } from 'react';
import { DivergingBars, ShareBars, seriesTone } from './charts';
import { Icon } from './icons';
import { MacroViewChart } from './macro-view-chart';
import { OnOpenNotice } from './on-open';
import { Panel } from '@/components/ui/panel';
import { celda } from '@/components/ui/panel-data';
import type { DatosDeFigura } from '@/components/ui/panel-data';
import { ViewToggle } from '@/components/ui/view-toggle';
import { ENERGY_PLACES, type EnergyBoard } from '@/lib/energy-board';
import { ENVIRONMENT_PLACES, type EnvironmentBoard } from '@/lib/environment-board';
import { RESOURCE_PLACES, type ResourceBoard } from '@/lib/resources-board';

/**
 * Bolivia y sus vecinos: el último dato de cada país, en tres cuadros.
 *
 * Los tres cuadros vivían cada uno al pie de su capítulo —Energía, Recursos
 * naturales, Medio ambiente— y ahí eran la única comparación entre países de
 * una pestaña que se llama «Series de Bolivia». La pregunta que contestan es la
 * de «Bolivia ante el mundo»: dónde queda el país al lado de los suyos. Así que
 * van juntos allí, uno detrás de otro, y cada capítulo de origen dice dónde
 * están ahora.
 *
 * Cada cuadro lee el tablero de su capítulo tal como lo sirve su dirección
 * —`/api/energia`, `/api/recursos`, `/api/ambiente`—, y el tablero lo pide la
 * pestaña al abrirse, no la portada: los tres se dejan guardar diez minutos en
 * el navegador, así que quien ya abrió Energía no vuelve a pagar la lectura
 * aquí, ni al revés. Ninguna de las tres direcciones cambia de forma por esto.
 *
 * Las columnas son las mismas que tenían los cuadros de origen y por la misma
 * razón: son las series que distinguen un caso del otro. La unidad va en la
 * cabecera y el año del dato entre paréntesis, porque no todos los países
 * cierran el mismo año y una tabla que lo esconde compara 2021 con 2023 sin
 * decirlo.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Una columna del cuadro: el código de la serie, su rótulo, sus decimales y su sufijo. */
interface Column {
  code: string;
  label: string;
  decimals: number;
  unit: string;
}

/** La forma común de los tres tableros: el último dato de cada lugar por serie. */
interface LatestByPlace {
  latest: Record<string, Record<string, { year: number; value: number }>>;
}

/**
 * Las cifras del cuadro tal como se bajan: el valor sin redondear y el año aparte.
 *
 * En pantalla cada celda dice «12 % (2021)»; en un archivo eso es texto y no se puede
 * ordenar ni sumar. Cada columna se parte en dos: el valor y el año del dato.
 */
function datasetOf(
  board: LatestByPlace,
  places: ReadonlyArray<{ code: string; label: string }>,
  columns: ReadonlyArray<Column>,
): DatosDeFigura {
  const named = (column: Column): string =>
    column.unit.trim() ? `${column.label} (${column.unit.trim()})` : column.label;
  return {
    unidad: 'cada columna en la unidad de su cabecera',
    columnas: [
      'País',
      ...columns.flatMap((column) => [named(column), `${column.label}: año del dato`]),
    ],
    filas: places.map((place) => [
      place.label,
      ...columns.flatMap((column) => {
        const reading = board.latest[column.code]?.[place.code];
        return [celda(reading?.value), celda(reading?.year)];
      }),
    ]),
    nota: 'El último dato publicado de cada país; no todos cierran el mismo año.',
  };
}

/**
 * El cuadro en sí, escrito una vez para los tres capítulos.
 *
 * Los tres armaban la misma tabla a mano, con las mismas clases y la misma
 * celda vacía. La única diferencia real —qué columnas y qué lugares— entra por
 * parámetro.
 */
function LatestTable({
  board,
  places,
  columns,
}: {
  board: LatestByPlace;
  places: ReadonlyArray<{ code: string; label: string }>;
  columns: ReadonlyArray<Column>;
}) {
  const cell = (place: string, column: Column): string => {
    const reading = board.latest[column.code]?.[place];
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
          {places.map((place) => (
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

/**
 * El mismo cuadro como barras: una serie a la vez, un país por barra.
 *
 * Las columnas del cuadro no comparten unidad —un porcentaje, kilos por habitante, toneladas de
 * CO₂—, así que no caben en un mismo eje; se elige la serie y se ven los países uno contra otro,
 * con Bolivia en el color de acento y los demás en el gris de contexto. Una serie con valores
 * negativos (la importación neta de un exportador de energía, el ahorro ajustado) pasa al
 * gráfico con cero en el centro. Las cifras son las de la tabla: el último dato de cada país,
 * y el año de cada uno va en el emergente porque no todos cierran el mismo año.
 */
function LatestChart({
  board,
  places,
  columns,
}: {
  board: LatestByPlace;
  places: ReadonlyArray<{ code: string; label: string }>;
  columns: ReadonlyArray<Column>;
}) {
  const withData = columns.filter((column) =>
    places.some((place) => board.latest[column.code]?.[place.code]),
  );
  const [code, setCode] = useState(withData[0]?.code ?? '');
  const column = withData.find((one) => one.code === code) ?? withData[0];
  if (!column) return <div className="callout">Este cuadro no tiene series con datos.</div>;

  const readings = places.flatMap((place) => {
    const reading = board.latest[column.code]?.[place.code];
    return reading ? [{ place, reading }] : [];
  });
  const unit = column.unit.trim();
  const signed = readings.some(({ reading }) => reading.value < 0);
  const years = [...new Set(readings.map(({ reading }) => reading.year))].sort();

  return (
    <>
      <div className="chips" role="group" aria-label="Serie que se dibuja">
        {withData.map((one) => (
          <button
            key={one.code}
            type="button"
            className={one.code === column.code ? 'chip chip-on' : 'chip'}
            aria-pressed={one.code === column.code}
            onClick={() => setCode(one.code)}
          >
            {one.label}
          </button>
        ))}
      </div>
      <MacroViewChart
        {...(signed
          ? {}
          : {
              legend: [
                { color: seriesTone(0), label: `Bolivia${unit ? ` (${unit})` : ''}` },
                { color: 'var(--series-rest)', label: 'Los demás países' },
              ],
            })}
      >
        {signed ? (
          <DivergingBars
            data={readings.map(({ place, reading }) => ({
              name: place.label,
              value: reading.value,
              meta: `Dato de ${reading.year}`,
            }))}
            unit={unit || column.label}
            height={Math.max(220, readings.length * 28 + 48)}
          />
        ) : (
          <ShareBars
            data={readings.map(({ place, reading }) => ({
              name: place.label,
              value: reading.value,
              ...(place.code === 'BOL' ? { emphasis: true } : {}),
              note: `Dato de ${reading.year}`,
            }))}
            tone={seriesTone(0)}
            unit={unit}
            decimals={column.decimals}
            height={Math.max(220, readings.length * 28 + 24)}
            declare={false}
          />
        )}
      </MacroViewChart>
      <p className="chart-note">
        {column.label}
        {unit ? ` (${unit})` : ''}, último dato de cada país
        {years.length === 1 ? `: ${years[0]}` : `: de ${years[0]} a ${years.at(-1)}`}.
      </p>
    </>
  );
}

/* Los porcentajes del Banco Mundial terminan en `.ZS`; los de la ONU, en `.UN`. */
const ENERGY_COLUMNS: ReadonlyArray<Column> = [
  { code: 'EG.ELC.NGAS.ZS', label: 'Gas en la electricidad', decimals: 0, unit: ' %' },
  { code: 'EG.ELC.HYRO.ZS', label: 'Hidro', decimals: 0, unit: ' %' },
  { code: 'EG.ELC.RNWX.ZS', label: 'Otras renovables', decimals: 0, unit: ' %' },
  { code: 'EG.FEC.RNEW.ZS', label: 'Renovables en el consumo', decimals: 0, unit: ' %' },
  { code: 'EG.USE.PCAP.KG.OE', label: 'Energía por hab. (kg)', decimals: 0, unit: '' },
  { code: 'EG.IMP.CONS.ZS', label: 'Importación neta', decimals: 0, unit: ' %' },
  { code: 'TX.VAL.FUEL.ZS.UN', label: 'Combustible exportado', decimals: 0, unit: ' %' },
  { code: 'TM.VAL.FUEL.ZS.UN', label: 'Combustible importado', decimals: 0, unit: ' %' },
];

/*
 * La columna que importa es la última: la renta alta se puede sostener, y el
 * ahorro ajustado es lo que dice si se está sosteniendo o gastando.
 */
const RESOURCE_COLUMNS: ReadonlyArray<Column> = [
  { code: 'NY.GDP.MINR.RT.ZS', label: 'Renta minera', decimals: 2, unit: ' %' },
  { code: 'NY.GDP.NGAS.RT.ZS', label: 'Renta del gas', decimals: 2, unit: ' %' },
  { code: 'NY.GDP.PETR.RT.ZS', label: 'Renta del petróleo', decimals: 2, unit: ' %' },
  { code: 'NY.GDP.TOTL.RT.ZS', label: 'Renta total', decimals: 2, unit: ' %' },
  { code: 'TX.VAL.MMTL.ZS.UN', label: 'Minerales exportados', decimals: 0, unit: ' %' },
  { code: 'NV.IND.MANF.ZS', label: 'Manufactura', decimals: 1, unit: ' %' },
  { code: 'NY.ADJ.DRES.GN.ZS', label: 'Agotamiento', decimals: 2, unit: ' %' },
  { code: 'NY.ADJ.SVNX.GN.ZS', label: 'Ahorro ajustado', decimals: 2, unit: ' %' },
];

const ENVIRONMENT_COLUMNS: ReadonlyArray<Column> = [
  { code: 'AG.LND.FRST.ZS', label: 'Bosque', decimals: 1, unit: ' %' },
  { code: 'AG.LND.AGRI.ZS', label: 'Tierra agrícola', decimals: 1, unit: ' %' },
  { code: 'EN.GHG.ALL.PC.CE.AR5', label: 'Emisiones por hab.', decimals: 2, unit: ' t' },
  { code: 'EN.GHG.CO2.RT.GDP.KD', label: 'Intensidad de carbono', decimals: 3, unit: ' kg/$' },
  { code: 'EN.ATM.PM25.MC.M3', label: 'PM2,5', decimals: 1, unit: ' µg/m³' },
  { code: 'ER.H2O.FWST.ZS', label: 'Estrés hídrico', decimals: 2, unit: ' %' },
  { code: 'ER.LND.PTLD.ZS', label: 'Áreas protegidas', decimals: 1, unit: ' %' },
];

/** Lo que `useOnOpen` devuelve de cada dirección: el tablero, o que no llegó. */
export interface OpenedBoard<T> {
  payload: { board: T } | null;
  failed: boolean;
}

const SOURCE =
  'Banco Mundial, Indicadores del Desarrollo Mundial (WDI), leídos del panel de treinta economías del Observatorio';

/**
 * Un panel de la sección: el cuadro, o el aviso de que no está.
 *
 * Un tablero sin series —el núcleo todavía no las cargó— no dibuja una tabla de
 * guiones: dice que falta, igual que lo dice el capítulo de origen. Mientras no
 * hay cuadro tampoco hay descarga que ofrecer.
 */
function Block<T extends LatestByPlace>({
  id,
  title,
  lede,
  note,
  what,
  opened,
  places,
  columns,
}: {
  id: string;
  title: string;
  lede: string;
  /** La lectura larga, plegada bajo el cuadro. */
  note: string;
  what: string;
  opened: OpenedBoard<T>;
  places: ReadonlyArray<{ code: string; label: string }>;
  columns: ReadonlyArray<Column>;
}) {
  const board = opened.payload?.board ?? null;
  const empty = board !== null && Object.keys(board.latest).length === 0;
  const ready = board !== null && !empty;
  return (
    <Panel
      id={id}
      title={title}
      lede={lede}
      source={SOURCE}
      downloadable={ready}
      {...(ready ? { data: () => datasetOf(board, places, columns) } : {})}
    >
      {board === null ? (
        <OnOpenNotice what={what} failed={opened.failed} />
      ) : empty ? (
        <div className="callout">
          Todavía no hay series de este capítulo leídas del panel del Banco Mundial. El cuadro se
          llena solo cuando el núcleo las tenga cargadas.
        </div>
      ) : (
        <>
          <ViewToggle
            chart={<LatestChart board={board} places={places} columns={columns} />}
            table={<LatestTable board={board} places={places} columns={columns} />}
          />
          <details className="panel-note">
            <summary>Cómo leerlo</summary>
            <p>{note}</p>
          </details>
        </>
      )}
    </Panel>
  );
}

/**
 * La sección entera: un rótulo y los tres paneles, en el orden de los capítulos
 * de origen. Los tres tableros los pide quien monta la sección, para que las
 * lecturas arranquen a la vez que la del tablero mundial y no después.
 */
export function NeighboursSection({
  energy,
  resources,
  environment,
}: {
  energy: OpenedBoard<EnergyBoard>;
  resources: OpenedBoard<ResourceBoard>;
  environment: OpenedBoard<EnvironmentBoard>;
}) {
  return (
    <section className="panel-group" aria-labelledby="vecinos-titulo" id="vecinos">
      <div className="panel-group-head">
        <h3 id="vecinos-titulo">Bolivia y sus vecinos</h3>
        <p>El último dato de cada país en energía, recursos naturales y medio ambiente.</p>
      </div>
      <Block
        id="vecinos-energia"
        title="Energía de Bolivia y sus vecinos (% y kg por habitante, último dato)"
        lede="Las series que distinguen una matriz de otra."
        note="Cada columna lleva su unidad en la cabecera y el año del dato entre paréntesis. Una importación neta negativa es un exportador de energía."
        what="la matriz energética de los vecinos"
        opened={energy}
        places={ENERGY_PLACES}
        columns={ENERGY_COLUMNS}
      />
      <Block
        id="vecinos-recursos"
        title="Recursos naturales de Bolivia y sus vecinos (% de cada serie, último dato)"
        lede="Las series que distinguen un caso de otro."
        note="Perú y Chile también viven de minerales; lo que cambia entre ellos y Bolivia está en las dos últimas columnas. Cada columna lleva su unidad en la cabecera y el año del dato entre paréntesis."
        what="los recursos naturales de los vecinos"
        opened={resources}
        places={RESOURCE_PLACES}
        columns={RESOURCE_COLUMNS}
      />
      <Block
        id="vecinos-ambiente"
        title="Medio ambiente de Bolivia y sus vecinos (cada columna en su unidad, último dato)"
        lede="Las series que distinguen un territorio de otro."
        note="Un estrés hídrico bajo y un bosque alto son, los dos, herencia de la geografía; lo que compara de verdad es cómo se mueven. Cada columna lleva su unidad en la cabecera y el año del dato entre paréntesis."
        what="el medio ambiente de los vecinos"
        opened={environment}
        places={ENVIRONMENT_PLACES}
        columns={ENVIRONMENT_COLUMNS}
      />
      <p className="guest-note">
        <Icon name="info" size={12} /> Series del Banco Mundial (Indicadores del Desarrollo
        Mundial), leídas del panel de treinta economías que recoge el núcleo del observatorio. Las
        historias completas de cada serie están en «Series de Bolivia», bajo Energía, Recursos
        naturales y Medio ambiente.
      </p>
    </section>
  );
}
