import {
  readCompanyFilings,
  readGap,
  readMacroAnnual,
  readMarkets,
  readObservatory,
  readPressCube,
  readPressPage,
  readPressPulse,
  readSources,
  readTermMonths,
  readTermTotals,
} from '@/lib/series';
import { countPlaceRows } from '@/lib/places';
import { pool } from '@/lib/db';

/**
 * Which of the report's reads work, one at a time.
 *
 * The page fetches its reads together and shows nothing if any one of them
 * throws. That is right for a reader — a figure that could not be verified is
 * not shown — and useless for whoever has to repair it: the whole diagnosis is
 * one line in a container log, on a machine behind a tailnet, naming one
 * failure among many. This runs them apart and says which ones fell.
 *
 * The two retired social readers are not on the list. ADR 0025 and migration
 * 0069 narrowed the register to commerce and dropped the audience model, so
 * they fail by design and nothing on the report calls them; counting them as
 * failures would leave this route permanently crying wolf about a decision
 * somebody already made.
 *
 * It reports PostgreSQL's error code and never its message. The codes are a
 * closed set that names the fault — a column that is not there, a relation that
 * is not there — while the message is prose that can carry the host, the user
 * and the query text. This route answers on a public address.
 */

export const dynamic = 'force-dynamic';

const READERS: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
  ['observatory', readObservatory],
  ['gap', readGap],
  ['sources', readSources],
  ['macroAnnual', readMacroAnnual],
  ['companyFilings', readCompanyFilings],
  ['pressPage', () => readPressPage({ topic: ['ECONOMICOS'] }, 60)],
  ['markets', readMarkets],
  ['pressCube', readPressCube],
  ['pressPulse', readPressPulse],
  ['termMonths', readTermMonths],
  ['termTotals', readTermTotals],
  // Sondas, no lecturas: cuentan filas y dejan viajar el error, que es lo
  // unico que distingue un corpus sin cargar de una migracion sin correr.
  ['cityPlace', () => countPlaceRows('city_place')],
  ['cityPlaceFamily', () => countPlaceRows('city_place_family')],
  /*
   * El corpus nacional, que la migracion 0073 abrio y la 0074 amplio. Estaba
   * en el esquema y en ningun lector: nadie podia comprobar desde fuera si una
   * carga habia entrado, que es justo lo que este endpoint existe para decir.
   */
  ['nationalPlace', () => countPlaceRows('national_place')],
  ['nationalPlaceFamily', () => countPlaceRows('national_place_family')],
];

/** El nombre que PostgreSQL da a cada codigo, para no tener que buscarlo. */
const SQLSTATE: Record<string, string> = {
  '42703': 'columna inexistente',
  '42P01': 'relacion inexistente',
  '42883': 'funcion inexistente',
  '42601': 'error de sintaxis',
  '42P02': 'parametro inexistente',
  '22P02': 'texto no valido para el tipo',
  '22003': 'valor fuera de rango',
  '22012': 'division por cero',
  '57014': 'cancelada por statement_timeout',
  '3D000': 'base inexistente',
  '28P01': 'credenciales',
};

/**
 * Which database answered, and how far its migration history goes.
 *
 * A reader that fails with 42P01 says a relation is not there; it cannot say
 * whether the migration that creates it never ran or ran somewhere else. This
 * server hosts more than one database — the deployment notes say `postgres`
 * keeps an older copy of everything `economic_observatory` holds — so «the
 * migration is green and the model is missing» has two explanations and they
 * need opposite repairs.
 *
 * The name alone is not enough to say which one answered. This machine runs
 * eight PostgreSQL containers, several of them stock images whose default
 * database is also called `postgres`, so `current_database()` returns the same
 * word from servers belonging to different projects. What separates them is the
 * address the server itself answers on, which is why `inet_server_addr()` is
 * asked for beside the name: it is the server's own view of where it is, not a
 * copy of what this process dialled.
 *
 * With the last migration applied, those three facts say which database is
 * being read and how far its schema goes. None is a credential — they are the
 * identifiers the deployment file and the migrations directory already carry —
 * and the rule this route keeps holds untouched: codes, never messages, because
 * a message is what can carry the user and the password.
 */
interface DatabaseNote {
  readonly nombre: string | null;
  /** La direccion en que el propio servidor dice estar, no la que se marco. */
  readonly servidor?: string | null;
  readonly version?: string | null;
  readonly migraciones?: number;
  readonly ultimaMigracion?: string | null;
  readonly code?: string;
  readonly que?: string;
}

async function describeDatabase(): Promise<DatabaseNote> {
  let nombre: string | null = null;
  let servidor: string | null = null;
  let version: string | null = null;
  try {
    const { rows } = await pool().query<{
      base: string;
      servidor: string | null;
      version: string | null;
    }>(
      `SELECT current_database()            AS base,
              host(inet_server_addr())      AS servidor,
              current_setting('server_version') AS version`,
    );
    nombre = rows[0]?.base ?? null;
    // Nulo cuando se entra por socket local, que es en si mismo la respuesta:
    // el servidor corre en este contenedor y no en otro del servidor.
    servidor = rows[0]?.servidor ?? null;
    version = rows[0]?.version ?? null;
  } catch (error) {
    const code = String((error as { code?: unknown })?.code ?? '');
    return { nombre: null, code: code || 'sin codigo', que: SQLSTATE[code] ?? 'no clasificado' };
  }

  try {
    const { rows } = await pool().query<{ total: string; ultima: string | null }>(
      `SELECT count(*)::text AS total, max(name) AS ultima
         FROM infrastructure.migration_history`,
    );
    return {
      nombre,
      servidor,
      version,
      migraciones: Number(rows[0]?.total ?? 0),
      ultimaMigracion: rows[0]?.ultima ?? null,
    };
  } catch (error) {
    // Una base sin historia de migraciones es justamente el hallazgo, no un
    // fallo del diagnostico: se reporta con su codigo y el nombre se conserva.
    const code = String((error as { code?: unknown })?.code ?? '');
    return {
      nombre,
      servidor,
      version,
      code: code || 'sin codigo',
      que: SQLSTATE[code] ?? 'no clasificado',
    };
  }
}

/**
 * Which stored copies exist and whether anybody has filled them.
 *
 * Migration 0072 creates them empty on purpose, so a deploy is never held
 * behind minutes of sorting. That makes «built» a real question with three
 * answers — the model is not there, it is there and empty, it is there and
 * filled — and only the last one means the report is being served the cheap
 * path. Reading it from `pg_class.relispopulated` is the server's own answer;
 * counting rows cannot tell an unfilled copy from an empty corpus.
 */
async function describeSnapshots(): Promise<
  { estado: 'sin-modelo' | 'leido'; copias?: Array<{ nombre: string; construida: boolean }> }
> {
  try {
    const { rows } = await pool().query<{ snapshot: string; built: boolean }>(
      `SELECT snapshot, built FROM read_models.snapshot_state ORDER BY snapshot`,
    );
    return {
      estado: 'leido',
      copias: rows.map((row) => ({ nombre: row.snapshot, construida: row.built })),
    };
  } catch {
    // La vista llega con la 0072; antes de esa migracion no hay nada que decir.
    return { estado: 'sin-modelo' };
  }
}

interface Verdict {
  readonly name: string;
  readonly ok: boolean;
  readonly rows?: number | null;
  /**
   * Cuanto tardo, que es la pregunta que este endpoint no sabia contestar.
   *
   * El 2026-09-22 hubo que averiguar cual de las lecturas de la portada se
   * comia dieciseis segundos en Contabo, y no habia forma de preguntarlo: el
   * unico cronometro disponible era `/api/export?dataset=X`, que mide la
   * lectura mas el armado de un fichero de descarga con un techo de filas
   * distinto, asi que sus numeros no son los de la portada. Se acabo
   * deduciendolo. Un diagnostico que dice «ok» sin decir «en cuanto» deja
   * fuera la mitad de los fallos que se ven de verdad.
   *
   * Cuidado al leerlo: con la lectura sostenida en memoria esto sale en
   * milisegundos, y eso NO quiere decir que la consulta sea rapida — quiere
   * decir que ya estaba hecha. Para medir en frio hay que dejar pasar los cinco
   * minutos del plazo sin tocar el tablero.
   */
  readonly ms?: number;
  readonly code?: string;
  readonly que?: string;
}

/** Una lectura, cronometrada, sin dejar que su fallo se lleve las demas. */
async function time(name: string, read: () => Promise<unknown>): Promise<Verdict> {
  const started = Date.now();
  try {
    const value = await read();
    /*
     * Un lector que cuenta devuelve el numero; uno que trae filas devuelve
     * el array. Antes solo se miraba el array, asi que los que contaban
     * —los de lugares— salian con `rows: null` y no se podia distinguir
     * «leible y vacio» de «leible y lleno».
     */
    const rows = typeof value === 'number' ? value : Array.isArray(value) ? value.length : null;
    return { name, ok: true, rows, ms: Date.now() - started };
  } catch (error) {
    const code = String((error as { code?: unknown })?.code ?? '');
    return {
      name,
      ok: false,
      ms: Date.now() - started,
      code: code || 'sin codigo',
      que: SQLSTATE[code] ?? 'no clasificado',
    };
  }
}

export async function GET(request: Request): Promise<Response> {
  /*
   * `?serie=1` las corre de una en una.
   *
   * A la vez es como las pide la portada, y es el numero que hay que mirar para
   * saber cuanto espera un lector. Pero entonces cada tiempo lleva dentro la
   * espera por las otras catorce —diez conexiones de pool en seis nucleos
   * compartidos— y ninguno dice lo que cuesta su consulta. En serie tarda la
   * suma, y a cambio cada cifra es la de su propia lectura, que es lo que hace
   * falta para saber cual arreglar.
   */
  const serie = new URL(request.url).searchParams.get('serie') === '1';

  const base = await describeDatabase();
  const copias = await describeSnapshots();

  const started = Date.now();
  let lectores: Verdict[];
  if (serie) {
    lectores = [];
    for (const [name, read] of READERS) lectores.push(await time(name, read));
  } else {
    lectores = await Promise.all(READERS.map(([name, read]) => time(name, read)));
  }
  const ms = Date.now() - started;

  const fallidos = lectores.filter((verdict) => !verdict.ok);
  return Response.json(
    {
      base,
      copias,
      total: lectores.length,
      fallidos: fallidos.length,
      /** En paralelo, lo que espera un lector; en serie, la suma de las quince. */
      ms,
      como: serie ? 'en serie' : 'a la vez',
      lectores: [...lectores].sort((left, right) => (right.ms ?? 0) - (left.ms ?? 0)),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
