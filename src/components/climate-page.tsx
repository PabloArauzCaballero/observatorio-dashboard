'use client';

import { useMemo, useState } from 'react';
import {
  DatedLines,
  DivergingBars,
  HeatGrid,
  ShareBars,
  WorldLines,
  YearStackBars,
  seriesTone,
} from './charts';
import type {
  DatedLinePoint,
  DatedLineSeries,
  DivergingRow,
  HeatCell,
  ShareSlice,
  StackPart,
  WorldLinePoint,
  WorldLineSeries,
  YearStackRow,
} from './charts';
import { ClimateMap, ClimateStripes } from './climate-figures';
import type { StripeRow } from './climate-figures';
import { DerivedReading } from './derived-reading';
import { EnvironmentSection } from './environment-section';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import type { IconName } from './icons';
import { OnOpenNotice, useOnOpen } from './on-open';
import { Panel } from '@/components/ui/panel';
import { TabHeader } from '@/components/ui/tab-header';
import { ANY, additive, toggle, type Choice } from '@/lib/choice';
import {
  DEPARTMENTS,
  FAMILIES,
  MONTH_SHORT,
  SEASONS,
  SOURCES,
  VARIABLES,
  anomalyOf,
  cityName,
  deptName,
  ensoPhase,
  formatNumber,
  lastMonthOf,
  monthLabel,
  monthSeries,
  monthlyNormals,
  normalOf,
  normalPeriod,
  oniSeries,
  seasonOf,
  seasonValue,
  seasonYearLabel,
  signed,
  trendPerDecade,
  valueAt,
  variableOf,
  yearly,
  type ClimateBundle,
  type Family,
  type Measure,
  type MonthSeries,
  type Season,
  type SourceId,
  type Variable,
} from '@/lib/climate-board';
import type { FxConclusion } from '@/lib/fx-snapshot';

/**
 * Clima y ambiente: el clima de Bolivia por departamento y en el tiempo, con el
 * aire, el fuego y el bosque, y al final los indicadores ambientales nacionales
 * del Banco Mundial.
 *
 * Arriba, una lectura en cuatro frases que se calcula con los datos. Debajo, un
 * carril de filtros que manda sobre la primera mitad de la página —qué variable,
 * medida con qué fuente, en qué departamentos, en qué época del año y en qué
 * años— y el mapa, que también filtra: tocar un departamento recorta las series
 * de abajo. Los bloques de extremos, El Niño, aire y fuego tienen su variable
 * fija, pero obedecen la misma elección de departamentos y de años.
 *
 * Todas las cifras salen de `/api/clima` (los JSON de
 * `scripts/clima/collect-climate.mjs`) y de `/api/ambiente`. No se rellena
 * nada: un año sin todos sus meses no entra en ninguna cuenta.
 */

const MAX_LINES = 6;

const sayDay = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day ?? 1}-${MONTH_SHORT[(month ?? 1) - 1] ?? ''}-${year ?? ''}`;
};

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

const seasonPhrase = (season: Season): string =>
  season.id === 'anio'
    ? 'año completo'
    : season.label.charAt(0).toLowerCase() + season.label.slice(1);

/** La unidad en que se dice una diferencia: la de la medida, o porcentaje. */
const diffUnit = (variable: Variable, measure: Measure): string =>
  variable.anomaly === 'pct' ? '%' : measure.unit;
const diffDecimals = (variable: Variable, measure: Measure): number =>
  variable.anomaly === 'pct' ? 0 : measure.decimals === 0 ? 1 : measure.decimals;

function sourceCredit(source: SourceId, bundle: ClimateBundle): string {
  switch (source) {
    case 'era5':
      return bundle.capitales.fuente.nombre;
    case 'power':
      return bundle.departamentos.fuente.nombre;
    case 'cams':
      return bundle.aire.fuente.nombre;
    case 'firms':
      return bundle.fuegoBosque.focos.fuente.nombre;
    case 'gfw':
      return bundle.fuegoBosque.bosque.fuente.nombre;
  }
}

function sourceUpdated(source: SourceId, bundle: ClimateBundle): string {
  const iso =
    source === 'era5'
      ? bundle.capitales.consultado
      : source === 'power'
        ? bundle.departamentos.consultado
        : source === 'cams'
          ? bundle.aire.consultado
          : bundle.fuegoBosque.consultado;
  return sayDay(iso);
}

function HowTo({ children }: { children: React.ReactNode }) {
  return (
    <p className="clima-howto">
      <b>Cómo leer:</b> {children}
    </p>
  );
}

/* ───────────────────────── lectura simple ───────────────────────── */

const READING_ICONS: Record<string, IconName> = {
  calor: 'sol',
  lluvias: 'gota',
  fuego: 'rayo',
  bosque: 'hoja',
};

function simpleReading(bundle: ClimateBundle): FxConclusion[] {
  const out: FxConclusion[] = [];
  const temp = variableOf('t');
  const tempEra5 = temp.measures[0] as Measure;
  const year = SEASONS[0] as Season;

  // 1. El año más cálido en las capitales, y la tendencia desde 1981.
  const warmest = new Map<number, string[]>();
  const trends: Array<{ code: string; slope: number }> = [];
  let lastYear = 0;
  for (const dept of DEPARTMENTS) {
    const years = yearly(bundle, temp, tempEra5, dept.code, year);
    let best: [number, number] | null = null;
    for (const [y, value] of years) if (!best || value > best[1]) best = [y, value];
    if (best) warmest.set(best[0], [...(warmest.get(best[0]) ?? []), dept.name]);
    const points = [...years].filter(([y]) => y >= 1981);
    lastYear = Math.max(lastYear, ...years.keys());
    const slope = trendPerDecade(points);
    if (slope !== null) trends.push({ code: dept.code, slope });
  }
  const top = [...warmest.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (top && trends.length) {
    const mean = trends.reduce((a, b) => a + b.slope, 0) / trends.length;
    const sorted = [...trends].sort((a, b) => a.slope - b.slope);
    const low = sorted[0];
    const high = sorted.at(-1);
    out.push({
      key: 'calor',
      claim: `El año más cálido desde ${bundle.capitales.inicio.slice(0, 4)} en ${top[1].length} de las ${[...warmest.values()].flat().length} capitales`,
      figure: String(top[0]),
      detail: `${top[1].join(', ')}. Desde 1981 las capitales se calentaron en promedio ${signed(mean, 2)} °C por década (de ${signed(low?.slope ?? 0, 2)} °C en ${deptName(low?.code ?? '')} a ${signed(high?.slope ?? 0, 2)} °C en ${deptName(high?.code ?? '')}), según el reanálisis ERA5 hasta ${lastYear}.`,
      tone: 'adverse',
    });
  }

  // 2. La última época de lluvias completa frente a lo normal.
  const rain = variableOf('p');
  const rainEra5 = rain.measures[0] as Measure;
  const wet = seasonOf('lluvias');
  const rows: Array<{ name: string; pct: number }> = [];
  let rainYear = 0;
  for (const dept of DEPARTMENTS) {
    const years = yearly(bundle, rain, rainEra5, dept.code, wet);
    rainYear = Math.max(rainYear, ...years.keys());
  }
  for (const dept of DEPARTMENTS) {
    const years = yearly(bundle, rain, rainEra5, dept.code, wet);
    const normal = normalOf(years, [1991, 2020]);
    const value = years.get(rainYear);
    if (normal !== null && value !== undefined) {
      const pct = anomalyOf(value, normal, 'pct');
      if (pct !== null) rows.push({ name: dept.name, pct });
    }
  }
  if (rows.length) {
    const dry = rows.filter((row) => row.pct <= -10);
    const wetter = rows.filter((row) => row.pct >= 10);
    const driest = [...rows].sort((a, b) => a.pct - b.pct)[0];
    out.push({
      key: 'lluvias',
      claim: `Última época de lluvias (dic-${rainYear - 1} a mar-${rainYear}): más seca de lo normal en`,
      figure: `${dry.length} de ${rows.length}`,
      detail: `Lluvia de diciembre a marzo en cada capital frente al promedio 1991-2020 (más de un 10 % por debajo). La más seca fue ${driest?.name ?? ''} (${signed(driest?.pct ?? 0, 0)} %); ${wetter.length} capitales tuvieron más lluvia de lo normal.`,
      tone: dry.length > wetter.length ? 'adverse' : 'neutral',
    });
  }

  // 3. Focos de calor: el peor año y 2026 hasta hoy.
  const fires = bundle.fuegoBosque.focos;
  const firstFireYear = Number(fires.inicio.slice(0, 4));
  const perYear = new Map<number, number>();
  const perDept = new Map<string, Map<number, number>>();
  for (const [code, values] of Object.entries(fires.series)) {
    const byYear = new Map<number, number>();
    values.forEach((value, index) => {
      const y = firstFireYear + Math.floor(index / 12);
      perYear.set(y, (perYear.get(y) ?? 0) + value);
      byYear.set(y, (byYear.get(y) ?? 0) + value);
    });
    perDept.set(code, byYear);
  }
  const worst = [...perYear.entries()].sort((a, b) => b[1] - a[1])[0];
  if (worst) {
    const lowlands = ['SANTA_CRUZ', 'BENI'].reduce(
      (sum, code) => sum + (perDept.get(code)?.get(worst[0]) ?? 0),
      0,
    );
    const weeks = bundle.fuegoBosque.focos2026;
    const so = Object.values(weeks.semanas['2026'] ?? {}).reduce(
      (sum, list) => sum + list.reduce((a, b) => a + b, 0),
      0,
    );
    const before = Object.values(weeks.semanas['2025'] ?? {}).reduce(
      (sum, list) => sum + list.slice(0, weeks.ultimaSemana).reduce((a, b) => a + b, 0),
      0,
    );
    out.push({
      key: 'fuego',
      claim: `Año con más focos de calor desde ${firstFireYear}`,
      figure: `${worst[0]}: ${formatNumber(worst[1], 0)}`,
      detail: `Santa Cruz y Beni concentraron el ${formatNumber((lowlands / worst[1]) * 100, 0)} %. En 2026, hasta la semana ${weeks.ultimaSemana}, van ${formatNumber(so, 0)} focos, frente a ${formatNumber(before, 0)} en las mismas semanas de 2025 (cifra provisional de Global Forest Watch).`,
      tone: 'adverse',
    });
  }

  // 4. El bosque perdido.
  const forest = bundle.fuegoBosque.bosque;
  const sum = (table: Record<string, number[]>) =>
    Object.values(table).reduce((total, list) => total + list.reduce((a, b) => a + b, 0), 0);
  const lost = sum(forest.perdida);
  const byFire = sum(forest.porFuego);
  const cover = Object.values(forest.cobertura2000).reduce((a, b) => a + b, 0);
  const santaCruz = (forest.perdida.SANTA_CRUZ ?? []).reduce((a, b) => a + b, 0);
  if (lost > 0 && cover > 0) {
    out.push({
      key: 'bosque',
      claim: `Cobertura arbórea perdida entre ${forest.anios[0] ?? ''} y ${forest.anios.at(-1) ?? ''}`,
      figure: `${formatNumber(lost / 1e6, 1)} millones de ha`,
      detail: `Equivale al ${formatNumber((lost / cover) * 100, 1)} % de la cobertura de 2000. El ${formatNumber((santaCruz / lost) * 100, 0)} % ocurrió en Santa Cruz y el fuego explica el ${formatNumber((byFire / lost) * 100, 0)} % del total.`,
      tone: 'adverse',
    });
  }
  return out;
}

/* ───────────────────────── el carril ───────────────────────── */

function RailItem({
  on,
  label,
  count,
  onClick,
}: {
  on: boolean;
  label: string;
  count?: string;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      className={on ? 'rail-item rail-item-on' : 'rail-item'}
      aria-pressed={on}
      onClick={onClick}
    >
      <span className="rail-name">{label}</span>
      {count ? <span className="rail-n">{count}</span> : null}
    </button>
  );
}

/* ───────────────────────── la página ───────────────────────── */

export function ClimatePage() {
  const { payload, failed } = useOnOpen<ClimateBundle>('/api/clima');
  if (!payload) return <OnOpenNotice what="el clima y el ambiente" failed={failed} />;
  return <ClimateBoard bundle={payload} />;
}

interface DeptRow {
  code: string;
  name: string;
  years: Map<number, number>;
  normal: number | null;
}

function ClimateBoard({ bundle }: { bundle: ClimateBundle }) {
  const [variableId, setVariableId] = useState('t');
  const [sourceId, setSourceId] = useState<SourceId>('power');
  const [depts, setDepts] = useState<Choice>(ANY);
  const [focusPick, setFocusPick] = useState('LA_PAZ');
  const [seasonId, setSeasonId] = useState('anio');
  const [range, setRange] = useState<[number | null, number | null]>([null, null]);
  const [mode, setMode] = useState<'anomalia' | 'valor'>('anomalia');
  const [phase, setPhase] = useState<'nino' | 'nina'>('nino');

  const variable = variableOf(variableId);
  const measure =
    variable.measures.find((one) => one.source === sourceId) ?? (variable.measures[0] as Measure);
  const season = variable.annualOnly ? (SEASONS[0] as Season) : seasonOf(seasonId);
  const period = normalPeriod(measure);
  const showAnomaly = period !== null && mode === 'anomalia';
  const unitShown = showAnomaly ? diffUnit(variable, measure) : measure.unit;
  const decimalsShown = showAnomaly ? diffDecimals(variable, measure) : measure.decimals;

  const table: DeptRow[] = useMemo(
    () =>
      DEPARTMENTS.map((dept) => {
        const years = yearly(bundle, variable, measure, dept.code, season);
        return { code: dept.code, name: dept.name, years, normal: normalOf(years, period) };
      }),
    [bundle, variable, measure, season, period],
  );

  const allYears = [...new Set(table.flatMap((row) => [...row.years.keys()]))].sort(
    (a, b) => a - b,
  );
  const first = allYears[0] ?? 1950;
  const last = allYears.at(-1) ?? first;
  const from = clamp(range[0] ?? first, first, last);
  const to = clamp(range[1] ?? last, from, last);
  const span = allYears.filter((year) => year >= from && year <= to);

  const shown = depts.size ? DEPARTMENTS.filter((dept) => depts.has(dept.code)) : DEPARTMENTS;
  const lined = shown.slice(0, MAX_LINES);
  const focus = depts.size && !depts.has(focusPick) ? (shown[0]?.code ?? focusPick) : focusPick;

  const shownValue = (row: DeptRow, year: number): number | null => {
    const value = row.years.get(year);
    if (value === undefined) return null;
    if (!showAnomaly) return value;
    return row.normal === null ? null : anomalyOf(value, row.normal, variable.anomaly);
  };

  const pick = (code: string, more: boolean) => {
    setDepts((current) => toggle(current, code, more));
    setFocusPick(code);
  };

  const chooseVariable = (id: string) => {
    const next = variableOf(id);
    setVariableId(id);
    if (!next.measures.some((one) => one.source === sourceId)) {
      setSourceId((next.measures[0] as Measure).source);
    }
    setRange([null, null]);
  };
  const chooseFamily = (family: Family) => {
    const firstOf = VARIABLES.find((one) => one.family === family);
    if (firstOf) chooseVariable(firstOf.id);
  };

  const filtersOn =
    (variableId !== 't' ? 1 : 0) +
    (sourceId !== 'power' ? 1 : 0) +
    (depts.size ? 1 : 0) +
    (seasonId !== 'anio' ? 1 : 0) +
    (range[0] !== null || range[1] !== null ? 1 : 0) +
    (mode !== 'anomalia' ? 1 : 0);
  const reset = () => {
    setVariableId('t');
    setSourceId('power');
    setDepts(ANY);
    setSeasonId('anio');
    setRange([null, null]);
    setMode('anomalia');
  };

  const reading = useMemo(() => simpleReading(bundle), [bundle]);
  const credit = sourceCredit(measure.source, bundle);
  const updated = sourceUpdated(measure.source, bundle);
  const yearText = seasonYearLabel(season, to);
  const seasonText = seasonPhrase(season);
  const periodText = period ? `${period[0]}–${period[1]}` : '';

  /* El mapa: el año «hasta», todos los departamentos. */
  const mapReadings = table.map((row) => ({
    code: row.code,
    name: row.name,
    value: shownValue(row, to),
  }));
  const ranked = [...mapReadings].sort(
    (left, right) => (right.value ?? -Infinity) - (left.value ?? -Infinity),
  );
  const withValue = ranked.filter((row) => row.value !== null);
  const mapLede = (() => {
    if (!withValue.length) return 'No hay datos completos para ese año y esa época.';
    const top = withValue[0];
    const bottom = withValue.at(-1);
    if (showAnomaly) {
      const above = withValue.filter((row) => (row.value ?? 0) > 0).length;
      return `En ${yearText}, ${above} de ${withValue.length} departamentos quedaron por encima de su normal ${periodText}. El mayor apartamiento fue en ${top?.name} (${signed(top?.value ?? 0, decimalsShown)} ${unitShown}) y el menor en ${bottom?.name} (${signed(bottom?.value ?? 0, decimalsShown)} ${unitShown}).`;
    }
    return `En ${yearText}, el valor más alto fue el de ${top?.name} (${formatNumber(top?.value ?? 0, decimalsShown)} ${unitShown}) y el más bajo el de ${bottom?.name} (${formatNumber(bottom?.value ?? 0, decimalsShown)} ${unitShown}).`;
  })();

  /* Las rayas: una fila por departamento elegido. */
  const stripeRows: StripeRow[] = shown.map((dept) => {
    const row = table.find((one) => one.code === dept.code) as DeptRow;
    return {
      code: dept.code,
      name: dept.name,
      cells: span.map((year) => {
        const value = row.years.get(year);
        return {
          year,
          anomaly:
            value === undefined || row.normal === null
              ? null
              : anomalyOf(value, row.normal, variable.anomaly),
        };
      }),
    };
  });

  /*
   * Sin departamentos elegidos, las series de líneas dibujan el promedio de los
   * que tienen dato: nueve líneas de colores se enredan y la paleta tiene seis
   * casillas. Al elegir departamentos, una línea por cada uno (hasta seis).
   */
  const withData = table.filter((row) => row.years.size > 0);
  const averageLabel = `Promedio de ${withData.length === 9 ? 'los 9' : withData.length} departamentos`;
  const mean = (values: ReadonlyArray<number | null>): number | null =>
    values.length && values.every((value) => value !== null)
      ? (values as number[]).reduce((a, b) => a + b, 0) / values.length
      : null;

  /* La serie anual. */
  const annualData: WorldLinePoint[] = span.map((year) => {
    const point: WorldLinePoint = { year: seasonYearLabel(season, year) };
    if (!depts.size) {
      const value = mean(withData.map((row) => shownValue(row, year)));
      point.avg = value === null ? null : Number(value.toFixed(decimalsShown + 1));
      return point;
    }
    for (const dept of lined) {
      const row = table.find((one) => one.code === dept.code) as DeptRow;
      const value = shownValue(row, year);
      point[dept.code] = value === null ? null : Number(value.toFixed(decimalsShown + 1));
    }
    return point;
  });
  const annualSeries: WorldLineSeries[] = depts.size
    ? lined.map((dept, index) => ({
        key: dept.code,
        label: dept.name,
        tone: seriesTone(index),
        ...(dept.code === focus ? { emphasis: true } : {}),
      }))
    : [{ key: 'avg', label: averageLabel, tone: seriesTone(0), emphasis: true }];

  /*
   * La tendencia: cuánto cambió la variable en todo el periodo según la recta que
   * mejor se ajusta a los años. Se dice como cambio total y no por década porque
   * así se lee sin hacer cuentas («+1,4 °C entre 1981 y 2025»).
   */
  const trendUnit = variable.anomaly === 'pct' ? '% de lo normal' : measure.unit;
  const trendRows: DivergingRow[] = shown.flatMap((dept) => {
    const row = table.find((one) => one.code === dept.code) as DeptRow;
    const points = span
      .map((year) => [year, row.years.get(year)] as const)
      .filter((pair): pair is readonly [number, number] => pair[1] !== undefined)
      .map(([year, value]) => [year, value] as [number, number]);
    const slope = trendPerDecade(points);
    if (slope === null) return [];
    const years = (points.at(-1)?.[0] ?? 0) - (points[0]?.[0] ?? 0);
    const change = (slope / 10) * years;
    const base = row.normal ?? points.reduce((a, [, value]) => a + value, 0) / points.length;
    const value =
      variable.anomaly === 'pct' ? (base ? (change / Math.abs(base)) * 100 : 0) : change;
    return [{ name: dept.name, value: Number(value.toFixed(3)), meta: `${points.length} años` }];
  });

  /* El ciclo del año en el departamento en detalle. */
  const focusSeries = variable.annualOnly ? null : monthSeries(bundle, measure, focus);
  const lastData = focusSeries ? lastMonthOf(focusSeries) : null;
  const cycleYears = lastData
    ? [...new Set([to, lastData.year > to ? lastData.year : to - 1])].filter(
        (year) => year >= first,
      )
    : [];
  const cycleReference = (() => {
    if (!focusSeries) return null;
    if (period)
      return { label: `Normal ${periodText}`, values: monthlyNormals(focusSeries, period) };
    const years = allYears.filter((year) => year <= to);
    if (!years.length) return null;
    const a = years[0] as number;
    const b = years.at(-1) as number;
    const values = Array.from({ length: 12 }, (_, index) => {
      const list: number[] = [];
      for (let year = a; year <= b; year += 1) {
        const value = valueAt(focusSeries, year, index + 1);
        if (value !== null) list.push(value);
      }
      return list.length ? list.reduce((x, y) => x + y, 0) / list.length : null;
    });
    return { label: `Promedio ${a}–${b}`, values };
  })();
  const cycleData: WorldLinePoint[] = MONTH_SHORT.map((name, index) => {
    const point: WorldLinePoint = { year: name };
    if (cycleReference) {
      const value = cycleReference.values[index];
      point.ref =
        value === null || value === undefined ? null : Number(value.toFixed(measure.decimals + 1));
    }
    for (const year of cycleYears) {
      const value = focusSeries ? valueAt(focusSeries, year, index + 1) : null;
      point[`y${year}`] = value;
    }
    return point;
  });
  const cycleSeries: WorldLineSeries[] = [
    ...(cycleReference
      ? [{ key: 'ref', label: cycleReference.label, tone: 'var(--series-rest)', dashed: true }]
      : []),
    ...cycleYears.map((year, index) => ({
      key: `y${year}`,
      label: String(year),
      tone: seriesTone(index),
      ...(index === 0 ? { emphasis: true } : {}),
    })),
  ];

  /* Cada mes frente a su normal, en los últimos cinco años del periodo. */
  const monthStart = Math.max(first, to - 4);
  const monthData: DatedLinePoint[] = [];
  const monthLines: DatedLineSeries[] = [];
  if (!variable.annualOnly) {
    const perDept = (depts.size ? lined : DEPARTMENTS).map((dept) => {
      const series = monthSeries(bundle, measure, dept.code);
      return { dept, series, normals: series && period ? monthlyNormals(series, period) : null };
    });
    const end = perDept.reduce<{ year: number; month: number } | null>((acc, one) => {
      if (!one.series) return acc;
      const lastOne = lastMonthOf(one.series);
      return !acc || lastOne.year * 12 + lastOne.month > acc.year * 12 + acc.month ? lastOne : acc;
    }, null);
    if (end) {
      for (let year = monthStart; year <= end.year; year += 1) {
        for (let month = 1; month <= 12; month += 1) {
          if (year === end.year && month > end.month) break;
          const point: DatedLinePoint = { date: `${year}-${String(month).padStart(2, '0')}-01` };
          for (const one of perDept) {
            const value = one.series ? valueAt(one.series, year, month) : null;
            const normal = one.normals?.[month - 1] ?? null;
            if (value === null) point[one.dept.code] = null;
            else if (showAnomaly && normal !== null) {
              const anomaly = anomalyOf(value, normal, variable.anomaly);
              point[one.dept.code] = anomaly === null ? null : Number(anomaly.toFixed(2));
            } else point[one.dept.code] = showAnomaly ? null : value;
          }
          if (!depts.size) {
            const values = perDept
              .filter((one) => one.series)
              .map((one) => point[one.dept.code] as number | null);
            const value = mean(values);
            monthData.push({
              date: point.date,
              avg: value === null ? null : Number(value.toFixed(2)),
            });
          } else monthData.push(point);
        }
      }
      if (!depts.size) {
        monthLines.push({ key: 'avg', label: averageLabel, tone: seriesTone(0), emphasis: true });
      } else {
        perDept.forEach((one, index) =>
          monthLines.push({
            key: one.dept.code,
            label: one.dept.name,
            tone: seriesTone(index),
            ...(one.dept.code === focus ? { emphasis: true } : {}),
          }),
        );
      }
    }
  }

  const sourceLabel = SOURCES[measure.source];
  const tooMany = shown.length > MAX_LINES;
  const chosenYears: [number | null, number | null] = range;

  return (
    <div className="stack guest-board clima-page">
      <TabHeader
        id="clima"
        kicker="Territorio · Clima y ambiente"
        title="Clima y ambiente"
        lede={`El clima de los nueve departamentos desde ${bundle.capitales.inicio.slice(0, 4)}, el aire de las capitales, los focos de calor y la pérdida de bosque, con cinco fuentes abiertas: el reanálisis ERA5 de Copernicus, NASA POWER, el servicio atmosférico CAMS, NASA FIRMS y Global Forest Watch. Al final, los indicadores ambientales nacionales del Banco Mundial.`}
      />
      <DerivedReading
        id="clima-lectura"
        title="Lo esencial"
        note="Cuatro frases calculadas con las series de esta página; se actualizan cuando se vuelven a recolectar los datos. Describen lo medido, no sus causas."
        conclusions={reading}
        icons={READING_ICONS}
        defaultOpen
        source="ERA5 (Copernicus), NASA FIRMS y Global Forest Watch; cálculo de DatosBolivia.com"
      />

      <div className="workspace">
        <aside className="rail" aria-label="Filtros del clima">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {filtersOn ? `${filtersOn} ${filtersOn === 1 ? 'activo' : 'activos'}` : 'sin filtro'}
            </span>
          </div>
          <FilterHint>Valen para el mapa y los gráficos de esta columna.</FilterHint>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Tema
            </div>
            <div className="rail-pills">
              {FAMILIES.map((family) => (
                <button
                  key={family.id}
                  type="button"
                  className={family.id === variable.family ? 'chip chip-on' : 'chip'}
                  aria-pressed={family.id === variable.family}
                  onClick={() => chooseFamily(family.id)}
                >
                  {family.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="clima" size={13} />
              Variable
            </div>
            <div className="rail-list">
              {VARIABLES.filter((one) => one.family === variable.family).map((one) => (
                <RailItem
                  key={one.id}
                  on={one.id === variable.id}
                  label={one.label}
                  count={one.measures.length > 1 ? `${one.measures.length} fuentes` : ''}
                  onClick={() => chooseVariable(one.id)}
                />
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="globo" size={13} />
              Dónde y con qué se mide
            </div>
            <div className="rail-list">
              {variable.measures.map((one) => {
                const years = DEPARTMENTS.flatMap((dept) => [
                  ...yearly(bundle, variable, one, dept.code, SEASONS[0] as Season).keys(),
                ]);
                const since = years.length ? Math.min(...years) : null;
                return (
                  <RailItem
                    key={one.source}
                    on={one.source === measure.source}
                    label={SOURCES[one.source].label}
                    count={since === null ? '' : `desde ${since}`}
                    onClick={() => {
                      setSourceId(one.source);
                      setRange([null, null]);
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="mapa" size={13} />
              Departamentos
              <PickedCount choice={depts} />
            </div>
            <div className="rail-list">
              <RailItem on={!depts.size} label="Todos" count="9" onClick={() => setDepts(ANY)} />
              {DEPARTMENTS.map((dept) => {
                const reading = mapReadings.find((one) => one.code === dept.code)?.value ?? null;
                return (
                  <RailItem
                    key={dept.code}
                    on={depts.has(dept.code)}
                    label={dept.name}
                    count={
                      reading === null
                        ? '—'
                        : showAnomaly
                          ? signed(reading, decimalsShown)
                          : formatNumber(reading, decimalsShown)
                    }
                    onClick={(event) => pick(dept.code, additive(event))}
                  />
                );
              })}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Época del año
            </div>
            <label className="rail-field">
              <span className="rail-hint">
                {variable.annualOnly
                  ? 'Esta variable solo tiene un dato por año.'
                  : 'Meses que se suman o promedian'}
              </span>
              <select
                value={season.id}
                disabled={Boolean(variable.annualOnly)}
                onChange={(event) => setSeasonId(event.target.value)}
              >
                <optgroup label="Épocas">
                  {SEASONS.slice(0, 4).map((one) => (
                    <option key={one.id} value={one.id}>
                      {one.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Un mes">
                  {SEASONS.slice(4).map((one) => (
                    <option key={one.id} value={one.id}>
                      {one.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="reloj" size={13} />
              Años
            </div>
            <div className="clima-years">
              <label className="rail-field">
                <span className="rail-hint">Desde</span>
                <select
                  value={from}
                  onChange={(event) => setRange([Number(event.target.value), range[1]])}
                >
                  {allYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rail-field">
                <span className="rail-hint">Hasta (y año del mapa)</span>
                <select
                  value={to}
                  onChange={(event) => setRange([range[0], Number(event.target.value)])}
                >
                  {allYears
                    .filter((year) => year >= from)
                    .map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="balanza" size={13} />
              Mostrar
            </div>
            <div className="rail-pills">
              <button
                type="button"
                className={showAnomaly ? 'chip chip-on' : 'chip'}
                aria-pressed={showAnomaly}
                disabled={period === null}
                onClick={() => setMode('anomalia')}
              >
                Diferencia con lo normal
              </button>
              <button
                type="button"
                className={!showAnomaly ? 'chip chip-on' : 'chip'}
                aria-pressed={!showAnomaly}
                onClick={() => setMode('valor')}
              >
                Valor medido
              </button>
            </div>
            {period === null ? (
              <p className="rail-hint-top">
                Esta fuente empieza en 2022: no hay todavía un periodo normal con qué comparar.
              </p>
            ) : null}
          </div>

          {filtersOn ? (
            <div className="rail-sec">
              <button type="button" className="chip" onClick={reset}>
                Limpiar todo
              </button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main stack">
          <Panel
            id="clima-mapa"
            title={
              showAnomaly
                ? `${variable.label}: diferencia con lo normal ${periodText}, ${seasonText} ${yearText} (${unitShown})`
                : `${variable.label}, ${seasonText} ${yearText} (${unitShown})`
            }
            lede={mapLede}
            source={credit}
            updated={updated}
            data={() => ({
              unidad: unitShown,
              columnas: [
                'Departamento',
                `${variable.label} ${yearText} (${measure.unit})`,
                `Normal ${periodText} (${measure.unit})`,
                `Diferencia (${diffUnit(variable, measure)})`,
              ],
              filas: table.map((row) => {
                const value = row.years.get(to) ?? null;
                const anomaly =
                  value === null || row.normal === null
                    ? null
                    : anomalyOf(value, row.normal, variable.anomaly);
                return [row.name, value, row.normal, anomaly];
              }),
            })}
          >
            <div className="map-layout">
              <ClimateMap
                readings={mapReadings}
                label={variable.label}
                unit={unitShown}
                decimals={decimalsShown}
                diverging={showAnomaly}
                polarity={variable.polarity}
                chosen={depts}
                onPick={pick}
              />
              <div className="map-side">
                <h4 className="map-side-head">De mayor a menor</h4>
                <ul className="map-list">
                  {ranked.map((reading, index) => (
                    <li key={reading.code}>
                      <button
                        type="button"
                        className={depts.has(reading.code) ? 'map-row map-row-on' : 'map-row'}
                        aria-pressed={depts.has(reading.code)}
                        onClick={(event) => pick(reading.code, additive(event))}
                      >
                        <span className="map-row-name">
                          <span className="rank-position">{index + 1}</span> {reading.name}
                        </span>
                        <span className="map-row-kind">
                          {measure.source === 'era5' || measure.source === 'cams'
                            ? cityName(reading.code)
                            : ''}
                        </span>
                        <span className="map-row-count">
                          {reading.value === null
                            ? '—'
                            : showAnomaly
                              ? signed(reading.value, decimalsShown)
                              : formatNumber(reading.value, decimalsShown)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="map-note">
                  {variable.what} Medido {sourceLabel.where}.
                </p>
              </div>
            </div>
            <HowTo>
              {showAnomaly
                ? `cada departamento lleva su diferencia con su propio promedio ${periodText}; ${
                    variable.polarity === 'warm'
                      ? 'el rojo es más de lo normal y el verde azulado, menos'
                      : 'el verde azulado es más de lo normal y el rojo, menos'
                  }. Tocar un departamento filtra los gráficos de abajo (Ctrl+clic suma otro).`
                : 'más oscuro es más. Tocar un departamento filtra los gráficos de abajo (Ctrl+clic suma otro).'}
            </HowTo>
          </Panel>

          {period !== null && span.length > 1 ? (
            <Panel
              id="clima-rayas"
              title={`${variable.label}: diferencia de cada año con lo normal ${periodText}, ${from}–${to} (${diffUnit(variable, measure)})`}
              lede={`Una raya por año y una fila por departamento (${seasonText}). Medido ${sourceLabel.where}.`}
              source={credit}
              updated={updated}
              data={() => ({
                unidad: diffUnit(variable, measure),
                columnas: [
                  'Departamento',
                  'Año',
                  `Valor (${measure.unit})`,
                  `Normal ${periodText} (${measure.unit})`,
                  `Diferencia (${diffUnit(variable, measure)})`,
                ],
                filas: stripeRows.flatMap((row) => {
                  const dept = table.find((one) => one.code === row.code) as DeptRow;
                  return row.cells.map((cell) => [
                    row.name,
                    seasonYearLabel(season, cell.year),
                    dept.years.get(cell.year) ?? null,
                    dept.normal,
                    cell.anomaly,
                  ]);
                }),
              })}
            >
              <ClimateStripes
                rows={stripeRows}
                years={span}
                unit={diffUnit(variable, measure)}
                decimals={diffDecimals(variable, measure)}
                polarity={variable.polarity}
              />
              <HowTo>
                {variable.polarity === 'warm'
                  ? 'cada raya es un año: roja si estuvo por encima de lo normal, verde azulada si estuvo por debajo; cuanto más intensa, mayor la diferencia. Si el rojo se junta a la derecha, los años recientes son los distintos.'
                  : 'cada raya es un año: verde azulada si estuvo por encima de lo normal, roja si estuvo por debajo; cuanto más intensa, mayor la diferencia.'}
              </HowTo>
            </Panel>
          ) : null}

          <div className="grid-pair">
            <Panel
              id="clima-anual"
              title={
                showAnomaly
                  ? `${variable.label}: diferencia con lo normal por año, ${seasonText} (${unitShown})`
                  : `${variable.label} por año, ${seasonText} (${unitShown})`
              }
              lede={`${from}–${to}, ${sourceLabel.where}.${depts.size ? (tooMany ? ` Se dibujan los ${MAX_LINES} primeros departamentos elegidos.` : '') : ' Sin departamentos elegidos se dibuja el promedio; al tocar el mapa aparece cada uno.'}`}
              source={credit}
              updated={updated}
            >
              {annualData.length > 1 ? (
                <WorldLines
                  data={annualData}
                  series={annualSeries}
                  format={(value) =>
                    `${showAnomaly ? signed(value, decimalsShown) : formatNumber(value, decimalsShown)} ${unitShown}`
                  }
                  tick={(value) => formatNumber(value, decimalsShown > 1 ? 1 : decimalsShown)}
                />
              ) : (
                <div className="callout">Hace falta más de un año para dibujar la serie.</div>
              )}
              <HowTo>
                {showAnomaly
                  ? 'sobre cero, el año estuvo por encima de su normal; bajo cero, por debajo.'
                  : 'cada punto es el valor de un año completo (o de la época elegida).'}
              </HowTo>
            </Panel>

            <Panel
              id="clima-tendencia"
              title={`${variable.label}: cambio según la tendencia, ${from}–${to} (${trendUnit})`}
              lede="Cuánto subió o bajó en todo el periodo según la recta que mejor se ajusta a los años elegidos; quita el vaivén de un año a otro."
              source={`${credit}; cálculo de DatosBolivia.com`}
              updated={updated}
            >
              {trendRows.length ? (
                <DivergingBars data={trendRows} unit={trendUnit} signed />
              ) : (
                <div className="callout">
                  Hacen falta al menos diez años para calcular una tendencia.
                </div>
              )}
              <HowTo>
                barras a la derecha, la variable sube con los años; a la izquierda, baja. Una
                tendencia corta (pocos años) es poco fiable.
              </HowTo>
            </Panel>
          </div>

          {!variable.annualOnly ? (
            <div className="grid-pair">
              <Panel
                id="clima-estacional"
                title={`${variable.label} mes a mes en ${deptName(focus)} (${measure.unit})`}
                lede={`${cycleYears.join(' y ')} frente a ${cycleReference?.label.toLowerCase() ?? 'lo normal'}, ${sourceLabel.where}.`}
                source={credit}
                updated={updated}
              >
                <div className="clima-inline">
                  <label className="clima-inline-field">
                    <span>Departamento en detalle</span>
                    <select value={focus} onChange={(event) => setFocusPick(event.target.value)}>
                      {shown.map((dept) => (
                        <option key={dept.code} value={dept.code}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <WorldLines
                  data={cycleData}
                  series={cycleSeries}
                  format={(value) => `${formatNumber(value, measure.decimals)} ${measure.unit}`}
                  tick={(value) => formatNumber(value, measure.decimals > 1 ? 1 : measure.decimals)}
                />
                <HowTo>
                  la línea discontinua es el mes típico; si la línea del año va por encima, ese mes
                  tuvo más de lo normal.
                </HowTo>
              </Panel>

              <Panel
                id="clima-meses"
                title={
                  showAnomaly
                    ? `${variable.label}: cada mes frente a su normal, desde ${monthStart} (${unitShown})`
                    : `${variable.label} por mes, desde ${monthStart} (${unitShown})`
                }
                lede={`Los meses más recientes de los departamentos elegidos, ${sourceLabel.where}.`}
                source={credit}
                updated={updated}
              >
                {monthData.length ? (
                  <DatedLines
                    data={monthData}
                    series={monthLines}
                    unit={unitShown}
                    decimals={decimalsShown}
                    monthly
                    yearTicks
                    {...(showAnomaly ? { referenceLine: 0, referenceLabel: 'Normal' } : {})}
                  />
                ) : (
                  <div className="callout">No hay meses para mostrar.</div>
                )}
                <HowTo>
                  {showAnomaly
                    ? 'cada mes se compara con el mismo mes de un año normal, así que la estación no confunde: sobre la raya, más de lo normal.'
                    : 'cada punto es un mes; la forma de ola es la estación del año.'}
                </HowTo>
              </Panel>
            </div>
          ) : null}
        </div>
      </div>

      <ExtremesBlock bundle={bundle} shown={shown} years={chosenYears} />
      <EnsoBlock
        bundle={bundle}
        shown={shown}
        years={chosenYears}
        phase={phase}
        setPhase={setPhase}
      />
      <AirBlock bundle={bundle} shown={shown} picked={depts.size > 0} years={chosenYears} />
      <FireBlock bundle={bundle} shown={shown} years={chosenYears} />
      <SourcesBlock bundle={bundle} focus={focus} years={chosenYears} />

      <header className="page-intro clima-block-head">
        <h3 className="page-intro-title">Indicadores ambientales nacionales</h3>
        <p className="page-intro-lede">
          Bosque, emisiones, aire y agua del país entero según el Banco Mundial, con la misma
          definición para Bolivia y sus vecinos. Estas series no se separan por departamento.
        </p>
      </header>
      <EnvironmentSection embedded />
    </div>
  );
}

/* ───────────────────────── extremos ───────────────────────── */

type Shown = ReadonlyArray<{ code: string; name: string; city: string }>;

/** Los años que eligió el lector (`null`: sin elegir), recortados a lo que cubre cada fuente. */
type Years = readonly [number | null, number | null];
const within = (years: Years, first: number, last: number): [number, number] => {
  const from = clamp(years[0] ?? first, first, last);
  return [from, clamp(years[1] ?? last, from, last)];
};

function decadeCells(
  bundle: ClimateBundle,
  key: string,
  shown: Shown,
  from: number,
  to: number,
): { columns: string[]; cells: HeatCell[] } {
  const variable = variableOf(key);
  const measure = variable.measures.find((one) => one.source === 'era5') as Measure;
  const startDecade =
    Math.floor(Math.max(Number(bundle.capitales.inicio.slice(0, 4)), from) / 10) * 10;
  const columns: string[] = [];
  const cells: HeatCell[] = [];
  for (let decade = startDecade; decade <= to; decade += 10) {
    const end = Math.min(decade + 9, to);
    const column = `${Math.max(decade, from)}–${String(end).slice(2)}`;
    columns.push(column);
    for (const dept of shown) {
      const years = yearly(bundle, variable, measure, dept.code, SEASONS[0] as Season);
      const values: number[] = [];
      for (let year = Math.max(decade, from); year <= end; year += 1) {
        const value = years.get(year);
        if (value !== undefined) values.push(value);
      }
      if (values.length) {
        cells.push({
          row: dept.name,
          column,
          value: values.reduce((a, b) => a + b, 0) / values.length,
          hint: 'días por año',
        });
      }
    }
  }
  return { columns, cells };
}

function ExtremesBlock({
  bundle,
  shown,
  years,
}: {
  bundle: ClimateBundle;
  shown: Shown;
  years: Years;
}) {
  const lastFull =
    Number(bundle.capitales.fin.slice(0, 4)) - (bundle.capitales.fin.endsWith('-12') ? 0 : 1);
  const [from, end] = within(years, Number(bundle.capitales.inicio.slice(0, 4)), lastFull);
  const to = end;
  const hot = decadeCells(bundle, 'd30', shown, from, end);
  const frost = decadeCells(bundle, 'fr', shown, from, end);
  const credit = bundle.capitales.fuente.nombre;
  const updated = sayDay(bundle.capitales.consultado);

  /* La entradilla dice los extremos de la última década, calculados. */
  const lastDecade = (grid: { columns: string[]; cells: HeatCell[] }, what: string): string => {
    const column = grid.columns.at(-1);
    const cells = grid.cells
      .filter((cell) => cell.column === column)
      .sort((left, right) => right.value - left.value);
    const most = cells[0];
    const least = cells.at(-1);
    if (!most || !least || most === least) return '';
    return `En ${column}, ${most.row} promedió ${formatNumber(most.value, 0)} ${what} al año y ${least.row}, ${formatNumber(least.value, 0)}.`;
  };

  /* El aguacero más grande de cada departamento, con su mes. */
  const rx = variableOf('rx').measures[0] as Measure;
  const records: ShareSlice[] = shown.flatMap((dept) => {
    const series = monthSeries(bundle, rx, dept.code);
    if (!series) return [];
    let best: { value: number; year: number; month: number } | null = null;
    series.values.forEach((value, index) => {
      if (value === null) return;
      const total = series.start.month - 1 + index;
      const year = series.start.year + Math.floor(total / 12);
      if (year < from || year > to) return;
      if (!best || value > best.value) best = { value, year, month: (total % 12) + 1 };
    });
    const found = best as { value: number; year: number; month: number } | null;
    return found
      ? [
          {
            name: `${dept.city} (${monthLabel(found.year, found.month)})`,
            value: found.value,
            note: `Lluvia del día más lluvioso entre ${from} y ${to}.`,
          },
        ]
      : [];
  });

  return (
    <>
      <header className="page-intro clima-block-head">
        <h3 className="page-intro-title">Calor, heladas y aguaceros</h3>
        <p className="page-intro-lede">
          Los días extremos en cada capital, por década, según el reanálisis ERA5. Siguen la
          elección de departamentos y de años del carril.
        </p>
      </header>
      <div className="grid-pair">
        <Panel
          id="clima-calor-decadas"
          title="Días con máxima de más de 30 °C, promedio por año en cada década (días)"
          lede={`Cuántos días al año pasa el termómetro de 30 °C en cada capital. ${lastDecade(hot, 'días así')}`}
          source={credit}
          updated={updated}
        >
          <HeatGrid
            rows={shown.map((dept) => dept.name)}
            columns={hot.columns}
            cells={hot.cells}
            unit="días por año"
          />
          <HowTo>
            más oscuro, más días de calor. Leer cada fila de izquierda a derecha muestra si el calor
            se volvió más frecuente.
          </HowTo>
        </Panel>
        <Panel
          id="clima-heladas-decadas"
          title="Noches de helada (bajo 0 °C), promedio por año en cada década (días)"
          lede={`Cuántas noches al año la temperatura baja de cero en cada capital. ${lastDecade(frost, 'noches de helada')}`}
          source={credit}
          updated={updated}
        >
          <HeatGrid
            rows={shown.map((dept) => dept.name)}
            columns={frost.columns}
            cells={frost.cells}
            unit="días por año"
          />
          <HowTo>
            más oscuro, más heladas. Si una fila se aclara hacia la derecha, hiela menos que antes.
          </HowTo>
        </Panel>
      </div>
      <Panel
        id="clima-aguaceros"
        title={`El día más lluvioso de cada capital, ${from}–${to} (mm en un día)`}
        lede="El mayor aguacero registrado en un solo día y el mes en que cayó. Es la medida que importa para inundaciones y riadas."
        source={credit}
        updated={updated}
      >
        {records.length ? <ShareBars data={records} unit="mm" decimals={0} /> : null}
        <HowTo>
          cada barra es el récord de lluvia de un día; entre paréntesis, cuándo ocurrió.
        </HowTo>
      </Panel>
    </>
  );
}

/* ───────────────────────── El Niño ───────────────────────── */

function EnsoBlock({
  bundle,
  shown,
  years,
  phase,
  setPhase,
}: {
  bundle: ClimateBundle;
  shown: Shown;
  years: Years;
  phase: 'nino' | 'nina';
  setPhase: (phase: 'nino' | 'nina') => void;
}) {
  const oni = oniSeries(bundle);
  const end = lastMonthOf(oni);
  const [start] = within(years, oni.start.year, end.year);
  const oniData: DatedLinePoint[] = [];
  for (let year = start; year <= end.year; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      if (year === end.year && month > end.month) break;
      oniData.push({
        date: `${year}-${String(month).padStart(2, '0')}-01`,
        oni: valueAt(oni, year, month),
      });
    }
  }
  const lastValue = valueAt(oni, end.year, end.month);
  const state =
    lastValue === null
      ? ''
      : lastValue >= 0.5
        ? 'El Niño'
        : lastValue <= -0.5
          ? 'La Niña'
          : 'neutral';

  /* Lluvia de dic-mar según la fase, en cada capital, frente a 1991-2020. */
  const rain = variableOf('p');
  const rainEra5 = rain.measures[0] as Measure;
  const wet = seasonOf('lluvias');
  let count = 0;
  const rows: DivergingRow[] = shown.flatMap((dept) => {
    const years = yearly(bundle, rain, rainEra5, dept.code, wet);
    const normal = normalOf(years, [1991, 2020]);
    if (normal === null) return [];
    const anomalies: number[] = [];
    for (const [year, value] of years) {
      if (ensoPhase(bundle, year) !== phase) continue;
      const pct = anomalyOf(value, normal, 'pct');
      if (pct !== null) anomalies.push(pct);
    }
    count = Math.max(count, anomalies.length);
    if (!anomalies.length) return [];
    const mean = anomalies.reduce((a, b) => a + b, 0) / anomalies.length;
    return [
      { name: dept.name, value: Number(mean.toFixed(1)), meta: `${anomalies.length} épocas` },
    ];
  });
  const phaseName = phase === 'nino' ? 'El Niño' : 'La Niña';
  const oniCredit = bundle.oni.fuente.nombre;

  return (
    <>
      <header className="page-intro clima-block-head">
        <h3 className="page-intro-title">El Niño y La Niña</h3>
        <p className="page-intro-lede">
          El calentamiento o enfriamiento del océano Pacífico cambia la lluvia en Bolivia. Este es
          el índice de la NOAA (el mismo de «Variables exógenas») y lo que pasó con la lluvia en
          cada fase desde 1951.
        </p>
      </header>
      <div className="grid-pair">
        <Panel
          id="clima-oni"
          title={`Índice Oceánico El Niño (ONI), mensual, ${start}–${end.year} (anomalía en °C)`}
          lede={`${lastValue === null ? '' : `Último dato, ${monthLabel(end.year, end.month)}: ${signed(lastValue, 2)} °C (${state}). `}Desde +0,5 °C se considera El Niño; desde −0,5 °C, La Niña.`}
          source={oniCredit}
          updated={sayDay(bundle.oni.consultado)}
        >
          <DatedLines
            data={oniData}
            series={[{ key: 'oni', label: 'Índice ONI', tone: seriesTone(0) }]}
            unit="°C"
            decimals={1}
            monthly
            yearTicks
            referenceLine={0}
          />
          <HowTo>
            sobre cero, el Pacífico está más caliente de lo normal (El Niño si pasa de +0,5); bajo
            cero, más frío (La Niña).
          </HowTo>
        </Panel>
        <Panel
          id="clima-nino-lluvia"
          title={`Lluvia de diciembre a marzo en años de ${phaseName}, frente a lo normal 1991–2020 (%)`}
          lede={`Promedio de hasta ${count} épocas de lluvias con ${phaseName} desde 1951, en cada capital (ERA5). La fase se fija con el ONI de diciembre a febrero.`}
          source={`${bundle.capitales.fuente.nombre}; ${oniCredit}`}
          updated={sayDay(bundle.capitales.consultado)}
        >
          <div className="chips" role="group" aria-label="Fase del Pacífico">
            {(['nino', 'nina'] as const).map((one) => (
              <button
                key={one}
                type="button"
                className={one === phase ? 'chip chip-on' : 'chip'}
                aria-pressed={one === phase}
                onClick={() => setPhase(one)}
              >
                {one === 'nino' ? 'El Niño' : 'La Niña'}
              </button>
            ))}
          </div>
          {rows.length ? <DivergingBars data={rows} unit="%" signed /> : null}
          <HowTo>
            barra a la derecha, en esos años llovió más de lo normal; a la izquierda, menos. Es un
            promedio: no todos los Niños son iguales.
          </HowTo>
        </Panel>
      </div>
    </>
  );
}

/* ───────────────────────── aire ───────────────────────── */

function AirBlock({
  bundle,
  shown,
  picked,
  years,
}: {
  bundle: ClimateBundle;
  shown: Shown;
  /** Si el lector eligió departamentos; si no, se dibujan las seis ciudades con peor aire. */
  picked: boolean;
  years: Years;
}) {
  const air = bundle.aire;
  const pm25 = variableOf('pm25').measures[0] as Measure;
  const days = variableOf('d15');
  const daysMeasure = days.measures[0] as Measure;
  const meanOf = (code: string): number => {
    const values = (monthSeries(bundle, pm25, code)?.values ?? []).filter(
      (value): value is number => value !== null,
    );
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  };
  const lined = picked
    ? shown.slice(0, MAX_LINES)
    : [...shown].sort((left, right) => meanOf(right.code) - meanOf(left.code)).slice(0, MAX_LINES);
  const series = lined.map((dept) => ({ dept, series: monthSeries(bundle, pm25, dept.code) }));
  const data: DatedLinePoint[] = [];
  const first = series[0]?.series;
  if (first) {
    const end = lastMonthOf(first);
    for (let year = first.start.year; year <= end.year; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        if (year === first.start.year && month < first.start.month) continue;
        if (year === end.year && month > end.month) break;
        const point: DatedLinePoint = { date: `${year}-${String(month).padStart(2, '0')}-01` };
        for (const one of series)
          point[one.dept.code] = one.series ? valueAt(one.series, year, month) : null;
        data.push(point);
      }
    }
  }
  let worst: { city: string; value: number; year: number; month: number } | null = null;
  for (const dept of shown) {
    const one = monthSeries(bundle, pm25, dept.code);
    if (!one) continue;
    one.values.forEach((value, index) => {
      if (value === null) return;
      const total = one.start.month - 1 + index;
      if (!worst || value > worst.value) {
        worst = {
          city: dept.city,
          value,
          year: one.start.year + Math.floor(total / 12),
          month: (total % 12) + 1,
        };
      }
    });
  }
  const peak = worst as { city: string; value: number; year: number; month: number } | null;

  const fullYears = [...yearly(bundle, days, daysMeasure, 'LA_PAZ', SEASONS[0] as Season).keys()];
  const barYear =
    fullYears.filter((year) => year <= (years[1] ?? Infinity)).at(-1) ?? fullYears.at(-1) ?? null;
  const bars: ShareSlice[] =
    barYear === null
      ? []
      : shown.flatMap((dept) => {
          const value = yearly(bundle, days, daysMeasure, dept.code, SEASONS[0] as Season).get(
            barYear,
          );
          return value === undefined ? [] : [{ name: dept.city, value }];
        });
  const credit = air.fuente.nombre;
  const updated = sayDay(air.consultado);

  return (
    <>
      <header className="page-intro clima-block-head">
        <h3 className="page-intro-title">Aire de las capitales</h3>
        <p className="page-intro-lede">
          Partículas finas (PM2,5) estimadas por el modelo atmosférico CAMS de Copernicus desde
          septiembre de 2022. Es un modelo de unos 45 km, no una estación de medición: sirve para
          ver el humo de los chaqueos y comparar ciudades, no para el aire de una calle.
        </p>
      </header>
      <div className="grid-pair">
        <Panel
          id="clima-aire-mensual"
          title="Partículas finas (PM2,5), promedio mensual por capital (µg/m³)"
          lede={
            peak
              ? `El peor mes fue ${monthLabel(peak.year, peak.month)} en ${peak.city}: ${formatNumber(peak.value, 1)} µg/m³, ${formatNumber(peak.value / 5, 0)} veces la guía anual de la Organización Mundial de la Salud (OMS).`
              : 'Promedio mensual de partículas finas.'
          }
          source={credit}
          updated={updated}
        >
          {data.length ? (
            <DatedLines
              data={data}
              series={series.map((one, index) => ({
                key: one.dept.code,
                label: one.dept.city,
                tone: seriesTone(index),
              }))}
              unit="µg/m³"
              decimals={1}
              monthly
              yearTicks
              referenceLine={5}
              referenceLabel="Guía anual de la OMS"
            />
          ) : null}
          <HowTo>
            los picos de agosto a noviembre son el humo de las quemas; la raya marca 5 µg/m³, el
            máximo anual que recomienda la OMS.
          </HowTo>
        </Panel>
        <Panel
          id="clima-aire-dias"
          title={`Días con partículas finas sobre la guía diaria de la OMS, ${barYear ?? ''} (días)`}
          lede="Días del año en que el promedio de PM2,5 superó 15 µg/m³, el límite diario que recomienda la OMS."
          source={credit}
          updated={updated}
        >
          {bars.length ? <ShareBars data={bars} unit="días" decimals={0} /> : null}
          <HowTo>cada barra cuenta los días de aire malo de una ciudad en ese año completo.</HowTo>
        </Panel>
      </div>
    </>
  );
}

/* ───────────────────────── fuego y bosque ───────────────────────── */

const CAUSES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'agricultura', label: 'Agricultura y ganadería' },
  { key: 'incendio', label: 'Incendios' },
  { key: 'natural', label: 'Otras perturbaciones naturales' },
  { key: 'rotativa', label: 'Agricultura itinerante' },
  { key: 'tala', label: 'Tala' },
  { key: 'mineria', label: 'Minería e hidrocarburos' },
  { key: 'asentamientos', label: 'Asentamientos e infraestructura' },
  { key: 'desconocido', label: 'Sin causa asignada' },
];

function FireBlock({
  bundle,
  shown,
  years,
}: {
  bundle: ClimateBundle;
  shown: Shown;
  years: Years;
}) {
  const fires = bundle.fuegoBosque.focos;
  const forest = bundle.fuegoBosque.bosque;
  const firstFire = Number(fires.inicio.slice(0, 4));
  const lastFire = Number(fires.fin.slice(0, 4));
  const [a, b] = within(years, firstFire, lastFire);

  const perYear = (code: string, year: number): number =>
    (fires.series[code] ?? [])
      .slice((year - firstFire) * 12, (year - firstFire + 1) * 12)
      .reduce((x, y) => x + y, 0);

  const ordered = [...shown].sort((left, right) => {
    const total = (code: string) => {
      let sum = 0;
      for (let year = a; year <= b; year += 1) sum += perYear(code, year);
      return sum;
    };
    return total(right.code) - total(left.code);
  });
  const fireParts: StackPart[] = ordered.map((dept) => ({ key: dept.code, label: dept.name }));
  const fireRows: YearStackRow[] = [];
  for (let year = a; year <= b; year += 1) {
    const row: YearStackRow = { year: String(year) };
    for (const dept of ordered) row[dept.code] = perYear(dept.code, year);
    fireRows.push(row);
  }

  const monthCells: HeatCell[] = [];
  for (const dept of shown) {
    for (let month = 1; month <= 12; month += 1) {
      let sum = 0;
      for (let year = a; year <= b; year += 1) {
        sum += fires.series[dept.code]?.[(year - firstFire) * 12 + month - 1] ?? 0;
      }
      monthCells.push({
        row: dept.name,
        column: MONTH_SHORT[month - 1] ?? '',
        value: sum / (b - a + 1),
        hint: 'focos por mes, en promedio',
      });
    }
  }

  /* 2026 hasta la última semana, frente a las mismas semanas de 2025. */
  const weekly = bundle.fuegoBosque.focos2026;
  const cumulative = (year: '2025' | '2026'): number[] => {
    let running = 0;
    return Array.from({ length: year === '2026' ? weekly.ultimaSemana : 52 }, (_, index) => {
      running += shown.reduce(
        (sum, dept) => sum + (weekly.semanas[year]?.[dept.code]?.[index] ?? 0),
        0,
      );
      return running;
    });
  };
  const y2025 = cumulative('2025');
  const y2026 = cumulative('2026');
  const weekData: WorldLinePoint[] = y2025.map((value, index) => ({
    year: `sem ${index + 1}`,
    s2025: value,
    s2026: y2026[index] ?? null,
  }));

  /* La pérdida de bosque por causa, en los departamentos elegidos. */
  const firstForest = forest.anios[0] ?? 2001;
  const lastForest = forest.anios.at(-1) ?? 2025;
  const [fa, fb] = within(years, firstForest, lastForest);
  const causeTotals = CAUSES.map((cause) => {
    let total = 0;
    for (const dept of shown) {
      const list = forest.causas[dept.code]?.[cause.key] ?? [];
      for (let year = fa; year <= fb; year += 1) total += list[year - firstForest] ?? 0;
    }
    return { ...cause, total };
  })
    .filter((cause) => cause.total > 0)
    .sort((left, right) => right.total - left.total);
  const causeRows: YearStackRow[] = [];
  for (let year = fa; year <= fb; year += 1) {
    const row: YearStackRow = { year: String(year) };
    for (const cause of causeTotals) {
      row[cause.key] = shown.reduce(
        (sum, dept) => sum + (forest.causas[dept.code]?.[cause.key]?.[year - firstForest] ?? 0),
        0,
      );
    }
    causeRows.push(row);
  }
  const lostAll = causeTotals.reduce((sum, cause) => sum + cause.total, 0);

  /* La parte de la cobertura de 2000 que se perdió, por departamento. */
  const small = shown.filter((dept) => (forest.cobertura2000[dept.code] ?? 0) < 10_000);
  const shares: ShareSlice[] = shown
    .filter((dept) => (forest.cobertura2000[dept.code] ?? 0) >= 10_000)
    .map((dept) => {
      const cover = forest.cobertura2000[dept.code] ?? 0;
      let lost = 0;
      for (let year = fa; year <= fb; year += 1)
        lost += forest.perdida[dept.code]?.[year - firstForest] ?? 0;
      return {
        name: dept.name,
        value: cover ? (lost / cover) * 100 : 0,
        parts: [
          { name: 'Perdido', value: lost, unit: 'ha' },
          { name: 'Cobertura en 2000', value: cover, unit: 'ha' },
        ],
      };
    });

  const fireCredit = fires.fuente.nombre;
  const forestCredit = forest.fuente.nombre;
  const updated = sayDay(bundle.fuegoBosque.consultado);

  return (
    <>
      <header className="page-intro clima-block-head">
        <h3 className="page-intro-title">Fuego y bosque</h3>
        <p className="page-intro-lede">
          Focos de calor detectados por satélite (NASA FIRMS, 2001–{lastFire}; 2026 provisional de
          Global Forest Watch) y pérdida de cobertura arbórea por departamento (Global Forest Watch,
          Universidad de Maryland, {firstForest}–{lastForest}).
        </p>
      </header>
      <div className="grid-pair">
        <Panel
          id="clima-focos-anual"
          title={`Focos de calor por año y departamento, ${a}–${b} (focos)`}
          lede={`Detecciones de fuego en vegetación de los satélites MODIS. Los tres años con más focos en los departamentos elegidos: ${[
            ...fireRows,
          ]
            .map((row) => ({
              year: row.year,
              total: ordered.reduce((sum, dept) => sum + Number(row[dept.code] ?? 0), 0),
            }))
            .sort((left, right) => right.total - left.total)
            .slice(0, 3)
            .map((one) => `${one.year} (${formatNumber(one.total, 0)})`)
            .join(', ')}.`}
          source={fireCredit}
          updated={updated}
        >
          <YearStackBars data={fireRows} parts={fireParts} unit="focos" />
          <HowTo>
            cada columna es un año; los colores muestran en qué departamento estuvieron los focos.
          </HowTo>
        </Panel>
        <Panel
          id="clima-focos-meses"
          title={`Focos de calor por mes del año, promedio ${a}–${b} (focos por mes)`}
          lede="La temporada de quemas: cuándo se concentran los focos en cada departamento."
          source={fireCredit}
          updated={updated}
        >
          <HeatGrid
            rows={shown.map((dept) => dept.name)}
            columns={MONTH_SHORT}
            cells={monthCells}
            unit="focos por mes"
          />
          <HowTo>
            más oscuro, más focos en ese mes. La quema se concentra entre julio y octubre.
          </HowTo>
        </Panel>
      </div>
      <div className="grid-pair">
        <Panel
          id="clima-focos-2026"
          title={`Focos de calor acumulados en el año, 2026 frente a 2025 (focos)`}
          lede={`Hasta la semana ${weekly.ultimaSemana} de 2026: ${formatNumber(y2026.at(-1) ?? 0, 0)} focos en los departamentos elegidos, frente a ${formatNumber(y2025[weekly.ultimaSemana - 1] ?? 0, 0)} en las mismas semanas de 2025. Cifra provisional.`}
          source={weekly.fuente.nombre}
          updated={updated}
        >
          <WorldLines
            data={weekData}
            series={[
              { key: 's2025', label: '2025', tone: 'var(--series-rest)', dashed: true },
              { key: 's2026', label: '2026 (provisional)', tone: seriesTone(0), emphasis: true },
            ]}
            format={(value) => `${formatNumber(value, 0)} focos`}
            tick={(value) => formatNumber(value, 0)}
            countsOnly
          />
          <HowTo>
            si la línea de 2026 va por encima de la de 2025, este año se quema más que el anterior a
            la misma altura del año.
          </HowTo>
        </Panel>
        <Panel
          id="clima-bosque-porcentaje"
          title={`Cobertura arbórea perdida entre ${fa} y ${fb}, por departamento (% de la de 2000)`}
          lede={`Hectáreas con copa de árboles (de al menos 30 %) que se perdieron, sobre las que había en 2000.${small.length ? ` ${small.map((dept) => dept.name).join(' y ')} casi no tienen bosque y no se muestran.` : ''}`}
          source={forestCredit}
          updated={updated}
        >
          {shares.length ? <ShareBars data={shares} unit="%" decimals={1} /> : null}
          <HowTo>
            una barra larga quiere decir que el departamento perdió buena parte de los árboles que
            tenía. Parte de lo perdido puede volver a crecer.
          </HowTo>
        </Panel>
      </div>
      <Panel
        id="clima-bosque-causas"
        title={`Pérdida de cobertura arbórea por causa, ${fa}–${fb} (hectáreas)`}
        lede={`${lostAll >= 1e6 ? `${formatNumber(lostAll / 1e6, 1)} millones de` : `${formatNumber(lostAll / 1000, 0)} mil`} hectáreas en ${shown.length === 9 ? 'todo el país' : 'los departamentos elegidos'}. La causa es la que asignan WRI y Google a cada zona con imágenes de satélite, no un registro oficial.`}
        source={forestCredit}
        updated={updated}
      >
        <YearStackBars
          data={causeRows}
          parts={causeTotals.map((cause) => ({ key: cause.key, label: cause.label }))}
          unit="ha"
        />
        <HowTo>
          cada columna es un año; la altura es todo lo que se perdió y los colores, por qué. La
          agricultura permanente es desmonte; «incendios» es fuego que no dio paso a un cultivo.
        </HowTo>
      </Panel>
    </>
  );
}

/* ───────────────────────── fuentes ───────────────────────── */

function SourcesBlock({
  bundle,
  focus,
  years: chosen,
}: {
  bundle: ClimateBundle;
  focus: string;
  years: Years;
}) {
  const to = chosen[1] ?? Infinity;
  const temp = variableOf('t');
  const era5 = temp.measures.find((one) => one.source === 'era5') as Measure;
  const power = temp.measures.find((one) => one.source === 'power') as Measure;
  const year = SEASONS[0] as Season;
  const a = yearly(bundle, temp, era5, focus, year);
  const b = yearly(bundle, temp, power, focus, year);
  const cell: MonthSeries = {
    start: {
      year: Number(bundle.departamentos.inicio.slice(0, 4)),
      month: Number(bundle.departamentos.inicio.slice(5, 7)),
    },
    values: bundle.departamentos.capitalT[focus] ?? [],
  };
  const c = new Map<number, number>();
  for (let y = cell.start.year; y <= lastMonthOf(cell).year; y += 1) {
    const value = seasonValue(cell, year, y, 'mean');
    if (value !== null) c.set(y, value);
  }
  const years = [...new Set([...b.keys()])].filter((y) => y <= to).sort((x, y) => x - y);
  const data: WorldLinePoint[] = years.map((y) => ({
    year: String(y),
    era5: a.has(y) ? Number((a.get(y) as number).toFixed(2)) : null,
    cell: c.has(y) ? Number((c.get(y) as number).toFixed(2)) : null,
    dept: b.has(y) ? Number((b.get(y) as number).toFixed(2)) : null,
  }));
  const grid = bundle.capitales.lugares.find((one) => one.code === focus)?.grid;
  return (
    <Panel
      id="clima-fuentes"
      title={`Temperatura media anual en ${deptName(focus)} según la fuente (°C)`}
      lede={`ERA5 mide en la capital, ${cityName(focus)} (celda a ${grid ? formatNumber(grid.elev, 0) : '—'} m de altura); NASA POWER usa celdas de unos 55 km, y su promedio departamental mezcla altiplano, valles y llanos. Los niveles difieren; lo que hay que mirar es si suben y bajan juntas.`}
      source={`${bundle.capitales.fuente.nombre}; ${bundle.departamentos.fuente.nombre}`}
      updated={sayDay(bundle.capitales.consultado)}
    >
      <WorldLines
        data={data}
        series={[
          {
            key: 'era5',
            label: `ERA5, en ${cityName(focus)}`,
            tone: seriesTone(0),
            emphasis: true,
          },
          { key: 'cell', label: `NASA POWER, celda de ${cityName(focus)}`, tone: seriesTone(1) },
          {
            key: 'dept',
            label: `NASA POWER, promedio de ${deptName(focus)}`,
            tone: seriesTone(2),
            dashed: true,
          },
        ]}
        format={(value) => `${formatNumber(value, 1)} °C`}
        tick={(value) => formatNumber(value, 0)}
      />
      <HowTo>
        tres maneras de medir la misma temperatura. Si las tres líneas suben, el calentamiento no
        depende de la fuente.
      </HowTo>
    </Panel>
  );
}
