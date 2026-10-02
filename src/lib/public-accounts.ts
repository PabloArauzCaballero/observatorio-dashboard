import 'server-only';
import { pool } from './db';
import { held } from './hold';
import type { AccountsPayload, AccountSeries, Unit } from './public-accounts-board';
import { readWorldBoard } from './series';

/**
 * Las cuentas públicas, leídas de `read_models.public_account_series`.
 *
 * Una fila por serie con sus puntos dentro: son cientos de series y pocos miles de puntos,
 * así que se leen todas de una vez y el navegador arma cada gráfico. Lo que viaja no es el
 * panel anual de indicadores —estas series no están ahí a propósito— sino su propia vista,
 * que el sembrador `public-accounts` del núcleo llena desde los cuadernos del Ministerio de
 * Economía, el cuadro 13.05 del Banco Central, las estadísticas tributarias de la OCDE y
 * las subvenciones a combustibles del FMI.
 *
 * El PIB en bolivianos corrientes sale del panel del Banco Mundial que el tablero ya lee, y
 * es el denominador de todo «% del PIB» que se calcula aquí. Las series de la OCDE ya vienen
 * en % del PIB con el PIB de la OCDE; las del Ministerio vienen en millones de bolivianos.
 */

interface Row {
  indicator_code: string;
  name: string;
  family: string;
  topic: string;
  place: string;
  concept: string;
  perimeter: string;
  unit: string;
  frequency: string;
  publisher: string;
  points: Array<[string, string]>;
  source_url: string | null;
}

const MISSING_MODEL = new Set(['42P01', '42501', '42703']);
const GDP_CODE = 'NY.GDP.MKTP.CN';

export function readPublicAccounts(): Promise<AccountsPayload> {
  return held('publicAccounts', buildPublicAccounts);
}

async function buildPublicAccounts(): Promise<AccountsPayload> {
  let rows: Row[] = [];
  try {
    ({ rows } = await pool().query<Row>(
      `SELECT indicator_code, name, family, topic, place, concept, perimeter, unit, frequency,
              publisher, points, source_url
       FROM read_models.public_account_series
       ORDER BY family, indicator_code`,
    ));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (!code || !MISSING_MODEL.has(code)) throw error;
    // La vista no existe todavía en esta base: se dice y el capítulo avisa que no hay datos.
    console.warn(`[observatorio] modelo ilegible: read_models.public_account_series (${code})`);
  }

  const series: AccountSeries[] = rows.map((row) => ({
    code: row.indicator_code,
    name: row.name,
    family: row.family,
    topic: row.topic,
    place: row.place,
    concept: row.concept,
    perimeter: row.perimeter,
    unit: row.unit as Unit,
    frequency: row.frequency === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL',
    publisher: row.publisher,
    sourceUrl: row.source_url,
    points: row.points.map(([date, value]) => [date, Number(value)] as [string, number]),
  }));

  const gdp = (await readWorldBoard([GDP_CODE], ['BOL']))
    .filter((point) => point.indicatorCode === GDP_CODE)
    .map((point) => ({ year: point.year, value: point.value / 1_000_000 }));

  return { series, gdp };
}
