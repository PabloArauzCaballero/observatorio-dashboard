import { correctionApplied, EXPECTED_DATABASE, pool, type Correction } from '@/lib/db';

/**
 * When this process started, and whether it can reach the database.
 *
 * The start time exists so a deployment can tell that it happened: a deploy
 * that changes no page renders byte-identical output, and asking Coolify how
 * its deployment went needs an API token with read permission that the deploy
 * credential does not carry. A start time later than the moment the deploy was
 * requested can only belong to the container that deploy created.
 *
 * The database verdict exists because the report deliberately says nothing when
 * a read fails — a connection error can name the host, the user and the port,
 * and that does not belong on a public page. But «no pude leer» is also not
 * enough to fix anything, and the server log lives on a machine behind a
 * tailnet. So this reports the KIND of failure and never its text: enough to
 * tell a hostname that does not resolve from a password that is wrong, and not
 * enough to hand anyone a target.
 */

export const dynamic = 'force-dynamic';

/** Fixed when the module is first evaluated, which is process start. */
const STARTED_AT = new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString();

/** What went wrong, in the coarsest terms that still point at a fix. */
type Verdict =
  | 'ok'
  | 'host-no-resuelve'
  | 'conexion-rechazada'
  | 'tiempo-agotado'
  | 'tls-rechazado'
  | 'credenciales'
  | 'base-inexistente'
  | 'otra-base'
  | 'desconocido';

/**
 * Read from the error's code, not its message: the codes are a closed set that
 * says what to change, while the message is prose that may carry the host.
 */
function classify(error: unknown): Verdict {
  const code = String((error as { code?: unknown })?.code ?? '');
  const text = error instanceof Error ? error.message : '';

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'host-no-resuelve';
  if (code === 'ECONNREFUSED') return 'conexion-rechazada';
  if (code === 'ETIMEDOUT' || /timeout/i.test(text)) return 'tiempo-agotado';
  // 28P01 contraseña incorrecta, 28000 regla de autenticación; 3D000 base ausente.
  if (code === '28P01' || code === '28000') return 'credenciales';
  if (code === '3D000') return 'base-inexistente';
  if (/SSL|TLS|certificate/i.test(text)) return 'tls-rechazado';
  return 'desconocido';
}

/** Lo que hay que revisar en Coolify segun el veredicto. */
const REMEDY: Record<Verdict, string> = {
  ok: 'la base responde',
  'host-no-resuelve':
    'el hostname de DASHBOARD_DATABASE_URL no resuelve desde el contenedor. ' +
    'Activa «Connect To Predefined Network» en este recurso de Coolify, que es ' +
    'lo que pone al tablero en la misma red que la base del nucleo. NO apuntes ' +
    'el host a un puerto publicado del servidor sin comprobar antes que ese ' +
    'puerto es la base del observatorio: el 5433 de este servidor pertenece a ' +
    'otro proyecto, y un tablero que lo lea sirve cifras que nadie actualiza',
  'otra-base':
    'la conexion funciona pero no es la base que el nucleo migra y siembra. ' +
    'Mira «correccion»: si dice «rechazada», la cadena nombraba la base de ' +
    'mantenimiento, el tablero apunto solo a economic_observatory y ese ' +
    'servidor la nego — o no existe ahi, o este usuario no entra, asi que la ' +
    'cadena apunta al PostgreSQL equivocado y hay que cambiarle el host en ' +
    'Coolify, no el nombre. Si dice «no-hizo-falta», DASHBOARD_DATABASE_URL ' +
    'nombra una tercera base y hay que cambiarle el nombre en Coolify',
  'conexion-rechazada':
    'nadie escucha en ese host y puerto: revisa el puerto de DASHBOARD_DATABASE_URL',
  'tiempo-agotado': 'el host no contesta: el contenedor no comparte red con la base',
  'tls-rechazado': 'la base no sirve TLS: define DASHBOARD_DATABASE_SSL=false',
  credenciales: 'usuario o contraseña incorrectos en DASHBOARD_DATABASE_URL',
  'base-inexistente':
    'esa base no existe en el servidor: el destino es economic_observatory, ' +
    'no la base postgres del mismo PostgreSQL',
  desconocido: 'fallo no clasificado; el detalle esta en el registro del contenedor',
};

/**
 * Which database answered, and whether it is the right one.
 *
 * «Responde» y «es la base del observatorio» son dos preguntas distintas, y
 * confundirlas costo tres dias: el tablero apuntaba a un PostgreSQL que
 * contestaba, tenia cifras coherentes y no era donde el nucleo escribe, asi que
 * servia una copia congelada mientras cada despliegue migraba y sembraba en
 * otra parte, en verde. Desde fuera las dos situaciones se ven identicas.
 *
 * `to_regclass` devuelve null en vez de lanzar cuando la relacion no existe, de
 * modo que esto distingue una base equivocada de una migracion pendiente sin
 * necesidad de un error. El nombre de la base viaja porque es lo que se compara
 * con lo que dice Coolify; el host y el usuario no, que es lo que no debe salir
 * de una direccion publica.
 */
/**
 * La base que el nucleo migra y siembra, declarada donde se abre la conexion.
 *
 * Vive en `@/lib/db` porque alli es donde se usa para algo mas que informar:
 * una cadena que apunta a la base de mantenimiento se corrige antes de abrir
 * el pool. Aqui solo se compara con lo que el servidor acabo contestando.
 */
const EXPECTED = EXPECTED_DATABASE;

interface Identity {
  base: string | null;
  /** El modelo que existe desde el principio: si falta, no es esta base. */
  nucleo: boolean;
  /** Los de ciudades, que llegan con la migracion 0070. */
  ciudades: boolean;
  /**
   * La ultima migracion aplicada EN ESTA base.
   *
   * Es el reloj que delata una copia: el nucleo anota aqui cada migracion que
   * corre, asi que una base que se quedo atras lo dice con su propio numero sin
   * que haya que comparar cifras a ojo.
   */
  migracion: string | null;
}

async function identify(): Promise<Identity> {
  const { rows } = await pool().query<{
    base: string;
    nucleo: string | null;
    ciudades: string | null;
    migracion: string | null;
  }>(
    `SELECT current_database() AS base,
            to_regclass('read_models.economic_indicator_daily')::text AS nucleo,
            to_regclass('read_models.city_place')::text AS ciudades,
            (SELECT max(name) FROM infrastructure.migration_history) AS migracion`,
  );
  const row = rows[0];
  return {
    base: row?.base ?? null,
    nucleo: Boolean(row?.nucleo),
    ciudades: Boolean(row?.ciudades),
    migracion: row?.migracion ?? null,
  };
}

export async function GET(): Promise<Response> {
  let database: Verdict = 'ok';
  let correccion: Correction = 'no-hizo-falta';
  let identity: Identity = { base: null, nucleo: false, ciudades: false, migracion: null };
  try {
    identity = await identify();
    correccion = correctionApplied();
    /*
     * Dos formas de estar en el sitio equivocado, y la segunda es la que
     * engana. Una base sin el modelo mas viejo del observatorio no es un
     * esquema a medias: es otra base. Y una base que SI lo tiene puede seguir
     * siendo la equivocada, porque el `postgres` de este mismo servidor guarda
     * una copia vieja del esquema completo — con cifras coherentes, que es lo
     * que la hizo pasar por buena durante tres dias.
     */
    if (!identity.nucleo || identity.base !== EXPECTED) database = 'otra-base';
  } catch (error) {
    database = classify(error);
    correccion = correctionApplied();
  }

  return Response.json(
    {
      startedAt: STARTED_AT,
      uptimeSeconds: Math.round(process.uptime()),
      database,
      base: identity.base,
      baseEsperada: EXPECTED,
      correccion,
      ultimaMigracion: identity.migracion,
      modelos: { nucleo: identity.nucleo, ciudades: identity.ciudades },
      queHacer: REMEDY[database],
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
