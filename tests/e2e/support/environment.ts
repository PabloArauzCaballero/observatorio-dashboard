import { Client } from 'pg';

/**
 * The addresses and credentials the suite runs against.
 *
 * All of them come from the environment, and every one of them is required:
 * a suite that silently falls back to a default would eventually run against
 * something nobody meant it to, and this one writes to the database it reads.
 */
export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} es obligatoria para la suite de extremo a extremo`);
  return value;
}

export const OPERATOR = {
  subject: process.env.E2E_OPERATOR_SUBJECT ?? 'operador',
  password: () => required('E2E_OPERATOR_PASSWORD'),
};

export const READER = {
  subject: process.env.E2E_READER_SUBJECT ?? 'lectora',
  password: () => required('E2E_READER_PASSWORD'),
};

/**
 * Opens the database the suite asserts against.
 *
 * Reading the effect in the database is what separates «the screen said it
 * worked» from «it worked». The connection is taken from its own variable, so
 * the suite cannot reach a database that was not handed to it on purpose.
 */
export async function withDatabase<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: required('E2E_DATABASE_URL') });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** One row, or null, for the assertions that are about existence. */
export async function queryOne<T extends Record<string, unknown>>(
  sql: string,
  values: readonly unknown[] = [],
): Promise<T | null> {
  return withDatabase(async (client) => {
    const { rows } = await client.query<T>(sql, [...values]);
    return rows[0] ?? null;
  });
}

export async function queryAll<T extends Record<string, unknown>>(
  sql: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  return withDatabase(async (client) => {
    const { rows } = await client.query<T>(sql, [...values]);
    return rows;
  });
}
