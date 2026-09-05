'use client';

import { useEffect, useMemo, useState } from 'react';
import { YearSeriesBars } from './charts';
import type { YearSeriesPoint } from './charts';
import { Icon } from './icons';
import type { PanelIndicator, PanelPoint } from '@/lib/series';

/**
 * The World Development Indicators, opened one series at a time.
 *
 * The observatory used to carry a hundred and seventeen annual series chosen by
 * hand. This is the collection they were chosen from: fifteen hundred, on the
 * same definitions, for Bolivia and the economies it is read against. What
 * changes is not the depth of any one answer but how many questions have an
 * answer at all.
 *
 * A list of fifteen hundred cannot be browsed, so it is searched. The search
 * runs over the names the publisher wrote, in English, because that is what the
 * codes and the documentation say and translating them here would produce a
 * name that finds nothing when a reader looks it up.
 */

const COUNTRY_NAME: Record<string, string> = {
  BOL: 'Bolivia',
  PER: 'Perú',
  CHL: 'Chile',
  ARG: 'Argentina',
  BRA: 'Brasil',
  PRY: 'Paraguay',
  URY: 'Uruguay',
  COL: 'Colombia',
  ECU: 'Ecuador',
  VEN: 'Venezuela',
  MEX: 'México',
  USA: 'Estados Unidos',
  CHN: 'China',
  ESP: 'España',
  JPN: 'Japón',
  IND: 'India',
  DEU: 'Alemania',
};

const count = (value: number): string => value.toLocaleString('es-BO');

/** How many indicators the chooser shows before asking for a narrower search. */
const SHOWN = 40;

export function PanelExplorer({ catalogue }: { catalogue: PanelIndicator[] }) {
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState(catalogue[0]?.code ?? '');
  const [points, setPoints] = useState<PanelPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return catalogue.slice(0, SHOWN);
    return catalogue
      .filter(
        (row) => row.name.toLowerCase().includes(needle) || row.code.toLowerCase().includes(needle),
      )
      .slice(0, SHOWN);
  }, [catalogue, search]);

  const indicator = catalogue.find((row) => row.code === chosen);

  useEffect(() => {
    if (!chosen) return;
    let live = true;
    setLoading(true);
    fetch(`/api/panel?indicador=${encodeURIComponent(chosen)}`)
      .then((response) => (response.ok ? response.json() : { points: [] }))
      .then((body: { points?: PanelPoint[] }) => {
        if (live) setPoints(body.points ?? []);
      })
      .catch(() => {
        if (live) setPoints([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [chosen]);

  /** The countries this indicator actually has, Bolivia always first. */
  const countries = useMemo(() => {
    const held = [...new Set(points.map((point) => point.country))];
    return held.sort((left, right) => {
      if (left === 'BOL') return -1;
      if (right === 'BOL') return 1;
      return left.localeCompare(right);
    });
  }, [points]);

  const series: YearSeriesPoint[] = useMemo(() => {
    const byYear = new Map<number, YearSeriesPoint>();
    for (const point of points) {
      const row = byYear.get(point.year) ?? { year: String(point.year) };
      row[COUNTRY_NAME[point.country] ?? point.country] = point.value;
      byYear.set(point.year, row);
    }
    return [...byYear.entries()].sort((left, right) => left[0] - right[0]).map(([, row]) => row);
  }, [points]);

  const named = countries.map((code) => COUNTRY_NAME[code] ?? code);
  const bolivia = points.filter((point) => point.country === 'BOL');
  const latest = bolivia.length ? bolivia[bolivia.length - 1] : undefined;

  if (!catalogue.length) {
    return (
      <div className="callout">
        Todavía no hay panel cargado. El corpus existe en el árbol del proyecto; se carga con{' '}
        <code>yarn db:seed:boot --only=worldbank-panel</code>.
      </div>
    );
  }

  const totalObservations = catalogue.reduce((sum, row) => sum + row.observations, 0);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Panel del Banco Mundial</h2>
        </div>
        <p className="panel-sub">
          Cada indicador que el Banco Mundial publica para Bolivia, con la misma definición aplicada
          a las economías con las que se la compara. No es una selección: es la colección completa,
          y por eso incluye series que nadie habría elegido a mano y que resultan ser la respuesta a
          alguna pregunta.
        </p>
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">
              <Icon name="capas" size={12} />
              Indicadores con datos de Bolivia
            </span>
            <span className="stat-value">{count(catalogue.length)}</span>
            <span className="stat-hint">antes eran 117 elegidos a mano</span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="barras" size={12} />
              Observaciones del panel
            </span>
            <span className="stat-value">{count(totalObservations)}</span>
            <span className="stat-hint">una por país, año e indicador</span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="calendario" size={12} />
              Cobertura
            </span>
            <span className="stat-value">
              {Math.min(...catalogue.map((row) => row.firstYear))}–
              {Math.max(...catalogue.map((row) => row.lastYear))}
            </span>
            <span className="stat-hint">
              {new Set(catalogue.flatMap((row) => row.countries)).size > 0
                ? `hasta ${Math.max(...catalogue.map((row) => row.countries))} economías por serie`
                : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="tile-head">
          <Icon name="buscar" size={17} />
          <h2>Buscar un indicador</h2>
          <span className="tile-hint">
            {search.trim()
              ? `${matches.length} de ${catalogue.length}`
              : `los ${SHOWN} con más historia`}
          </span>
        </div>
        <input
          type="search"
          className="search-field"
          placeholder="inflation, poverty, GDP, mortality, forest…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Buscar indicador"
        />
        <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
          Los nombres van en inglés, como los publica y documenta el Banco Mundial: traducirlos aquí
          daría un nombre que no encuentra nada cuando el lector lo busca en la fuente.
        </p>
        <nav className="chip-row" aria-label="Indicadores">
          {matches.map((row) => (
            <button
              key={row.code}
              type="button"
              className={row.code === chosen ? 'chip chip-active' : 'chip'}
              onClick={() => setChosen(row.code)}
              title={`${row.code} · ${row.boliviaYears} años de Bolivia`}
            >
              {row.name.length > 62 ? `${row.name.slice(0, 62)}…` : row.name}
              <span className="chip-count">{row.boliviaYears}</span>
            </button>
          ))}
        </nav>
        {search.trim() && matches.length === 0 ? (
          <p className="panel-sub">
            Ningún indicador con datos de Bolivia coincide con esa búsqueda.
          </p>
        ) : null}
      </div>

      {indicator ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="barras" size={17} />
            <h2>{indicator.name}</h2>
            <span className="tile-hint">
              {indicator.code} · {indicator.firstYear}–{indicator.lastYear}
            </span>
          </div>
          {loading ? (
            <p className="panel-sub">Leyendo la serie…</p>
          ) : series.length ? (
            <>
              <YearSeriesBars data={series} countries={named} height={280} />
              <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
                {named.length > 1
                  ? `${named.join(' y ')}, año por año. `
                  : `${named[0] ?? 'Bolivia'}, año por año. `}
                Un año sin barra es un año que el publicador no reporta, no un cero: por eso la
                serie se dibuja en barras y no como una línea que inventaría el tramo faltante.
                {latest
                  ? ` El último dato de Bolivia es de ${latest.year}: ${latest.value.toLocaleString('es-BO', { maximumFractionDigits: 2 })}.`
                  : ''}
              </p>
            </>
          ) : (
            <p className="panel-sub">Esta serie no devolvió observaciones.</p>
          )}
        </div>
      ) : null}

      <p className="panel-sub">
        La unidad es la que el Banco Mundial publicó para cada serie —un ratio, un conteo, un total
        en dólares constantes— y no se normaliza aquí: convertirlas sería inventar una equivalencia
        que el publicador no declaró. Sumar dos indicadores sin mirar su unidad da basura, y el
        modelo no puede impedirlo.
      </p>
    </>
  );
}
