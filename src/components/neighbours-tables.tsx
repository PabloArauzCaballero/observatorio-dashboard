'use client';

import { Icon } from './icons';
import { OnOpenNotice } from './on-open';
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

/**
 * Un bloque de la sección: su cabecera, y el cuadro o el aviso de que no está.
 *
 * Un tablero sin series —el núcleo todavía no las cargó— no dibuja una tabla de
 * guiones: dice que falta, igual que lo dice el capítulo de origen.
 */
function Block<T extends LatestByPlace>({
  title,
  lead,
  what,
  opened,
  places,
  columns,
}: {
  title: string;
  lead: string;
  what: string;
  opened: OpenedBoard<T>;
  places: ReadonlyArray<{ code: string; label: string }>;
  columns: ReadonlyArray<Column>;
}) {
  const board = opened.payload?.board ?? null;
  const empty = board !== null && Object.keys(board.latest).length === 0;
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <p className="panel-sub">{lead}</p>
      </div>
      {board === null ? (
        <OnOpenNotice what={what} failed={opened.failed} />
      ) : empty ? (
        <div className="callout">
          Todavía no hay series de este capítulo leídas del panel del Banco Mundial. El cuadro se
          llena solo cuando el núcleo las tenga cargadas.
        </div>
      ) : (
        <LatestTable board={board} places={places} columns={columns} />
      )}
    </div>
  );
}

/**
 * La sección entera: un rótulo y los tres bloques, en el orden de los capítulos
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
    <section className="stack" aria-labelledby="vecinos-titulo" id="vecinos">
      <div className="strap">
        <Icon name="mapa" size={17} />
        <h2 id="vecinos-titulo">Bolivia y sus vecinos</h2>
        <span className="tile-hint">el último dato de cada país en tres capítulos</span>
      </div>
      <Block
        title="Energía"
        lead="Las series que distinguen una matriz de otra. Cada columna lleva su unidad en la cabecera y el año del dato entre paréntesis. Una importación neta negativa es un exportador de energía."
        what="la matriz energética de los vecinos"
        opened={energy}
        places={ENERGY_PLACES}
        columns={ENERGY_COLUMNS}
      />
      <Block
        title="Recursos naturales"
        lead="Las series que distinguen un caso de otro. Perú y Chile también viven de minerales; lo que cambia entre ellos y Bolivia está en las dos últimas columnas."
        what="los recursos naturales de los vecinos"
        opened={resources}
        places={RESOURCE_PLACES}
        columns={RESOURCE_COLUMNS}
      />
      <Block
        title="Medio ambiente"
        lead="Las series que distinguen un territorio de otro. Un estrés hídrico bajo y un bosque alto son, los dos, herencia de la geografía; lo que compara de verdad es cómo se mueven."
        what="el medio ambiente de los vecinos"
        opened={environment}
        places={ENVIRONMENT_PLACES}
        columns={ENVIRONMENT_COLUMNS}
      />
      <p className="panel-sub">
        <Icon name="info" size={12} /> Series del Banco Mundial (Indicadores del Desarrollo
        Mundial), leídas del panel de treinta economías que recoge el núcleo del observatorio. Las
        historias completas de cada serie están en «Series de Bolivia», bajo Energía, Recursos
        naturales y Medio ambiente.
      </p>
    </section>
  );
}
