import { pool } from '@/lib/db';

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
    'O activas «Connect To Predefined Network» en este recurso de Coolify, o ' +
    'cambias el host por 100.101.207.88:5433, que es el mismo PostgreSQL ' +
    'publicado en la tailnet y no depende de la red interna de Docker',
  'conexion-rechazada': 'nadie escucha en ese host y puerto: revisa el puerto de DASHBOARD_DATABASE_URL',
  'tiempo-agotado': 'el host no contesta: el contenedor no comparte red con la base',
  'tls-rechazado': 'la base no sirve TLS: define DASHBOARD_DATABASE_SSL=false',
  credenciales: 'usuario o contraseña incorrectos en DASHBOARD_DATABASE_URL',
  'base-inexistente':
    'esa base no existe en el servidor: el destino es economic_observatory, ' +
    'no la base postgres del mismo PostgreSQL',
  desconocido: 'fallo no clasificado; el detalle esta en el registro del contenedor',
};

export async function GET(): Promise<Response> {
  let database: Verdict = 'ok';
  try {
    // Una consulta que no toca ninguna tabla: comprueba la conexion, no el esquema.
    await pool().query('select 1');
  } catch (error) {
    database = classify(error);
  }

  return Response.json(
    {
      startedAt: STARTED_AT,
      uptimeSeconds: Math.round(process.uptime()),
      database,
      queHacer: REMEDY[database],
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
