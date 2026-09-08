import {
  readCompanyFilings,
  readGap,
  readMacroAnnual,
  readMarkets,
  readObservatory,
  readPanelCatalogue,
  readPressCube,
  readPressPage,
  readPressPulse,
  readSources,
  readTermMonths,
  readTermTotals,
} from '@/lib/series';
import { countPlaceRows } from '@/lib/places';

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
  ['pressPage', () => readPressPage({ topic: 'ECONOMICOS' }, 60)],
  ['markets', readMarkets],
  ['pressCube', readPressCube],
  ['pressPulse', readPressPulse],
  ['termMonths', readTermMonths],
  ['termTotals', readTermTotals],
  ['panelCatalogue', readPanelCatalogue],
  // Sondas, no lecturas: cuentan filas y dejan viajar el error, que es lo
  // unico que distingue un corpus sin cargar de una migracion sin correr.
  ['cityPlace', () => countPlaceRows('city_place')],
  ['cityPlaceFamily', () => countPlaceRows('city_place_family')],
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

interface Verdict {
  readonly name: string;
  readonly ok: boolean;
  readonly rows?: number | null;
  readonly code?: string;
  readonly que?: string;
}

export async function GET(): Promise<Response> {
  const lectores: Verdict[] = await Promise.all(
    READERS.map(async ([name, read]): Promise<Verdict> => {
      try {
        const value = await read();
        return { name, ok: true, rows: Array.isArray(value) ? value.length : null };
      } catch (error) {
        const code = String((error as { code?: unknown })?.code ?? '');
        return {
          name,
          ok: false,
          code: code || 'sin codigo',
          que: SQLSTATE[code] ?? 'no clasificado',
        };
      }
    }),
  );

  const fallidos = lectores.filter((verdict) => !verdict.ok);
  return Response.json(
    { total: lectores.length, fallidos: fallidos.length, lectores },
    { headers: { 'cache-control': 'no-store' } },
  );
}
