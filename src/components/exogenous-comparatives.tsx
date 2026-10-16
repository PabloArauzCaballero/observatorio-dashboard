'use client';

import { useId, useMemo, useState } from 'react';
import { DatedLines, seriesTone } from './charts';
import type { DatedLinePoint, DatedLineSeries } from './charts';
import { sourcesOf } from './exogenous-table';
import { OnOpenNotice, useOnOpen } from './on-open';
import { Panel } from '@/components/ui/panel';
import { celda } from '@/components/ui/panel-data';
import { ViewToggle } from '@/components/ui/view-toggle';
import { downloadCsv } from '@/lib/csv';
import { asFamilyData } from '@/lib/exogenous-board-adapter';
import { GROUPS, PRODUCT_ORDER, sayPeriod, yearOf } from '@/lib/exogenous-board';
import type { ExogenousBoard, ExogenousSeries } from '@/lib/exogenous-board';
import {
  compareFactorSeries,
  FactorComparisonError,
  type FactorComparisonMode,
} from '@/lib/exogenous-factor-comparison';
import { THEMES, availablePairs, readPair, sayTogether } from '@/lib/exogenous-pairs';
import type { ExogenousPair } from '@/lib/exogenous-pairs';

/**
 * «Comparativos»: dos lecturas frente a frente, en su propia pestaña.
 *
 * Vivía al pie de «Precios por producto», con dos listas de todas las lecturas y sin ninguna
 * guía: el lector filtraba viguetas en la izquierda y la comparación seguía mostrando arroz contra
 * crudo, que no responde nada. Aquí arriba van las comparaciones que sí preguntan algo sobre
 * Bolivia (`exogenous-pairs.ts`) y debajo el gráfico, con sus propios años y sus cifras: cuánto
 * cambió cada una y si se mueven juntas. La elección libre sigue, para quien tenga otra pregunta.
 */
export function ExogenousComparatives() {
  const { payload, failed } = useOnOpen<{ board: ExogenousBoard }>('/api/exogenas');
  if (!payload) return <OnOpenNotice what="las series para comparar" failed={failed} />;
  if (!payload.board.series.length) {
    return <div className="callout">Aún no hay series de precios para comparar.</div>;
  }
  return <Comparatives board={payload.board} />;
}

const FREQUENCY: Record<string, string> = { MONTHLY: 'mensual', ANNUAL: 'anual' };

const figure = (value: number, decimals = 1): string =>
  new Intl.NumberFormat('es-BO', { maximumFractionDigits: decimals }).format(value);

const signed = (value: number | null): string =>
  value === null ? 'sin dato' : `${value > 0 ? '+' : ''}${figure(value, 0)} %`;

/** De la correlación a los cuatro puntos del medidor: 0 sin dato, 4 relación fuerte. */
const strengthOf = (r: number | null): number =>
  r === null ? 0 : r >= 0.7 ? 4 : r >= 0.4 ? 3 : r >= 0.2 ? 2 : 1;

/** La palabra que acompaña al medidor; una relación en sentido contrario no es «débil». */
const wordOf = (r: number | null): string =>
  r === null
    ? 'sin dato'
    : r <= -0.2
      ? 'contraria'
      : r >= 0.7
        ? 'fuerte'
        : r >= 0.4
          ? 'moderada'
          : r >= 0.2
            ? 'débil'
            : 'casi nula';

/** El nombre de una lectura con su plaza cuando el nombre no la dice. */
const nameOf = (one: ExogenousSeries): string =>
  one.name.includes(one.market) ? one.name : `${one.name} (${one.market})`;

const optionOf = (one: ExogenousSeries): string =>
  `${nameOf(one)} · ${one.unit} · ${FREQUENCY[one.frequency] ?? one.frequency}`;

function Comparatives({ board }: { board: ExogenousBoard }) {
  const id = useId();
  /* Los fletes tienen su página en Transporte; aquí sólo los precios. */
  const all = useMemo(
    () => board.series.filter((one) => one.group !== 'FREIGHT' && one.points.length > 1),
    [board],
  );
  const byCode = useMemo(() => new Map(all.map((one) => [one.code, one])), [all]);
  const pairs = useMemo(() => availablePairs(new Set(byCode.keys())), [byCode]);
  const years = useMemo(() => {
    const list = all.flatMap((one) => one.points.map(([period]) => yearOf(period)));
    return { min: Math.min(...list), max: Math.max(...list) };
  }, [all]);

  const [left, setLeft] = useState(pairs[0]?.left ?? all[0]?.code ?? '');
  const [right, setRight] = useState(pairs[0]?.right ?? all[1]?.code ?? '');
  const [since, setSince] = useState(Math.max(years.min, years.max - 10));
  const [mode, setMode] = useState<FactorComparisonMode>('BASE100');

  /* Las listas, por familia y producto en el orden de «Precios por producto». */
  const options = useMemo(() => {
    const rank = (code: string) => {
      const at = PRODUCT_ORDER.indexOf(code);
      return at === -1 ? PRODUCT_ORDER.length : at;
    };
    const groups = new Map<string, ExogenousSeries[]>();
    for (const one of [...all].sort((a, b) => rank(a.product) - rank(b.product))) {
      const family = GROUPS.find((group) => group.key === one.group)?.label ?? one.group;
      const key = `${one.productLabel} — ${family.toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), one]);
    }
    return [...groups];
  }, [all]);

  const a = byCode.get(left);
  const b = byCode.get(right);
  const pair = pairs.find((one) => one.left === left && one.right === right);
  const sameUnit = !!a && !!b && a.unit === b.unit && a.kind === b.kind;
  const shownMode: FactorComparisonMode = mode === 'LEVEL' && !sameUnit ? 'BASE100' : mode;

  const outcome = useMemo(() => {
    if (!a || !b || a.code === b.code)
      return { error: 'La comparación necesita dos lecturas distintas.' };
    const slice = (one: ExogenousSeries) => {
      const data = asFamilyData(one);
      return { ...data, points: data.points.filter((point) => yearOf(point.period) >= since) };
    };
    const A = slice(a);
    const B = slice(b);
    try {
      const result = compareFactorSeries({
        leftSeries: A.series,
        rightSeries: B.series,
        leftPoints: A.points,
        rightPoints: B.points,
        mode: shownMode,
      });
      const monthly = result.frequency === 'MONTHLY';
      const reading = readPair(result.points, monthly ? 6 : 1, monthly ? 12 : 1);
      return { result, reading, monthly };
    } catch (error) {
      return {
        error: error instanceof FactorComparisonError ? error.message : 'No se pudo comparar.',
      };
    }
  }, [a, b, since, shownMode]);

  /*
   * Cuánto se mueven juntos los dos precios de cada par, en toda la historia común: el lector ve
   * la respuesta antes de abrir la comparación y las de cada tema se ordenan de la más fuerte a la
   * más débil. Con los años del gráfico, las series anuales (urea, diésel, fierro, cemento) no
   * llegaban a ocho variaciones y salían «sin dato». La correlación es de variaciones, así que no
   * depende de la escala.
   */
  const verdicts = useMemo(() => {
    const found = new Map<string, number | null>();
    for (const one of pairs) {
      const x = byCode.get(one.left);
      const y = byCode.get(one.right);
      if (!x || !y) continue;
      const X = asFamilyData(x);
      const Y = asFamilyData(y);
      try {
        const compared = compareFactorSeries({
          leftSeries: X.series,
          rightSeries: Y.series,
          leftPoints: X.points,
          rightPoints: Y.points,
          mode: 'BASE100',
        });
        const monthly = compared.frequency === 'MONTHLY';
        found.set(one.key, readPair(compared.points, 0, monthly ? 12 : 1).together);
      } catch {
        found.set(one.key, null);
      }
    }
    return found;
  }, [pairs, byCode]);

  const choose = (next: ExogenousPair) => {
    setLeft(next.left);
    setRight(next.right);
  };
  /* Elegir a mano la primera lectura de un par trae su pareja: es la comparación que se buscaba. */
  const pickLeft = (code: string) => {
    setLeft(code);
    const partner = pairs.find((one) => one.left === code);
    if (partner) setRight(partner.right);
  };

  const select = (value: string, onChange: (code: string) => void, label: string) => (
    <label className="compare-field">
      <span className="compare-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([group, members]) => (
          <optgroup key={group} label={group}>
            {members.map((one) => (
              <option key={one.code} value={one.code}>
                {optionOf(one)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );

  const result = 'result' in outcome ? outcome.result : null;
  const reading = 'reading' in outcome ? outcome.reading : null;
  const monthly = 'monthly' in outcome ? outcome.monthly : false;
  const error = 'error' in outcome ? outcome.error : null;
  const unit = result ? (shownMode === 'BASE100' ? 'índice, base = 100' : (a?.unit ?? '')) : '';

  const rows: DatedLinePoint[] = (result?.points ?? []).map((point) => ({
    date: monthly ? `${point.period}-01` : `${point.period}-01-01`,
    left: point.left,
    right: point.right,
  }));
  const lines: DatedLineSeries[] =
    a && b
      ? [
          { key: 'left', label: nameOf(a), tone: seriesTone(0), emphasis: true },
          { key: 'right', label: nameOf(b), tone: seriesTone(1), dashed: true },
        ]
      : [];
  const otherProduct = !!a && !!b && !pair && a.product !== b.product;

  return (
    <>
      <header className="page-intro">
        <h3 className="page-intro-title">Comparativos</h3>
        <p className="page-intro-lede">
          Dos precios frente a frente: el de Bolivia contra su referencia de afuera, lo que el país
          exporta contra su cotización, un insumo contra lo que encarece. Cada comparación dice
          cuánto cambió cada precio y si se mueven juntos.
        </p>
      </header>

      <Panel
        id="comparativos-sugeridos"
        title="Comparaciones sugeridas, por pregunta (pares de series)"
        lede="Cada comparación pone un precio de Bolivia junto al indicador que debería moverlo. A la derecha, cuánto se mueven juntos en toda su historia común; las de cada tema van de la relación más fuerte a la más débil. Al elegir una, se dibuja abajo."
        source="Fuentes de cada lectura; selección de DatosBolivia.com"
      >
        <div className="compare-themes">
          {THEMES.map((theme) => {
            const members = pairs
              .filter((one) => one.theme === theme.key)
              .sort(
                (x, y) => Math.abs(verdicts.get(y.key) ?? -1) - Math.abs(verdicts.get(x.key) ?? -1),
              );
            if (!members.length) return null;
            return (
              <section key={theme.key} className="compare-theme" aria-label={theme.label}>
                <h4 className="compare-theme-title">{theme.label}</h4>
                <ul className="compare-list">
                  {members.map((one) => {
                    const on = one === pair;
                    const r = verdicts.get(one.key) ?? null;
                    const level = strengthOf(r);
                    return (
                      <li key={one.key}>
                        <button
                          type="button"
                          className={on ? 'compare-row compare-row-on' : 'compare-row'}
                          aria-pressed={on}
                          onClick={() => choose(one)}
                        >
                          <span className="compare-q">{one.question}</span>
                          <span
                            className="compare-v"
                            title={
                              r === null
                                ? 'Sin variaciones suficientes para medirlo'
                                : `Correlación de las variaciones: ${figure(r, 2)}`
                            }
                          >
                            <span className="compare-meter" data-level={level} aria-hidden="true">
                              <i />
                              <i />
                              <i />
                              <i />
                            </span>
                            <span className="compare-v-word">{wordOf(r)}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </Panel>

      <Panel
        id="comparativos-grafico"
        title={
          a && b
            ? `${nameOf(a)} frente a ${nameOf(b)} (${unit || 'sin comparación'})`
            : 'Comparación'
        }
        lede={
          pair
            ? `${pair.question} ${pair.why}`
            : 'Comparación elegida a mano. La base 100 pone las dos lecturas en el mismo punto de partida para comparar su trayectoria, no su nivel.'
        }
        source={a && b ? sourcesOf([a, b]) : 'Fuentes de cada lectura (ver «Método»)'}
        data={() =>
          result && a && b
            ? {
                unidad: unit,
                columnas: ['Período', nameOf(a), nameOf(b)],
                filas: result.points.map((point) => [
                  point.period,
                  celda(point.left),
                  celda(point.right),
                ]),
                nota: result.description,
              }
            : undefined
        }
      >
        <div className="compare-controls">
          {select(left, pickLeft, 'Primera lectura')}
          {select(right, setRight, 'Segunda lectura')}
          <label className="compare-field compare-field-narrow">
            <span className="compare-label">Desde</span>
            <select value={since} onChange={(event) => setSince(Number(event.target.value))}>
              {Array.from({ length: years.max - years.min + 1 }, (_, index) => years.min + index)
                .reverse()
                .map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
            </select>
          </label>
          <div className="compare-field compare-field-narrow">
            <span className="compare-label" id={`${id}-mode`}>
              Escala
            </span>
            <div className="chips" role="group" aria-labelledby={`${id}-mode`}>
              <button
                type="button"
                className={shownMode === 'BASE100' ? 'chip chip-on' : 'chip'}
                aria-pressed={shownMode === 'BASE100'}
                onClick={() => setMode('BASE100')}
              >
                Base 100
              </button>
              <button
                type="button"
                className={shownMode === 'LEVEL' ? 'chip chip-on' : 'chip'}
                aria-pressed={shownMode === 'LEVEL'}
                disabled={!sameUnit}
                title={sameUnit ? undefined : 'Solo con la misma unidad'}
                onClick={() => setMode('LEVEL')}
              >
                Niveles
              </button>
            </div>
          </div>
        </div>

        {otherProduct ? (
          <p className="panel-note">
            Son productos distintos: el gráfico compara trayectorias y no dice que uno mueva al
            otro.
          </p>
        ) : null}
        {error ? (
          <div className="callout" role="alert">
            {error}
          </div>
        ) : null}

        {result && reading && a && b ? (
          <>
            <div className="stat-strip compare-stats">
              <div className="stat">
                <span className="stat-label">{nameOf(a)}</span>
                <span className="stat-value">{signed(reading.leftChange)}</span>
                <span className="stat-hint">
                  {reading.first && reading.last
                    ? `de ${sayPeriod(reading.first)} a ${sayPeriod(reading.last)}`
                    : 'sin períodos comunes'}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">{nameOf(b)}</span>
                <span className="stat-value">{signed(reading.rightChange)}</span>
                <span className="stat-hint">mismo tramo</span>
              </div>
              <div className="stat">
                <span className="stat-label">¿Se mueven juntas?</span>
                <span className="stat-value">
                  {reading.together === null ? '—' : figure(reading.together, 2)}
                </span>
                <span className="stat-hint">
                  {sayTogether(reading.together)}
                  {reading.together === null
                    ? ''
                    : `; correlación de ${monthly ? 'las variaciones interanuales' : 'las variaciones anuales'}, ${reading.pairs} ${monthly ? 'meses' : 'años'}`}
                </span>
              </div>
              {reading.lag ? (
                <div className="stat">
                  <span className="stat-label">Con rezago</span>
                  <span className="stat-value">
                    {reading.lag.periods}{' '}
                    {monthly ? 'meses' : reading.lag.periods === 1 ? 'año' : 'años'}
                  </span>
                  <span className="stat-hint">
                    la primera sigue a la segunda con ese retraso (correlación{' '}
                    {figure(reading.lag.correlation, 2)})
                  </span>
                </div>
              ) : null}
            </div>

            {rows.length ? (
              <ViewToggle
                label="Vista de la comparación"
                chart={
                  <DatedLines
                    data={rows}
                    series={lines}
                    unit={shownMode === 'BASE100' ? 'índice' : (a.unit ?? '')}
                    decimals={1}
                    {...(monthly ? { monthly: true } : { cadence: 'year' as const })}
                    {...(shownMode === 'BASE100'
                      ? {
                          referenceLine: 100,
                          referenceLabel: `100 = ${result.basePeriod ? sayPeriod(result.basePeriod) : 'base'}`,
                        }
                      : {})}
                  />
                }
                table={
                  <div className="table-wrap" style={{ maxHeight: 480, overflow: 'auto' }}>
                    <button
                      type="button"
                      className="chip"
                      onClick={() =>
                        downloadCsv(
                          `comparacion_${a.code}_${b.code}.csv`,
                          ['periodo', nameOf(a), nameOf(b)],
                          result.points.map((point) => [point.period, point.left, point.right]),
                        )
                      }
                    >
                      Descargar CSV de la comparación
                    </button>
                    <table className="grid-table">
                      <caption style={{ textAlign: 'left' }}>
                        {result.points.length} períodos, en {unit}. Una celda vacía es un período
                        sin dato; no se rellena.
                      </caption>
                      <thead>
                        <tr>
                          <th>Período</th>
                          <th className="num">{nameOf(a)}</th>
                          <th className="num">{nameOf(b)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...result.points].reverse().map((point) => (
                          <tr key={point.period}>
                            <th scope="row" style={{ textAlign: 'left', fontWeight: 500 }}>
                              {sayPeriod(point.period)}
                            </th>
                            <td className="num">
                              {point.left === null ? '' : figure(point.left, 2)}
                            </td>
                            <td className="num">
                              {point.right === null ? '' : figure(point.right, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                }
              />
            ) : (
              <div className="callout">No hay períodos comparables desde {since}.</div>
            )}

            <details className="panel-note">
              <summary>Cómo se calculó</summary>
              <p>{result.description}</p>
              {result.warnings.map((warning) => (
                <p key={warning}>{/\.$/u.test(warning) ? warning : `${warning}.`}</p>
              ))}
              <p>
                La correlación usa variaciones y no niveles: dos precios que suben con la inflación
                tendrían una correlación de niveles altísima sin tener nada que ver.
                {monthly
                  ? ' En series mensuales se mide sobre la variación interanual: mes a mes, un precio mayorista boliviano es casi todo ruido.'
                  : ''}
              </p>
            </details>
          </>
        ) : null}
      </Panel>
    </>
  );
}
