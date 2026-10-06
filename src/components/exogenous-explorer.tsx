'use client';

import { useMemo, useState } from 'react';
import { ANY, additive, picked, toggle as toggleChoice, without } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import {
  GROUPS,
  MISSING,
  PRODUCT_ORDER,
  SCOPES,
  UNSOURCED,
  measureUnit,
  measured,
  sayPeriod,
  yearOf,
} from '@/lib/exogenous-board';
import type {
  ExogenousBoard,
  ExogenousGroup,
  ExogenousSeries,
  Measure,
} from '@/lib/exogenous-board';
import { DatedLines, WorldLines, seriesTone } from './charts';
import type { DatedLinePoint, WorldLinePoint } from './charts';
import { ExogenousTable, sourcesOf } from './exogenous-table';
import { FreightReferences } from './freight-references';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import type { IconName } from './icons';
import { Panel } from '@/components/ui/panel';
import { hrefDe } from '@/lib/enlace-tablero';

/**
 * Los precios que Bolivia no fija, con filtros que se cruzan.
 *
 * Cinco preguntas en el riel y cada una recorta a las demás: la familia
 * decide qué productos hay; el producto, qué ámbitos existen para él; el
 * ámbito, qué ciudades; y lo que queda es la lista de lecturas, de la que el
 * lector marca las que quiere ver. Nada está fijado de antemano salvo el
 * punto de partida —el primer producto de la familia—, que es sólo eso.
 *
 * Se dibuja un gráfico por unidad y no uno para todo. Un barril de crudo y un
 * galón de diésel en el mismo eje hacen del segundo una línea plana en el
 * suelo; para compararlos está la medida «índice», que los pone a todos en
 * base 100 en el primer mes visible, o la variación interanual. La página fija
 * de fletes abre en el producto y el ámbito bolivianos documentados.
 *
 * Se dibujan todas las lecturas elegidas: más de seis líneas en un eje no se
 * distinguen, así que el grupo se parte en gráficos de seis (uno debajo del
 * otro) en vez de esconder la séptima. Los fletes no van aquí: tienen su página
 * en Transporte y repetirlos era mostrar dos veces las mismas series.
 */

const SCOPE_LABEL = new Map<string, string>(SCOPES.map((one) => [one.key, one.label]));

const GROUP_ICON: Record<ExogenousGroup, IconName> = {
  ENERGY: 'rayo',
  MINERALS: 'gema',
  AGRICULTURE: 'espiga',
  LIVESTOCK: 'tienda',
  INDUSTRY: 'fabrica',
  CONSTRUCTION: 'edificio',
  FREIGHT: 'camion',
};

const MEASURES: ReadonlyArray<{ key: Measure; label: string; hint: string }> = [
  { key: 'LEVEL', label: 'Nivel', hint: 'La cifra publicada, en su unidad.' },
  { key: 'INDEX', label: 'Índice', hint: 'Base 100 en el primer dato visible de cada serie.' },
  { key: 'YOY', label: 'Var. anual', hint: 'Cambio contra el mismo mes de un año antes, en %.' },
];

/** Seis colores distinguibles; más líneas en un gráfico ya no se leen. */
const MOST_DRAWN = 6;

/**
 * Las lecturas de un grupo en tandas de seis: cada tanda es un gráfico. Un
 * grupo de ocho son dos gráficos de cuatro y no uno de seis y otro de dos, para
 * que las tandas se parezcan y ninguna quede casi vacía.
 */
function batches<T>(items: readonly T[]): T[][] {
  const count = Math.ceil(items.length / MOST_DRAWN);
  if (count <= 1) return [[...items]];
  const size = Math.ceil(items.length / count);
  return Array.from({ length: count }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  ).filter((batch) => batch.length > 0);
}

const number = (value: number, decimals = 2): string =>
  new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);

/** Un texto como parte de un identificador: «US$/barril» → «us-barril». */
const slug = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const decimalsFor = (values: readonly number[]): number => {
  const top = Math.max(...values.map((value) => Math.abs(value)), 0);
  return top >= 1000 ? 0 : top >= 10 ? 1 : top >= 1 ? 2 : 3;
};

export function ExogenousExplorer({
  board,
  fixedGroup,
}: {
  board: ExogenousBoard;
  fixedGroup?: ExogenousGroup;
}) {
  /* Los fletes tienen su página (Transporte › Fletes); aquí sólo los precios. */
  const all = useMemo(
    () => (fixedGroup ? board.series : board.series.filter((one) => one.group !== 'FREIGHT')),
    [board, fixedGroup],
  );
  const groups = GROUPS.filter((one) => fixedGroup || one.key !== 'FREIGHT');
  const [group, setGroup] = useState<ExogenousGroup>(fixedGroup ?? 'ENERGY');
  const [product, setProduct] = useState<Choice>(ANY);
  const [scope, setScope] = useState<Choice>(ANY);
  const [market, setMarket] = useState<Choice>(ANY);
  const [hidden, setHidden] = useState<Choice>(ANY);
  const [measure, setMeasure] = useState<Measure>('LEVEL');
  const bounds = useMemo(() => {
    const years = all.flatMap((one) => one.points.map(([period]) => yearOf(period)));
    return { min: Math.min(...years, 2000), max: Math.max(...years, 2000) };
  }, [all]);
  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);

  const inGroup = useMemo(() => all.filter((one) => one.group === group), [all, group]);
  const products = useMemo(() => {
    const seen = new Map<string, { label: string; count: number }>();
    for (const one of inGroup) {
      const entry = seen.get(one.product) ?? { label: one.productLabel, count: 0 };
      entry.count += 1;
      seen.set(one.product, entry);
    }
    const rank = (code: string) => {
      const at = PRODUCT_ORDER.indexOf(code);
      return at === -1 ? PRODUCT_ORDER.length : at;
    };
    return [...seen]
      .map(([value, entry]) => ({ value, ...entry }))
      .sort((left, right) => rank(left.value) - rank(right.value));
  }, [inGroup]);

  /* Sin producto elegido, el primero de la familia: un gráfico con treinta
     líneas no responde nada, y el lector cambia de producto con un clic. */
  // prettier-ignore
  const preferredProduct = fixedGroup === 'FREIGHT' && products.some((one) => one.value === 'FREIGHT_BO')
    ? 'FREIGHT_BO'
    : products[0]?.value;
  const productChoice: Choice =
    product.size || !preferredProduct ? product : new Set([preferredProduct]);
  const ofProduct = inGroup.filter((one) => picked(productChoice, one.product));

  const scopes = SCOPES.map((option) => ({
    ...option,
    count: ofProduct.filter((one) => one.scope === option.key).length,
  })).filter((option) => option.count > 0);
  // prettier-ignore
  const preferredScope = fixedGroup === 'FREIGHT' && ofProduct.some((one) => one.scope === 'BOLIVIA_CUSTOMS')
    ? 'BOLIVIA_CUSTOMS'
    : undefined;
  const scopeChoice: Choice = scope.size || !preferredScope ? scope : new Set([preferredScope]);
  const ofScope = ofProduct.filter((one) => scopeChoice.size === 0 || scopeChoice.has(one.scope));

  const freightFrom = Math.min(
    ...ofScope.flatMap((one) => one.points.map(([period]) => yearOf(period))),
    bounds.max,
  );
  const from =
    yearFrom ?? (fixedGroup === 'FREIGHT' ? freightFrom : Math.max(bounds.min, bounds.max - 10));
  const to = yearTo ?? bounds.max;

  const markets = [
    ...new Set(ofScope.filter((one) => one.scope === 'BOLIVIA_MARKET').map((one) => one.market)),
  ];
  const listed = ofScope
    .filter((one) => one.scope !== 'BOLIVIA_MARKET' || market.size === 0 || market.has(one.market))
    .sort(
      (left, right) =>
        Number(right.code === 'EXO_BO_FREIGHT_IMPLIED_TOTAL') -
        Number(left.code === 'EXO_BO_FREIGHT_IMPLIED_TOTAL'),
    );
  const shown = listed.filter((one) => !hidden.has(one.code));

  const monthly = shown.filter((one) => one.frequency === 'MONTHLY');
  const annual = shown.filter((one) => one.frequency === 'ANNUAL');

  const pickGroup = (next: ExogenousGroup) => {
    setGroup(next);
    setProduct(ANY);
    setScope(ANY);
    setMarket(ANY);
    setHidden(ANY);
  };

  const active =
    Number(product.size > 0) +
    Number(scope.size > 0) +
    Number(market.size > 0) +
    Number(hidden.size > 0) +
    Number(yearFrom !== null || yearTo !== null) +
    Number(measure !== 'LEVEL');

  const lead = GROUPS.find((one) => one.key === group);

  return (
    <>
      <header className="page-intro">
        <h3 className="page-intro-title">
          {fixedGroup === 'FREIGHT'
            ? 'Fletes: cuánto cuesta mover carga'
            : 'Variables exógenas: los precios que Bolivia no fija'}
        </h3>
        <p className="page-intro-lede">
          {all.length} series; el último mes cerrado es{' '}
          {board.latestMonth ? sayPeriod(board.latestMonth) : '—'}. Elegí una familia, un producto y
          un ámbito en el riel de la izquierda; los filtros se recortan entre sí.
        </p>
        <details className="panel-note">
          <summary>Qué hay en esta página</summary>
          <p>
            {fixedGroup === 'FREIGHT'
              ? 'Series de flete marítimo, aéreo, aduanero y referencias del transporte pesado boliviano. '
              : 'Cotizaciones del mercado mundial y de los vecinos, índices de productor de EE. UU., el '}
            precio en bolivianos en los mercados del país y el precio por kilo que Bolivia pagó y
            cobró en su aduana.
            {fixedGroup ? null : (
              <>
                {' '}
                Lo que cuesta mover la carga está en{' '}
                <a href={hrefDe({ pestana: 'Transporte', pagina: 'Fletes' })}>
                  Transporte › Fletes
                </a>
                .
              </>
            )}
          </p>
        </details>
        {fixedGroup ? null : (
          <div className="chips" role="tablist" aria-label="Familia de productos">
            {groups.map((option) => {
              const on = option.key === group;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={on ? 'chip chip-on' : 'chip'}
                  onClick={() => pickGroup(option.key)}
                >
                  <Icon name={GROUP_ICON[option.key]} size={13} />
                  {option.label}
                  <span className="chip-count">
                    {all.filter((one) => one.group === option.key).length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {lead ? <p className="page-intro-lede">{lead.lead}</p> : null}
      </header>

      <div className="workspace workspace-filters-first">
        <aside className="rail" id="exogenas-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}
            </span>
          </div>
          <FilterHint>Cada filtro recorta los de abajo. Ctrl+clic suma a la selección.</FilterHint>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name={GROUP_ICON[group]} size={13} />
              Producto
              <PickedCount choice={product} />
            </div>
            <div className={products.length > 9 ? 'rail-list rail-list-cut' : 'rail-list'}>
              {products.map((option) => {
                const on = picked(productChoice, option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={on ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={on}
                    onClick={(event) => {
                      setProduct(toggleChoice(productChoice, option.value, additive(event)));
                      setScope(ANY);
                      setMarket(ANY);
                      setHidden(ANY);
                    }}
                  >
                    <Icon name={GROUP_ICON[group]} size={16} />
                    <span className="rail-name">{option.label}</span>
                    <span className="rail-hint">{option.count}</span>
                  </button>
                );
              })}
              {UNSOURCED[group].map((missing) => (
                <div
                  key={missing.label}
                  className="rail-item rail-item-none"
                  aria-disabled="true"
                  title={missing.why}
                >
                  <Icon name={GROUP_ICON[group]} size={16} />
                  <span className="rail-name">{missing.label}</span>
                  <span className="rail-hint">sin fuente disponible</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="globo" size={13} />
              Ámbito
              <PickedCount choice={scope} />
            </div>
            <div className="rail-pills">
              {scopes.map((option) => {
                const on = scopeChoice.has(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={on ? 'chip chip-wide chip-on' : 'chip chip-wide'}
                    aria-pressed={on}
                    title={option.hint}
                    onClick={(event) => {
                      setScope(toggleChoice(scopeChoice, option.key, additive(event)));
                      setHidden(ANY);
                    }}
                  >
                    <span className="chip-text">{option.label}</span>
                    <span className="chip-count">{option.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {markets.length > 1 ? (
            <div className="rail-sec">
              <div className="rail-head">
                <Icon name="mapa" size={13} />
                Ciudad (mercados de Bolivia)
                <PickedCount choice={market} />
              </div>
              <div className="rail-pills">
                {markets.map((value) => {
                  const on = market.has(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      className={on ? 'chip chip-on' : 'chip'}
                      aria-pressed={on}
                      title={value}
                      onClick={(event) =>
                        setMarket((current) => toggleChoice(current, value, additive(event)))
                      }
                    >
                      <span className="chip-text">{value}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="linea" size={13} />
              Lecturas ({shown.length} de {listed.length})
            </div>
            <FilterHint>
              Quitá las que no quieras ver; se dibujan todas, de a seis por gráfico.
            </FilterHint>
            <div className={listed.length > 9 ? 'rail-list rail-list-cut' : 'rail-list'}>
              {listed.map((one) => {
                const on = !hidden.has(one.code);
                return (
                  <button
                    key={one.code}
                    type="button"
                    className={on ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={on}
                    title={`${one.name} · ${one.market} · ${one.unit}`}
                    onClick={() =>
                      setHidden((current) => {
                        if (current.has(one.code)) return without(current, one.code);
                        // La última lectura visible no se quita: un gráfico vacío no dice nada.
                        return shown.length > 1 ? new Set([...current, one.code]) : current;
                      })
                    }
                  >
                    <Icon name={one.frequency === 'ANNUAL' ? 'calendario' : 'linea'} size={16} />
                    <span className="rail-name">{one.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Años: {from}-{to}
            </div>
            <div className="rail-field">
              <input
                type="range"
                aria-label={`Desde qué año se dibujan los gráficos: ${from}`}
                min={bounds.min}
                max={to}
                value={from}
                onChange={(event) => setYearFrom(Math.min(Number(event.target.value), to))}
              />
            </div>
            <div className="rail-field">
              <input
                type="range"
                aria-label={`Hasta qué año se dibujan los gráficos: ${to}`}
                min={from}
                max={bounds.max}
                value={to}
                onChange={(event) => setYearTo(Math.max(Number(event.target.value), from))}
              />
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="sigma" size={13} />
              Medida
            </div>
            <div className="rail-pills">
              {MEASURES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={option.key === measure ? 'chip chip-on' : 'chip'}
                  aria-pressed={option.key === measure}
                  title={option.hint}
                  onClick={() => setMeasure(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {active ? (
            <div className="rail-sec">
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setProduct(ANY);
                  setScope(ANY);
                  setMarket(ANY);
                  setHidden(ANY);
                  setYearFrom(null);
                  setYearTo(null);
                  setMeasure('LEVEL');
                }}
              >
                Limpiar todo
              </button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main stack">
          {shown.length === 0 ? (
            <div className="callout">
              Ninguna lectura coincide con el recorte. Quitá un filtro de la izquierda.
            </div>
          ) : null}
          {group === 'FREIGHT' ? <FreightReferences /> : null}
          <MonthlyCharts series={monthly} measure={measure} from={from} to={to} />
          <AnnualChart series={annual} measure={measure} from={from} to={to} />
          <ExogenousTable series={listed} />
          {UNSOURCED[group].length ? (
            <div className="callout">
              <b>Sin fuente disponible.</b>
              <ul>
                {UNSOURCED[group].map((missing) => (
                  <li key={missing.label}>
                    <b>{missing.label}:</b> {missing.why}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <details className="panel-note">
            <summary>
              Lo que no tiene precio abierto en esta familia, y con qué se lo sustituye
            </summary>
            <ul>
              {MISSING[group].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
          <p className="guest-note">
            <Icon name="info" size={12} /> Fuentes: Banco Mundial (hoja rosa de materias primas),
            FRED del Banco de la Reserva Federal de San Luis (EIA y Oficina de Estadísticas
            Laborales de EE. UU.), FAO/GIEWS (con datos del INE y del Ministerio de Desarrollo
            Productivo de Bolivia), Naciones Unidas (Comtrade), Freightos (contenedor y flete aéreo)
            y la base aduanera del INE (flete implícito). Cada cifra guarda la celda o la fila de la
            que salió.
          </p>
        </div>
      </div>
    </>
  );
}

function MonthlyCharts({
  series,
  measure,
  from,
  to,
}: {
  series: readonly ExogenousSeries[];
  measure: Measure;
  from: number;
  to: number;
}) {
  /*
   * En nivel, un gráfico por unidad: dólares por barril y dólares por galón no
   * comparten eje. En índice o variación todas hablan la misma unidad y van
   * juntas, que es para lo que existen esas dos medidas. Cada grupo de más de
   * seis lecturas se parte en varios gráficos (`batches`): se dibujan todas.
   */
  const panels = new Map<string, { unit: string; scope: string; members: ExogenousSeries[] }>();
  for (const one of series) {
    const unit = measure === 'LEVEL' ? one.unit : measureUnit(measure, one.unit);
    /* En índice o variación todas comparten unidad; se separan por ámbito, para
       que el precio mundial no se mezcle con el de los mercados del país. */
    const key = measure === 'LEVEL' ? unit : `${unit}|${one.scope}`;
    const entry = panels.get(key) ?? { unit, scope: one.scope, members: [] };
    entry.members.push(one);
    panels.set(key, entry);
  }
  return (
    <>
      {[...panels].flatMap(([key, { unit, scope, members }]) => {
        const parts = batches(members);
        return parts.map((drawn, part) => (
          <MonthlyPanel
            key={`${key}|${part}`}
            id={`exogenas-mensual-${slug(key)}${part ? `-${part + 1}` : ''}`}
            unit={unit}
            scope={measure === 'LEVEL' ? null : scope}
            drawn={drawn}
            part={parts.length > 1 ? [part + 1, parts.length] : null}
            measure={measure}
            from={from}
            to={to}
          />
        ));
      })}
    </>
  );
}

function MonthlyPanel({
  id,
  unit,
  scope,
  drawn,
  part,
  measure,
  from,
  to,
}: {
  id: string;
  unit: string;
  scope: string | null;
  drawn: readonly ExogenousSeries[];
  part: [number, number] | null;
  measure: Measure;
  from: number;
  to: number;
}) {
  const rows = new Map<string, DatedLinePoint>();
  for (const one of drawn) {
    for (const [period, value] of measured(one.points, measure, from, to)) {
      const date = `${period}-01`;
      const row = rows.get(date) ?? { date };
      row[one.code] = value;
      rows.set(date, row);
    }
  }
  const data = [...rows.values()].sort((left, right) =>
    String(left.date).localeCompare(String(right.date)),
  );
  const values = data.flatMap((row) =>
    drawn.map((one) => row[one.code]).filter((value): value is number => typeof value === 'number'),
  );
  const where = scope ? `, ${SCOPE_LABEL.get(scope) ?? scope}` : '';
  const title =
    (measure === 'LEVEL'
      ? `${drawn[0]?.productLabel ?? 'Precio'} y afines (${unit}), mensual`
      : measure === 'INDEX'
        ? `Precios mensuales en índice${where} (base 100 = primer dato de cada serie desde ${from})`
        : `Variación interanual de los precios mensuales${where} (%)`) +
    (part ? ` · gráfico ${part[0]} de ${part[1]}` : '');
  const notes = drawn
    .map((one) => one.note)
    .filter((note, index, all) => note && all.indexOf(note) === index);
  return (
    <Panel
      id={id}
      title={title}
      lede={notes[0]}
      meta={part ? `${drawn.length} lecturas` : undefined}
      source={sourcesOf(drawn)}
    >
      {data.length > 1 ? (
        <DatedLines
          data={data}
          series={drawn.map((one, index) => ({
            key: one.code,
            // «Papa, mayorista, La Paz (La Paz)» no: el mercado sólo si el nombre no lo dice.
            label: one.name.includes(one.market) ? one.name : `${one.name} (${one.market})`,
            tone: seriesTone(index),
          }))}
          unit={measureUnit(measure, unit)}
          decimals={decimalsFor(values)}
          monthly
          {...(measure === 'INDEX' ? { referenceLine: 100 } : {})}
          {...(measure === 'YOY' ? { referenceLine: 0 } : {})}
        />
      ) : (
        <p className="rail-hint">No hay suficientes meses en el rango elegido.</p>
      )}
      {notes.length > 1 ? <p className="panel-note">{notes.slice(1, 2).join(' ')}</p> : null}
    </Panel>
  );
}

function AnnualChart({
  series,
  measure,
  from,
  to,
}: {
  series: readonly ExogenousSeries[];
  measure: Measure;
  from: number;
  to: number;
}) {
  if (!series.length) return null;
  const parts = batches(series);
  return (
    <>
      {parts.map((drawn, part) => (
        <AnnualPanel
          key={part}
          drawn={drawn}
          part={parts.length > 1 ? [part + 1, parts.length] : null}
          measure={measure}
          from={from}
          to={to}
        />
      ))}
    </>
  );
}

function AnnualPanel({
  drawn,
  part,
  measure,
  from,
  to,
}: {
  drawn: readonly ExogenousSeries[];
  part: [number, number] | null;
  measure: Measure;
  from: number;
  to: number;
}) {
  const rows = new Map<string, WorldLinePoint>();
  for (const one of drawn) {
    for (const [period, value] of measured(one.points, measure, from, to)) {
      const row = rows.get(period) ?? { year: period };
      row[one.code] = value;
      rows.set(period, row);
    }
  }
  /* Un año sin declaración queda como hueco en el eje: sin él, 2018 y 2021
     aparecen contiguos y la línea inventa una tendencia que nadie declaró. */
  const years = [...rows.keys()].map(Number);
  for (let year = Math.min(...years); year <= Math.max(...years); year += 1) {
    if (!rows.has(String(year))) rows.set(String(year), { year: String(year) });
  }
  const data = [...rows.values()].sort((left, right) => left.year.localeCompare(right.year));
  const values = data.flatMap((row) =>
    drawn.map((one) => row[one.code]).filter((value): value is number => typeof value === 'number'),
  );
  const unit = measureUnit(measure, 'US$/kg');
  const decimals = decimalsFor(values);
  return (
    <Panel
      id={`exogenas-aduana-anual${part && part[0] > 1 ? `-${part[0]}` : ''}`}
      title={`Precio por kilo en la aduana de Bolivia (${unit}${
        measure === 'INDEX' ? `, base 100 = primer dato de cada serie desde ${from}` : ''
      }), anual${part ? ` · gráfico ${part[0]} de ${part[1]}` : ''}`}
      lede="Valor declarado entre peso neto de lo que Bolivia exportó o importó, año por año."
      meta={part ? `${drawn.length} lecturas` : undefined}
      source={sourcesOf(drawn)}
    >
      {data.length > 1 ? (
        <WorldLines
          data={data}
          series={drawn.map((one, index) => ({
            key: one.code,
            label: one.name,
            tone: seriesTone(index),
          }))}
          format={(value) => `${number(value, decimals)} ${unit}`}
          tick={(value) => number(value, decimals)}
        />
      ) : (
        <p className="rail-hint">No hay suficientes años en el rango elegido.</p>
      )}
      <p className="panel-note">
        No es una cotización: incluye flete y la mezcla de calidades que el país compró o vendió.
      </p>
    </Panel>
  );
}
