/**
 * What the tests say, in sentences a reader can check against the table.
 *
 * Same rule as `fx-snapshot.ts`: nothing here is written by hand. Every
 * sentence is assembled from a statistic, its critical value and its sample,
 * and it changes when they do. The wording states what was rejected and at
 * which level, never what it means for policy.
 */

import type { FxEconometrics, Significance } from './fx-econometrics';
import type { FxConclusion } from './fx-snapshot';

const say = (value: number, decimals = 2): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const signed = (value: number, decimals = 2): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${say(Math.abs(value), decimals)}`;
const longDate = (value: string): string =>
  new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
const pValue = (p: number): string => (p < 0.001 ? 'p < 0,001' : `p = ${say(p, 3)}`);
const level = (rejects: Significance): string =>
  rejects ? `se rechaza al ${rejects.replace('%', ' %')}` : 'no se rechaza ni al 10 %';

function unitRoot(result: FxEconometrics): FxConclusion | null {
  const levelTest = result.unitRoot.parallelLevel;
  const returnsTest = result.unitRoot.parallelReturns;
  if (!levelTest || !returnsTest) return null;
  const randomWalk = levelTest.rejects === null;
  return {
    key: 'raiz',
    claim: randomWalk
      ? 'El paralelo se comporta como un camino aleatorio: los saltos no se deshacen'
      : 'El paralelo revierte hacia un nivel: los saltos se deshacen con el tiempo',
    figure: `t = ${say(levelTest.statistic)}`,
    detail:
      `Dickey–Fuller aumentado sobre el logaritmo del nivel, con constante y ${levelTest.lags} ` +
      `rezago${levelTest.lags === 1 ? '' : 's'} elegido${levelTest.lags === 1 ? '' : 's'} por ` +
      `Schwarz, ${say(levelTest.n, 0)} jornadas: valor crítico al 5 % de ${say(levelTest.critical.p5)}, ` +
      `así que la raíz unitaria ${level(levelTest.rejects)}. ` +
      (randomWalk
        ? 'Un salto de hoy queda incorporado al nivel de mañana en vez de corregirse. '
        : 'Una desviación de hoy tiende a corregirse en las jornadas siguientes. ') +
      `La variación diaria sí es estacionaria (t = ${say(returnsTest.statistic)}, rechazo al 1 %), ` +
      `que es lo que permite estimar sobre ella lo que sigue.`,
    tone: 'neutral',
  };
}

function gapReversion(result: FxEconometrics): FxConclusion | null {
  const moving = result.gapPersistence.moving;
  const full = result.gapPersistence.full;
  const test = result.unitRoot.gapMoving;
  if (!moving || !full || !result.moving) return null;
  const closes = moving.halfLifeDays !== null && moving.halfLifeDays < 60 && test?.rejects !== null;
  return {
    key: 'brecha-vida-media',
    claim: closes
      ? 'Desde que el oficial se mueve, la brecha se cierra sola'
      : 'Desde que el oficial se mueve, la brecha no muestra reversión clara',
    figure: moving.halfLifeDays !== null ? `${say(moving.halfLifeDays, 1)} días` : 'sin vida media',
    detail:
      `Autorregresión de primer orden de la brecha sobre ${say(moving.n, 0)} jornadas desde el ` +
      `${longDate(result.moving.from)}: cada día sobrevive el ${say(moving.rho * 100, 1)} % del desvío ` +
      `de la víspera (ρ = ${say(moving.rho, 3)} ± ${say(moving.standardError, 3)})` +
      (moving.halfLifeDays !== null
        ? `, de modo que un choque pierde la mitad de su tamaño en ${say(moving.halfLifeDays, 1)} días`
        : '') +
      (test ? `; la raíz unitaria ${level(test.rejects)} (t = ${say(test.statistic)}).` : '.') +
      ` Con el oficial fijo era otra serie: ρ = ${say(full.rho, 3)} sobre toda la historia` +
      (full.halfLifeDays !== null
        ? `, una vida media de ${say(full.halfLifeDays, 0)} días —la brecha no revertía, se acumulaba.`
        : ', sin reversión medible.'),
    tone: closes ? 'favourable' : 'neutral',
  };
}

function longRun(result: FxEconometrics): FxConclusion | null {
  const c = result.cointegration;
  if (!c || !result.moving) return null;
  const cointegrated = c.cointegrated !== null;
  const officialCorrects = c.official.lambda < 0 && c.official.pValue < 0.05;
  const parallelCorrects = c.parallel.lambda < 0 && c.parallel.pValue < 0.05;
  const who =
    officialCorrects && !parallelCorrects
      ? 'Es el oficial el que corrige hacia el paralelo, y no al revés'
      : parallelCorrects && !officialCorrects
        ? 'Es el paralelo el que corrige hacia el oficial'
        : officialCorrects && parallelCorrects
          ? 'Los dos corrigen hacia la relación común'
          : 'Ninguno de los dos corrige de forma significativa';
  const last = c.deviation.at(-1);
  return {
    key: 'cointegracion',
    claim: cointegrated
      ? 'Oficial y paralelo comparten una relación de largo plazo desde que el oficial se mueve'
      : 'Oficial y paralelo todavía no comparten una relación de largo plazo comprobable',
    figure: `β = ${say(c.beta)}`,
    detail:
      `Engle–Granger sobre ${say(c.n, 0)} jornadas desde el ${longDate(result.moving.from)}: el ` +
      `logaritmo del oficial sobre el del paralelo da una elasticidad de ${say(c.beta)} ± ` +
      `${say(c.betaStandardError)}, y la raíz unitaria del residuo ${level(c.cointegrated)} ` +
      `(t = ${say(c.residualTest.statistic)}, crítico al 5 % de ${say(c.residualTest.critical.p5)}). ` +
      `${who}: en la ecuación del oficial el desvío de la víspera pesa ${say(c.official.lambda, 3)} ` +
      `(t = ${say(c.official.tStat, 2)}, ${pValue(c.official.pValue)}` +
      (c.official.halfLifeDays !== null
        ? `, vida media de ${say(c.official.halfLifeDays, 1)} días`
        : '') +
      `) y en la del paralelo ${say(c.parallel.lambda, 3)} (${pValue(c.parallel.pValue)}).` +
      (last
        ? ` Al ${longDate(last.date)} el oficial está ${say(Math.abs(last.value), 1)} % ` +
          `${last.value < 0 ? 'por debajo' : 'por encima'} de lo que esa relación implica.`
        : ''),
    tone: cointegrated ? 'neutral' : 'adverse',
  };
}

function leadership(result: FxEconometrics): FxConclusion | null {
  const toOfficial = result.granger.parallelToOfficial;
  const toParallel = result.granger.officialToParallel;
  if (!toOfficial || !toParallel || !result.moving) return null;
  const parallelLeads = toOfficial.pValue < 0.05;
  const officialLeads = toParallel.pValue < 0.05;
  const claim =
    parallelLeads && !officialLeads
      ? 'El paralelo anticipa al oficial'
      : officialLeads && !parallelLeads
        ? 'El oficial anticipa al paralelo'
        : parallelLeads && officialLeads
          ? 'Oficial y paralelo se anticipan mutuamente'
          : 'Ninguno de los dos anticipa al otro';
  const stronger =
    toOfficial.fStat >= toParallel.fStat
      ? 'del paralelo hacia el oficial'
      : 'del oficial hacia el paralelo';
  return {
    key: 'causalidad',
    claim,
    figure: `F = ${say(toOfficial.fStat, 1)}`,
    detail:
      `Causalidad de Granger sobre las variaciones diarias, ${say(toOfficial.n, 0)} jornadas desde ` +
      `el ${longDate(result.moving.from)}. Que el pasado del paralelo ayude a predecir el oficial: ` +
      `F = ${say(toOfficial.fStat, 2)} con ${toOfficial.lags} rezago${toOfficial.lags === 1 ? '' : 's'} ` +
      `(${pValue(toOfficial.pValue)}). Al revés: F = ${say(toParallel.fStat, 2)} con ` +
      `${toParallel.lags} rezago${toParallel.lags === 1 ? '' : 's'} (${pValue(toParallel.pValue)}).` +
      (parallelLeads && officialLeads
        ? ` Hay retroalimentación en los dos sentidos y la más fuerte va ${stronger}.`
        : ''),
    tone: 'neutral',
  };
}

function breaks(result: FxEconometrics): FxConclusion | null {
  const search = result.breaks.search;
  const known = result.breaks.atRegimeChange;
  if (!search || !search.date) return null;
  const found = search.rejects !== null;
  const peak = result.breaks.gapPeak;
  const daysFromPeak = peak
    ? Math.abs(Date.parse(`${search.date}T12:00:00Z`) - Date.parse(`${peak.date}T12:00:00Z`)) /
      86_400_000
    : Infinity;
  const atPeak = daysFromPeak <= 7;
  return {
    key: 'quiebre',
    claim: found
      ? atPeak
        ? 'El quiebre de la serie está donde la brecha tocó techo, no donde el oficial se soltó'
        : 'El quiebre de la serie no está donde el oficial se soltó'
      : 'La búsqueda de quiebres no encuentra uno concluyente en la media de los retornos',
    figure: longDate(search.date),
    detail:
      `Quandt–Andrews sobre las variaciones diarias del paralelo, recorte del 15 % en cada extremo: ` +
      `el mayor F de un cambio de media es ${say(search.supF, 2)} el ${longDate(search.date)} ` +
      `(críticos de Andrews al 10 %, 5 % y 1 %: ${say(search.critical.p10, 2)}, ` +
      `${say(search.critical.p5, 2)} y ${say(search.critical.p1, 2)}, así que ${level(search.rejects)}).` +
      (peak && atPeak
        ? ` La brecha había tocado su máximo de ${signed(peak.gapPercent)} % el ${longDate(peak.date)}.`
        : '') +
      (known
        ? ` En la fecha en que el oficial empezó a moverse, el ${longDate(known.date)}, la media de ` +
          `los retornos ${known.pValue < 0.05 ? 'sí cambia' : 'no cambia'} (Chow: F = ${say(known.fStat, 2)}, ` +
          `${pValue(known.pValue)}) pero la varianza ${known.varianceP < 0.05 ? 'sí' : 'no'}: ` +
          `${say(known.varianceRatio, 2)} veces (${pValue(known.varianceP)}), una volatilidad anualizada ` +
          `de ${say(known.volBeforeAnnual, 1)} % antes y ${say(known.volAfterAnnual, 1)} % después.`
        : ''),
    tone: 'neutral',
  };
}

function volatility(result: FxEconometrics): FxConclusion | null {
  const g = result.volatility.garch;
  const arch = result.volatility.archLm;
  const squares = result.volatility.ljungBoxSquares;
  if (!g) return null;
  const clustered = (arch?.pValue ?? 1) < 0.05;
  return {
    key: 'garch',
    claim: clustered
      ? 'La volatilidad viene en rachas: un día agitado anuncia otro'
      : 'La volatilidad no muestra rachas: los días agitados llegan sueltos',
    figure: `${say(g.currentVolAnnual, 0)} % hoy`,
    detail:
      `GARCH(1,1) por máxima verosimilitud sobre ${say(g.n, 0)} variaciones diarias del paralelo: ` +
      `α = ${say(g.alpha)}, β = ${say(g.beta)}, persistencia ${say(g.persistence, 3)}` +
      (g.integrated
        ? ' —en el borde de la unidad, de modo que la muestra no fija un nivel de largo plazo al que la volatilidad vuelva'
        : g.unconditionalVolAnnual !== null && g.volHalfLifeDays !== null
          ? `, nivel de largo plazo de ${say(g.unconditionalVolAnnual, 1)} % anualizado y vida media ` +
            `de un choque de volatilidad de ${say(g.volHalfLifeDays, 1)} días`
          : '') +
      `. La volatilidad condicional de la última jornada es ${say(g.currentVolAnnual, 1)} % anualizada; ` +
      `la lectura sin modelo (RiskMetrics, λ = 0,94) da ${say(g.ewmaVolAnnual, 1)} %.` +
      (arch ? ` ARCH-LM con ${arch.lags} rezagos: ${pValue(arch.pValue)}` : '') +
      (squares
        ? `; Ljung–Box sobre los cuadrados: Q = ${say(squares.statistic, 1)} (${pValue(squares.pValue)}).`
        : '.'),
    tone: g.currentVolAnnual > 40 ? 'adverse' : 'neutral',
  };
}

function prices(result: FxEconometrics): FxConclusion | null {
  const p = result.passThrough;
  if (!p) return null;
  const horizon = p.cumulative.at(-1);
  if (!horizon) return null;
  const positive = horizon.value > 0 && horizon.value > 2 * horizon.standardError;
  return {
    key: 'traspaso',
    claim: positive
      ? 'Parte de la depreciación del paralelo llega a los precios en un trimestre'
      : 'No se mide un traspaso positivo del paralelo a los precios',
    figure: `${signed(horizon.value)} ± ${say(horizon.standardError)}`,
    detail:
      `Inflación mensual leída de la UFV sobre la depreciación mensual del paralelo y ` +
      `${p.coefficients.length - 1} rezagos, ${say(p.n, 0)} meses de ${p.from} a ${p.to}, R² = ${say(p.r2)}. ` +
      `Coeficiente acumulado a ${horizon.months} meses: ${signed(horizon.value)} puntos de inflación por ` +
      `punto de depreciación.` +
      (positive
        ? ''
        : ` El signo ${horizon.value < 0 ? 'negativo' : 'nulo'} tiene explicación en la propia serie: ` +
          `la brecha se cerró —el paralelo bajó— mientras la inflación subía, así que en este ` +
          `tramo el paralelo no fue lo que empujó los precios.`) +
      ` La muestra es corta y la UFV incorpora el IPC con un mes de rezago; el error estándar dice cuánto.`,
    tone: 'neutral',
  };
}

/** Every conclusion the battery supports, in the order the questions arrive. */
export function econometricConclusions(result: FxEconometrics): FxConclusion[] {
  return [
    unitRoot(result),
    gapReversion(result),
    longRun(result),
    leadership(result),
    breaks(result),
    volatility(result),
    prices(result),
  ].filter((entry): entry is FxConclusion => entry !== null);
}
