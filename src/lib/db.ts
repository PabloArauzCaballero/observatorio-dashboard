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

function createPool(): Pool {
  const connectionString = process.env.DASHBOARD_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DASHBOARD_DATABASE_URL is not set. The dashboard cannot report figures it cannot read.',
    );
  }
  return new Pool({
    connectionString,
    // TLS stays on unless the deployment says otherwise, and when on the
    // certificate is verified rather than trusted blindly. It is turned off
    // only where the database is reached over a private Docker network that
    // serves no TLS: there the handshake is refused and every read fails, so
    // demanding TLS buys nothing and costs the whole page.
    ssl:
      process.env.DASHBOARD_DATABASE_SSL === 'false'
        ? false
        : { rejectUnauthorized: true },
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
