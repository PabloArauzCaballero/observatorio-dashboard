'use client';

import { ShareBars, WorldLines } from './charts';
import { onOneAxis } from './department-lines';
import type { NamedLine } from './department-lines';
import { useTradeViews } from './trade-records-fetch';
import { say, useLabelRoom } from './trade-records-panels';
import type { TradeView } from '@/lib/trade-records';

/**
 * La ficha de un país en la base aduanera del INE.
 *
 * Contesta lo que el mapa no puede —cuánto fue ese comercio en el tiempo, qué
 * parte del total es, si Bolivia le vende más de lo que le compra— y lo que la
 * ficha de Comtrade confiesa que no sabe: **qué productos van a ese país**. La
 * base del INE cruza partida y país, y las exportaciones además traen el
 * departamento del que sale cada cosa.
 *
 * La ficha cuenta los años elegidos y ningún filtro más que el país: es la
 * respuesta a «¿y este país?», no un tercer ránking con los filtros del
 * carril. Importaciones con país no traen departamento, y lo dice.
 */

const API = '/api/comercio-exterior/aduana';

/** Cuántas barras de producto o departamento caben sin que el rótulo se pierda. */
const SHOWN = 6;

function urlOf(
  flow: 'X' | 'M',
  from: number,
  to: number,
  countries: readonly string[] | null,
  views: string,
): string {
  const params = new URLSearchParams({ flow, from: String(from), to: String(to), views });
  if (countries) params.set('country', countries.join(','));
  return `${API}?${params.toString()}`;
}

interface Standing {
  /** Dólares del último año con ese país. */
  value: number;
  /** Dólares del último año con todos los países. */
  total: number;
  /** Puesto entre los países del flujo, o `null` si no comerció ese año. */
  rank: number | null;
}

/** Cuánto, qué parte y qué puesto, sobre la vista de todos los países sin filtrar. */
function standingOf(view: TradeView | undefined, countries: readonly string[]): Standing | null {
  if (!view || view.unavailable) return null;
  const mine = new Set(countries);
  const isMine = (key: string | null): boolean => key !== null && mine.has(key);
  let value = 0;
  let total = 0;
  for (const item of view.items) {
    const last = item.lastUsd ?? 0;
    total += last;
    if (isMine(item.key)) value += last;
  }
  const rank = value
    ? 1 + view.items.filter((item) => !isMine(item.key) && (item.lastUsd ?? 0) > value).length
    : null;
  return { value, total, rank };
}

const asYears = (view: TradeView | undefined) =>
  (view?.items ?? []).map((item) => ({
    year: Number(item.key),
    value: item.usd / 1_000_000,
  }));

function Bars({
  title,
  view,
  tone,
}: {
  title: string;
  view: TradeView | undefined;
  tone: string;
}) {
  const items = (view?.items ?? []).slice(0, SHOWN);
  // Media columna en escritorio: más de 34 letras ya le quita el sitio a la barra.
  const room = Math.min(useLabelRoom(), 34);
  return (
    <div>
      <h4 style={{ margin: '0 0 0.3rem', fontSize: '0.88rem' }}>{title}</h4>
      {view?.unavailable ? (
        <p className="chart-note">{view.unavailable}</p>
      ) : items.length ? (
        <ShareBars
          data={items.map((item) => ({
            name: item.label.length > room ? `${item.label.slice(0, room - 1)}…` : item.label,
            value: item.usd / 1_000_000,
          }))}
          tone={tone}
          unit=" MM USD"
          height={Math.max(150, items.length * 28)}
        />
      ) : (
        <p className="chart-note">Sin comercio declarado en estos años.</p>
      )}
    </div>
  );
}

export function TradeCountryCard({
  name,
  countries,
  from,
  to,
}: {
  name: string;
  /** Los códigos del INE que pintan este país (casi siempre uno). */
  countries: readonly string[];
  from: number;
  to: number;
}) {
  const sold = useTradeViews(urlOf('X', from, to, countries, 'serie:year,productos:chapter:6,deptos:department:9'));
  const bought = useTradeViews(urlOf('M', from, to, countries, 'serie:year,productos:chapter:6'));
  const exportRank = useTradeViews(urlOf('X', from, to, null, 'pais:country:300'));
  const importRank = useTradeViews(urlOf('M', from, to, null, 'pais:country:300'));

  const loading = sold.loading || bought.loading || exportRank.loading || importRank.loading;
  if (sold.failed && bought.failed) {
    return (
      <div className="country-card">
        <h3>Bolivia y {name}</h3>
        <p className="chart-note">No se pudo leer la ficha de este país. El mapa sigue al día.</p>
      </div>
    );
  }

  const exported = standingOf(exportRank.views?.pais, countries);
  const imported = standingOf(importRank.views?.pais, countries);
  const balance = exported && imported && (exported.value || imported.value)
    ? exported.value - imported.value
    : null;
  const millions = (usd: number): string => `${say(usd / 1_000_000, 1)} MM USD`;

  const lines: NamedLine[] = [
    {
      key: 'X',
      label: 'Bolivia le vende (FOB)',
      values: asYears(sold.views?.serie),
      tone: 'var(--official)',
    },
    {
      key: 'M',
      label: 'Bolivia le compra (CIF frontera)',
      values: asYears(bought.views?.serie),
      tone: 'var(--parallel)',
    },
  ].filter((line) => line.values.some((point) => point.value > 0));
  const axis = onOneAxis(lines);

  return (
    <div className="country-card" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 120ms' }}>
      <h3>
        Bolivia y {name}, {to} (millones de USD)
      </h3>
      <dl className="country-figures">
        <div>
          <dt>Le vende</dt>
          <dd>{exported?.value ? millions(exported.value) : 'sin exportaciones declaradas'}</dd>
          {exported?.value && exported.total ? (
            <dd className="country-aside">
              {say((exported.value / exported.total) * 100, 1)} % de lo exportado · puesto{' '}
              {exported.rank}
            </dd>
          ) : null}
        </div>
        <div>
          <dt>Le compra</dt>
          <dd>{imported?.value ? millions(imported.value) : 'sin importaciones declaradas'}</dd>
          {imported?.value && imported.total ? (
            <dd className="country-aside">
              {say((imported.value / imported.total) * 100, 1)} % de lo importado · puesto{' '}
              {imported.rank}
            </dd>
          ) : null}
        </div>
        <div>
          <dt>Saldo</dt>
          <dd>
            {balance === null
              ? '—'
              : `${balance >= 0 ? '+' : '−'}${say(Math.abs(balance) / 1_000_000, 1)} MM USD`}
          </dd>
          <dd className="country-aside">
            {balance === null
              ? 'Hace falta el dato de los dos flujos'
              : 'Exportación FOB menos importación CIF en frontera'}
          </dd>
        </div>
      </dl>

      {axis.data.length > 1 ? (
        <WorldLines
          data={axis.data}
          series={axis.series}
          format={(value) => `${say(value, 1)} MM USD`}
          tick={(value) => say(value, 0)}
        />
      ) : null}

      <div className="grid-pair">
        <Bars
          title={`Qué le vende Bolivia a ${name} (millones de USD por capítulo, ${from}-${to})`}
          view={sold.views?.productos}
          tone="var(--official)"
        />
        <Bars
          title={`Qué le compra Bolivia a ${name} (millones de USD por capítulo, ${from}-${to})`}
          view={bought.views?.productos}
          tone="var(--parallel)"
        />
      </div>
      <Bars
        title={`De qué departamentos sale lo que Bolivia le vende (millones de USD, ${from}-${to})`}
        view={sold.views?.deptos}
        tone="var(--official)"
      />
      <p className="chart-note">
        La ficha cuenta el país en los años elegidos y sin los demás filtros. Las exportaciones traen
        el departamento de origen; las importaciones por país no, porque el INE las publica por
        partida y país o por partida y departamento, no por las tres cosas a la vez.
      </p>
    </div>
  );
}
