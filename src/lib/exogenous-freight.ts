import 'server-only';
import { pool } from './db';
import type { ExogenousSeries } from './exogenous-board';
import { rollingFreight, type FreightMonth } from './freight-rolling';

/**
 * El flete que Bolivia paga en su aduana, por tonelada importada.
 *
 * La declaración de importación trae dos valores de cada partida: el FOB, lo
 * que costó la mercadería en el puerto de origen, y el CIF en frontera, ese
 * mismo valor más el flete y el seguro hasta llegar. La diferencia entre los
 * dos, dividida por el peso, es lo que el país pagó de verdad por mover cada
 * tonelada —con la ruta, la mezcla de productos y el puerto de salida que le
 * tocó—, y es la única lectura propia de Bolivia del precio del flete.
 *
 * No se calcula en el núcleo ni se siembra: la base aduanera del INE ya está
 * en `read_models.trade_flow`, grano `M_MONTHLY` (uso económico × capítulo ×
 * departamento × mes), y duplicar quince años de importaciones en otra
 * semilla para restar dos columnas sería pagar dos veces.
 *
 * Sólo cuentan las filas con FOB y peso: una fila sin FOB haría pasar todo su
 * valor por flete. Es un valor unitario y no una tarifa; el panel lo dice.
 *
 * Un cociente sobre un denominador ínfimo no es un flete, es ruido. Pando, julio de 2012,
 * declaró 20 kg y 2.537 US$ de diferencia CIF−FOB: 8.350 US$ por tonelada, 110 veces su
 * mediana, y esa sola lectura aplanaba las cinco series del gráfico. Medido sobre los 1.779
 * meses departamentales: bajo 100 t la mediana sube a 220–480 US$/t (frente a 114) y entre un
 * quinto y dos quintos pasan de 600; sobre 500 t pasa el 0,4 %.
 *
 * Por eso cada punto suma los doce meses que terminan en él (`freight-rolling.ts`): flete total
 * entre toneladas totales. Un mes de 20 kg pesa en esa suma lo que pesa su carga —casi nada— en
 * vez de dibujar un pico, así que no hace falta descartarlo; la ventana exige 100 t y nueve meses
 * con importaciones.
 */

interface Row {
  year: number;
  month: number;
  department: string | null;
  cif: string;
  fob: string;
  kg: string;
}

const DEPARTMENTS: Readonly<Record<string, string>> = {
  '1': 'Chuquisaca',
  '2': 'La Paz',
  '3': 'Cochabamba',
  '4': 'Oruro',
  '5': 'Potosí',
  '6': 'Tarija',
  '7': 'Santa Cruz',
  '8': 'Beni',
  '9': 'Pando',
};

/** Menos meses que esto no dibujan una línea que se pueda leer. */
const MINIMUM_MONTHS = 24;

const NOTE =
  'Valor CIF en frontera menos valor FOB, por tonelada de peso bruto importada (base aduanera del INE). Incluye flete y seguro hasta la frontera, no sólo el tramo marítimo, y cambia con lo que se importa: es un valor unitario, no una tarifa. Cada punto suma los doce meses que terminan en él (flete total entre toneladas totales), para que un mes con poca carga no dibuje un pico.';

const seriesOf = (
  code: string,
  name: string,
  market: string,
  points: Array<[string, number]>,
): ExogenousSeries => ({
  code,
  group: 'FREIGHT',
  product: 'FREIGHT_BO',
  productLabel: 'Flete en la aduana',
  name,
  scope: 'BOLIVIA_CUSTOMS',
  market,
  unit: 'US$/tonelada',
  kind: 'PRICE',
  frequency: 'MONTHLY',
  publisher: 'INSTITUTO NACIONAL DE ESTADÍSTICA (ADUANA)',
  note: NOTE,
  sourceUrl: 'https://www.ine.gob.bo/index.php/estadisticas-economicas/comercio-exterior/importaciones-bases-de-datos/',
  points,
});

export async function readImpliedFreight(): Promise<ExogenousSeries[]> {
  let rows: Row[];
  try {
    ({ rows } = await pool().query<Row>(
      `SELECT year, month, department,
              SUM(usd)::text AS cif, SUM(fob_usd)::text AS fob, SUM(kg)::text AS kg
       FROM read_models.trade_flow
       WHERE grain = 'M_MONTHLY' AND fob_usd > 0 AND kg > 0 AND month BETWEEN 1 AND 12
       GROUP BY GROUPING SETS ((year, month), (year, month, department))
       ORDER BY department NULLS FIRST, year, month`,
    ));
  } catch (error) {
    // La vista del aduanero se llena después del arranque y su rol puede no
    // existir todavía: un capítulo sin esta lectura, no un informe caído.
    console.warn(`[observatorio] flete implícito ilegible (${(error as { code?: string }).code ?? 'sin código'})`);
    return [];
  }

  const monthsByKey = new Map<string, FreightMonth[]>();
  for (const row of rows) {
    const cif = Number(row.cif);
    const fob = Number(row.fob);
    const kg = Number(row.kg);
    if (!(kg > 0) || cif < fob) continue;
    const key = row.department ?? 'TOTAL';
    const own = monthsByKey.get(key) ?? [];
    own.push({ year: row.year, month: row.month, freightUsd: cif - fob, kg });
    monthsByKey.set(key, own);
  }
  const byKey = new Map(
    [...monthsByKey].map(([key, months]) => [key, rollingFreight(months)] as const),
  );

  const out: ExogenousSeries[] = [];
  const total = byKey.get('TOTAL');
  if (total && total.length >= MINIMUM_MONTHS) {
    out.push(
      seriesOf('EXO_BO_FREIGHT_IMPLIED_TOTAL', 'Flete implícito, todo el país', 'Bolivia', total),
    );
  }
  for (const [code, name] of Object.entries(DEPARTMENTS)) {
    const points = byKey.get(code);
    if (!points || points.length < MINIMUM_MONTHS) continue;
    out.push(
      // El departamento al principio del rótulo: «Flete implícito de las importaciones, …» se
      // cortaba en el riel antes de llegar a él y las diez lecturas se leían iguales.
      seriesOf(`EXO_BO_FREIGHT_IMPLIED_D${code}`, `Flete implícito, ${name}`, name, points),
    );
  }
  return out;
}
