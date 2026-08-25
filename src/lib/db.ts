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

function createPool(): Pool {
  const connectionString = process.env.DASHBOARD_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DASHBOARD_DATABASE_URL is not set. The dashboard cannot report figures it cannot read.',
    );
  }
  return new Pool({
    connectionString,
    // TLS is demanded and the certificate verified rather than trusted blindly.
    // The one exception is a database on loopback, where there is no network
    // segment for anyone to sit on; every hosted target is remote and keeps
    // verification. This is decided from the host, not from a flag a
    // misconfigured deployment could set.
    ...(isLoopback(connectionString) ? {} : { ssl: { rejectUnauthorized: true } }),
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // A page that hangs is worse than a page that says it could not read.
    statement_timeout: 15_000,
  });
}

/**
 * Survives the module reloads a development server performs, which would
 * otherwise leak a pool per edit.
 */
export function pool(): Pool {
  globalThis.observatoryPool ??= createPool();
  return globalThis.observatoryPool;
}
