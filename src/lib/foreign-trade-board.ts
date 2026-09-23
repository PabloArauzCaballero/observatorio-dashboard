import { nationalProductMix } from './departments-board';
import type { DepartmentBoard } from './departments-board';
import type { FxConclusion } from './fx-snapshot';
import type { MacroPoint } from './series';

/**
 * El comercio exterior agregado que Bolivia declara ante Naciones Unidas.
 *
 * Comtrade publica lo que cada país reporta a su aduana, un número por año.
 * Hoy sólo hay dos series sembradas —el total exportado y el total
 * importado, sin producto ni socio— porque son las dos que entraron en la
 * migración de esta mañana (2026-09-23); el desglose por producto y por
 * socio desde 2020 lo está sembrando otro agente en el núcleo, en paralelo a
 * este capítulo, en la rama `mt/comercio-exterior-detalle`. El exportado
 * coincide al centavo con el «total declarado» que publica el INE por
 * departamento —comprobado contra la gestión 2024: 9.059.167.409,43 dólares
 * de un lado y del otro—, que es la prueba de que es la misma declaración
 * aduanera vista desde dos publicadores distintos.
 *
 * `detail` recoge cualquier otro código que empiece por `COMTRADE_` y no sea
 * uno de los dos agregados, para que el capítulo no se rompa el día que el
 * núcleo siembre el desglose: hoy esa lista sale vacía y el panel que la lee
 * dice que está esperando la carga en vez de dibujar nada.
 */

export interface ComtradeYear {
  year: number;
  value: number;
}

/** Una serie COMTRADE_ que no es ninguno de los dos agregados conocidos. */
export interface ComtradeDetail {
  code: string;
  name: string | null;
  points: ComtradeYear[];
}

export interface ForeignTradeBoard {
  exportsUsd: ComtradeYear[];
  importsUsd: ComtradeYear[];
  detail: ComtradeDetail[];
  latestYear: number | null;
}

const EXPORTS_CODE = 'COMTRADE_GOODS_EXPORTS_USD';
const IMPORTS_CODE = 'COMTRADE_GOODS_IMPORTS_USD';
const PREFIX = 'COMTRADE_';

const byYear = (values: ComtradeYear[]): ComtradeYear[] =>
  [...values].sort((left, right) => left.year - right.year);

/** Arma el capítulo con las filas cuyo código empieza por `COMTRADE_`. */
export function buildForeignTradeBoard(points: readonly MacroPoint[]): ForeignTradeBoard {
  const exportsUsd: ComtradeYear[] = [];
  const importsUsd: ComtradeYear[] = [];
  const detailByCode = new Map<string, ComtradeDetail>();

  for (const point of points) {
    if (!point.indicatorCode.startsWith(PREFIX)) continue;
    if (!Number.isFinite(point.value)) continue;
    const year = Number(point.period);
    if (!Number.isInteger(year)) continue;

    if (point.indicatorCode === EXPORTS_CODE) {
      exportsUsd.push({ year, value: point.value });
      continue;
    }
    if (point.indicatorCode === IMPORTS_CODE) {
      importsUsd.push({ year, value: point.value });
      continue;
    }

    const entry = detailByCode.get(point.indicatorCode) ?? {
      code: point.indicatorCode,
      name: point.name,
      points: [] as ComtradeYear[],
    };
    entry.points.push({ year, value: point.value });
    detailByCode.set(point.indicatorCode, entry);
  }

  const detail = [...detailByCode.values()]
    .map((entry) => ({ ...entry, points: byYear(entry.points) }))
    .sort((left, right) => left.code.localeCompare(right.code));

  const latestYear = Math.max(
    0,
    ...exportsUsd.map((point) => point.year),
    ...importsUsd.map((point) => point.year),
  );

  return {
    exportsUsd: byYear(exportsUsd),
    importsUsd: byYear(importsUsd),
    detail,
    latestYear: latestYear > 0 ? latestYear : null,
  };
}

const say = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const percent = (value: number, decimals = 1): string => `${say(value, decimals)} %`;

/**
 * Lo que el capítulo concluye solo, cruzando el producto nacional (INE, por
 * departamento) con el agregado de Comtrade (ONU). Ninguna está redactada a
 * mano; las cuatro cambian con la carga, y dos de ellas se apagan solas
 * mientras Comtrade sólo tenga el agregado: la balanza y el crecimiento
 * necesitan `tradeBoard`, el producto líder y la concentración no.
 */
export function foreignTradeConclusions(
  departmentBoard: DepartmentBoard,
  tradeBoard: ForeignTradeBoard | null,
): FxConclusion[] {
  const out: FxConclusion[] = [];
  const year = departmentBoard.tradeYear;
  const mix = nationalProductMix(departmentBoard, year, 'usd');
  const total = mix.reduce((sum, row) => sum + row.value, 0);

  const leader = mix[0];
  if (leader && total > 0) {
    out.push({
      key: 'producto',
      claim: `${leader.name} es lo que más exportó Bolivia en ${year}`,
      figure: percent((leader.value / total) * 100),
      detail: `Del total nacional por producto que resulta de sumar los nueve departamentos en ${year}, ${say(leader.value, 0)} de ${say(total, 0)} millones de dólares fueron ${leader.name.toLocaleLowerCase('es')}.`,
      tone: 'neutral',
    });
  }

  const top3 = mix.slice(0, 3).reduce((sum, row) => sum + row.value, 0);
  if (top3 > 0 && total > 0 && mix.length > 2) {
    out.push({
      key: 'concentracion',
      claim: 'Tres productos concentran buena parte de lo que Bolivia vende afuera',
      figure: percent((top3 / total) * 100),
      detail: `Suma de ${mix
        .slice(0, 3)
        .map((row) => row.name.toLocaleLowerCase('es'))
        .join(', ')} sobre el total nacional por producto en ${year}.`,
      tone: 'neutral',
    });
  }

  if (tradeBoard?.exportsUsd.length && tradeBoard.importsUsd.length) {
    const lastExport = tradeBoard.exportsUsd.at(-1);
    const matchedImport = lastExport
      ? tradeBoard.importsUsd.find((point) => point.year === lastExport.year)
      : undefined;
    if (lastExport && matchedImport) {
      const balance = lastExport.value - matchedImport.value;
      out.push({
        key: 'balanza',
        claim:
          balance >= 0
            ? `Bolivia vendió más de lo que compró afuera en ${lastExport.year}`
            : `Bolivia compró más de lo que vendió afuera en ${lastExport.year}`,
        figure: `${balance >= 0 ? '+' : ''}${say(balance / 1_000_000, 0)} millones de USD`,
        detail: `Exportaciones de bienes por ${say(lastExport.value / 1_000_000, 0)} millones contra importaciones por ${say(matchedImport.value / 1_000_000, 0)} millones, declaradas ante Naciones Unidas.`,
        tone: balance >= 0 ? 'favourable' : 'adverse',
      });

      const firstExport = tradeBoard.exportsUsd[0];
      const firstImport = firstExport
        ? tradeBoard.importsUsd.find((point) => point.year === firstExport.year)
        : undefined;
      if (
        firstExport &&
        firstImport &&
        firstExport.value > 0 &&
        firstImport.value > 0 &&
        firstExport.year !== lastExport.year
      ) {
        const exportGrowth = ((lastExport.value - firstExport.value) / firstExport.value) * 100;
        const importGrowth = ((matchedImport.value - firstImport.value) / firstImport.value) * 100;
        out.push({
          key: 'crecimiento',
          claim:
            exportGrowth >= importGrowth
              ? 'Las exportaciones crecieron más que las importaciones desde que Comtrade registra a Bolivia'
              : 'Las importaciones crecieron más que las exportaciones desde que Comtrade registra a Bolivia',
          figure: `${percent(exportGrowth, 0)} frente a ${percent(importGrowth, 0)}`,
          detail: `Variación del total de bienes declarado ante Naciones Unidas entre ${firstExport.year} y ${lastExport.year}, exportado contra importado.`,
          tone: exportGrowth >= importGrowth ? 'favourable' : 'adverse',
        });
      }
    }
  }

  const declaredTotal = departmentBoard.series['EXPORTS_USD']?.['TOTAL'] ?? [];
  if (tradeBoard?.exportsUsd.length && declaredTotal.length) {
    const shared = [...tradeBoard.exportsUsd]
      .reverse()
      .map((point) => ({ un: point, ine: declaredTotal.find((row) => row.year === point.year) }))
      .find((row) => row.ine);
    if (shared?.ine) {
      const unMillions = shared.un.value / 1_000_000;
      const diffPct =
        shared.ine.value > 0 ? (Math.abs(unMillions - shared.ine.value) / shared.ine.value) * 100 : 0;
      out.push({
        key: 'coincide',
        claim: 'El total que Bolivia declara ante la ONU coincide con el que declara al INE',
        figure: `${say(diffPct, 2)} % de diferencia`,
        detail: `En ${shared.un.year}, ${say(shared.ine.value, 0)} millones de dólares en el «total declarado» del INE por departamento contra ${say(unMillions, 0)} millones en Comtrade: la misma declaración aduanera, vista por dos publicadores.`,
        tone: 'neutral',
      });
    }
  }

  return out;
}
