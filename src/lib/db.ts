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

function createPool(): Pool {
  const connectionString = process.env.DASHBOARD_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DASHBOARD_DATABASE_URL is not set. The dashboard cannot report figures it cannot read.',
    );
  }
  return new Pool({
    connectionString,
    ssl: tlsFor(connectionString),
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // A page that hangs is worse than a page that says it could not read.
    /*
     * The corpus-wide cross-tabulation reads thirty-eight thousand claims out
     * of a view that reassembles each one from its evidence. It is held in
     * memory once computed, so this ceiling is reached by the first request
     * after a restart and by nothing else.
     */
    statement_timeout: 45_000,
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
