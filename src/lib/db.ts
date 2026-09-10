import 'server-only';
import { Pool } from 'pg';

/**
 * Read-only connection to the observatory database.
 *
 * The pool is module scoped so a warm instance reuses connections instead of
 * opening one per request, which matters on a platform that keeps a single
 * process alive between visits.
 *
 * `server-only` is imported deliberately: it turns any accidental import of
 * this module from a client component into a build error rather than a
 * connection string shipped to a browser.
 */

/**
 * La base que el nucleo migra y siembra.
 *
 * No es una preferencia: el `postgres` del mismo servidor guarda una copia
 * vieja del esquema del observatorio, con los modelos y con cifras dentro, y
 * por eso una conexion equivocada pasa por buena. La unica diferencia visible
 * es el nombre.
 */
export const EXPECTED_DATABASE = 'economic_observatory';

/**
 * La base de mantenimiento que todo PostgreSQL trae de fabrica.
 *
 * Ningun despliegue del observatorio quiere leer de ella: existe para
 * administrar el servidor. Que aparezca al final de la cadena de conexion
 * significa siempre que la cadena quedo a medio escribir.
 */
const MAINTENANCE_DATABASE = 'postgres';

/** Que se hizo con la base que venia declarada en la cadena de conexion. */
export type Correction = 'no-hizo-falta' | 'aplicada' | 'rechazada';

declare global {
  // eslint-disable-next-line no-var
  var observatoryPool: Pool | undefined;
}

/** Whether the target is this machine, and therefore unreachable from a network. */
function isLoopback(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

/**
 * TLS is demanded and the certificate verified rather than trusted blindly.
 *
 * Two targets are exempt, and both are databases no stranger can sit in front
 * of. A database on loopback has no network segment to intercept. And the
 * PostgreSQL behind the Coolify deployment runs with `ssl = off` on a private
 * Docker network: there the handshake is refused outright, so demanding TLS
 * buys nothing and costs every figure on the page. That second case has to be
 * declared — `DASHBOARD_DATABASE_SSL=false` — because the host name alone does
 * not tell a private Docker network apart from the open internet.
 */
function tlsFor(connectionString: string): false | { rejectUnauthorized: true } {
  if (isLoopback(connectionString)) return false;
  if (process.env.DASHBOARD_DATABASE_SSL === 'false') return false;
  return { rejectUnauthorized: true };
}

/**
 * Corrige el nombre de la base cuando la cadena apunta a la de mantenimiento.
 *
 * Es el fallo que costo tres dias y que sobrevivio a que el propio tablero lo
 * denunciara por escrito: `/api/version` decia «otra-base» y explicaba el
 * remedio, pero el remedio habia que aplicarlo a mano en un panel, y mientras
 * tanto la portada seguia sirviendo la copia congelada como si nada. Un
 * despliegue no deberia poder quedarse en ese estado por olvido, asi que la
 * cadena se corrige aqui: `postgres` — o un nombre ausente — no es un destino
 * plausible para el tablero, es una cadena a medio escribir.
 *
 * Solo se toca el nombre de la base. Host, usuario, contrasena y parametros se
 * respetan tal cual: si la cadena esta mal por cualquier otra razon, esto no
 * la disimula.
 */
function retarget(connectionString: string): { target: string; corrected: boolean } {
  try {
    const url = new URL(connectionString);
    const declared = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (declared !== '' && declared !== MAINTENANCE_DATABASE) {
      return { target: connectionString, corrected: false };
    }
    url.pathname = `/${EXPECTED_DATABASE}`;
    return { target: url.toString(), corrected: true };
  } catch {
    // Una cadena que ni siquiera se deja leer como URL se pasa intacta: que
    // falle donde se ve, en vez de fallar reescrita por aqui.
    return { target: connectionString, corrected: false };
  }
}

/**
 * Codigos con los que el servidor rechaza la correccion, y solo esos.
 *
 * `3D000` es que la base corregida no existe; los de la clase 28 y el 42501
 * son que existe y este usuario no entra. En los tres casos el destino
 * corregido es inalcanzable y volver al declarado sirve de algo. Cualquier
 * otro error es un problema de la consulta, no del destino, y reintentarlo
 * contra otra base solo esconderia la causa.
 */
function rejectsTheCorrection(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code ?? '');
  return code === '3D000' || code === '28P01' || code === '28000' || code === '42501';
}

function declaredConnectionString(): string {
  const connectionString = process.env.DASHBOARD_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DASHBOARD_DATABASE_URL is not set. The dashboard cannot report figures it cannot read.',
    );
  }
  return connectionString;
}

/** Un entero de entorno, o el de fabrica si no viene o no es un numero. */
function tuned(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    ssl: tlsFor(connectionString),
    /*
     * La portada pide trece lecturas a la vez y algunas abren varias consultas
     * por su cuenta. Con cuatro conexiones eso no era un pool, era una cola:
     * las que no entraban agotaban el plazo de espera y la portada entera se
     * rendia — «no fue posible leer la base de datos» — sin que ninguna
     * consulta hubiera fallado. Costo verlo que hasta ahora leia una copia
     * pequeña y congelada, donde cuatro se turnaban lo bastante rapido como
     * para que la falta de sitio no se notara.
     *
     * Diez, y no mas, porque el techo no es de este proceso. Estas conexiones
     * salen del mismo `max_connections` que usa el nucleo, que abre hasta
     * quince de escritura y treinta de lectura, y durante un despliegue viven
     * dos contenedores suyos a la vez. Un tablero que se lleva veinte deja al
     * nucleo sin sitio justo cuando esta arrancando, y una API que no alcanza
     * su base es peor que una portada que tarda un segundo mas: la primera deja
     * de recibir lo que se recolecta, la segunda solo hace esperar.
     *
     * Diez bastan porque ninguna lectura tiene ya prisa: el plazo de abajo deja
     * treinta segundos para conseguir sitio, y hacer cola no es un fallo.
     */
    max: tuned('DASHBOARD_DATABASE_POOL_MAX', 10),
    idleTimeoutMillis: 30_000,
    /*
     * Esperar sitio no es un fallo, y treinta segundos es lo que tarda la
     * primera oleada despues de un arranque en frio. Rendirse antes convierte
     * una espera en una pagina de error.
     */
    connectionTimeoutMillis: tuned('DASHBOARD_DATABASE_ACQUIRE_MS', 30_000),
    /*
     * Quince segundos, no noventa.
     *
     * Una pagina que cuelga es peor que una que dice que no pudo leer, y el
     * techo es lo unico que decide cual de las dos es. A noventa segundos, una
     * lectura cara no es una lectura lenta: es minuto y medio de PostgreSQL
     * volcando ordenaciones a disco, y el 2026-09-09 varias de esas a la vez
     * dejaron al servidor en carga 95 sobre seis nucleos y mataron los
     * despliegues durante seis horas — incluido el que trae este arreglo.
     *
     * Quince segundos son de sobra para cualquier lectura que valga la pena
     * servir. Lo que no entre ahi es justamente lo que no debe intentarse en
     * cada visita: esa seccion se declara «sin leer» y su copia guardada la
     * repara, que es para lo que existe la migracion 0072. El techo protege al
     * servidor de la pagina, no al reves.
     */
    statement_timeout: tuned('DASHBOARD_DATABASE_STATEMENT_MS', 15_000),
  });
}

/** El pool contra el que se consulta ahora mismo, que la vuelta atras cambia. */
let active: Pool | undefined;
let correction: Correction = 'no-hizo-falta';

function open(): Pool {
  if (active) return active;
  const declared = declaredConnectionString();
  const { target, corrected } = retarget(declared);
  correction = corrected ? 'aplicada' : 'no-hizo-falta';
  active = createPool(target);
  return active;
}

/**
 * Vuelve a la base declarada cuando la corregida no admite a este usuario.
 *
 * Corregir el nombre no puede costar la pagina entera: si el destino corregido
 * no existe o rechaza las credenciales, el tablero sigue leyendo lo que leia
 * antes — cifras viejas, pero cifras — y `/api/version` cuenta que la
 * correccion fue rechazada, que es lo que dice donde hay que mirar.
 */
function fallBack(): Pool {
  const abandoned = active;
  correction = 'rechazada';
  active = createPool(declaredConnectionString());
  void abandoned?.end().catch(() => undefined);
  return active;
}

/**
 * Survives the module reloads a development server performs, which would
 * otherwise leak a pool per edit.
 *
 * Lo que se devuelve es una fachada, no el pool: `query` tiene que poder
 * reintentar contra otro destino, y todo lo demas pasa al pool vigente.
 */
export function pool(): Pool {
  globalThis.observatoryPool ??= new Proxy({} as Pool, {
    get(_target, property, receiver) {
      const current = open();
      if (property === 'query') {
        return async (...args: unknown[]): Promise<unknown> => {
          type Query = (...forwarded: unknown[]) => Promise<unknown>;
          try {
            return await (current.query as unknown as Query)(...args);
          } catch (error) {
            if (correction !== 'aplicada' || !rejectsTheCorrection(error)) throw error;
            const declared = fallBack();
            return await (declared.query as unknown as Query)(...args);
          }
        };
      }
      const value = Reflect.get(current, property, receiver) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(current) : value;
    },
  });
  return globalThis.observatoryPool;
}

/**
 * Que paso con el nombre de la base, para que `/api/version` lo cuente.
 *
 * No propaga: se pregunta tambien cuando la lectura acaba de fallar, y un
 * informe de fallo que falla al informar no deja nada que leer.
 */
export function correctionApplied(): Correction {
  try {
    open();
  } catch {
    // Sin cadena de conexion no hubo nada que corregir.
  }
  return correction;
}
