'use client';

import { useMemo, useState } from 'react';
import { SeriesChart } from './charts';
import type { CompanyFiling } from '@/lib/series';

/**
 * The corporate register, read by industry rather than as one undifferentiated list.
 *
 * Six hundred filings from ninety-three issuers is a register, not a news feed,
 * and the question an analyst brings to it is sectoral: what has been happening
 * in banking, in energy, in agro-industry. So the industry is the first slicer,
 * and it composes with the issuer and the period the way the macro panel's do.
 *
 * The industry is derived from each issuer's registered name — the exchange
 * publishes no taxonomy of its own — and the panel says so rather than letting
 * a chip imply an official classification. Anything the rules do not match
 * stays under «Otros» instead of being assigned a plausible bucket.
 */

const SECTOR_LABEL: Record<string, string> = {
  MERCADO_VALORES: 'Mercado de valores',
  FINANCIERO: 'Banca y microfinanzas',
  SEGUROS: 'Seguros',
  HIDROCARBUROS: 'Hidrocarburos',
  ELECTRICIDAD: 'Electricidad',
  MINERIA: 'Minería',
  AGROINDUSTRIA: 'Agroindustria',
  MANUFACTURA: 'Manufactura',
  COMERCIO: 'Comercio',
  TRANSPORTE: 'Transporte',
  CONSTRUCCION: 'Construcción',
  SALUD: 'Salud',
  TECNOLOGIA: 'Tecnología',
  SERVICIOS: 'Servicios',
  OTROS: 'Otros',
};

const SECTOR_TONE: Record<string, string> = {
  MERCADO_VALORES: 'var(--official)',
  FINANCIERO: 'var(--official)',
  SEGUROS: 'var(--gap)',
  HIDROCARBUROS: 'var(--parallel)',
  ELECTRICIDAD: 'var(--parallel)',
  MINERIA: 'var(--up)',
  AGROINDUSTRIA: 'var(--up)',
  MANUFACTURA: 'var(--gap)',
  COMERCIO: 'var(--down)',
  TRANSPORTE: 'var(--down)',
  CONSTRUCCION: 'var(--ink-soft)',
  SALUD: 'var(--ink-soft)',
  TECNOLOGIA: 'var(--ink-soft)',
  SERVICIOS: 'var(--ink-soft)',
  OTROS: 'var(--ink-faint)',
};

const SHOWN = 40;

export function FilingExplorer({ filings }: { filings: CompanyFiling[] }) {
  const [sector, setSector] = useState('TODOS');
  const [filer, setFiler] = useState('TODOS');
  const [search, setSearch] = useState('');

  const sectors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const filing of filings) counts.set(filing.sector, (counts.get(filing.sector) ?? 0) + 1);
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [filings]);

  /** Issuers offered are only those the sector choice leaves standing. */
  const filers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const filing of filings) {
      if (sector !== 'TODOS' && filing.sector !== sector) continue;
      counts.set(filing.filer, (counts.get(filing.filer) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [filings, sector]);

  const selected = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return filings.filter(
      (filing) =>
        (sector === 'TODOS' || filing.sector === sector) &&
        (filer === 'TODOS' || filing.filer === filer) &&
        (!term ||
          filing.subject.toLocaleLowerCase('es').includes(term) ||
          filing.filer.toLocaleLowerCase('es').includes(term)),
    );
  }, [filings, sector, filer, search]);

  /** Filings per day, so a burst of activity is visible before any of it is read. */
  const perDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const filing of selected)
      counts.set(filing.eventDate, (counts.get(filing.eventDate) ?? 0) + 1);
    return [...counts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, value]) => ({ date, value }));
  }, [selected]);

  const query = new URLSearchParams({
    dataset: 'filings',
    ...(sector === 'TODOS' ? {} : { sector }),
    ...(search.trim() ? { buscar: search.trim() } : {}),
  });

  return (
    <>
      <div className="slicers">
        <div className="slicer">
          <span className="slicer-label">Rubro del emisor</span>
          <div className="chips">
            <button
              type="button"
              className={sector === 'TODOS' ? 'chip chip-on' : 'chip'}
              onClick={() => {
                setSector('TODOS');
                setFiler('TODOS');
              }}
            >
              Todos
              <em>{filings.length}</em>
            </button>
            {sectors.map(([key, count]) => (
              <button
                key={key}
                type="button"
                className={sector === key ? 'chip chip-on' : 'chip'}
                onClick={() => {
                  setSector(sector === key ? 'TODOS' : key);
                  setFiler('TODOS');
                }}
              >
                {SECTOR_LABEL[key] ?? key}
                <em>{count}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="slicer-row">
          <label className="slicer slicer-grow">
            <span className="slicer-label">Emisor ({filers.length})</span>
            <select value={filer} onChange={(event) => setFiler(event.target.value)}>
              <option value="TODOS">Todos los emisores</option>
              {filers.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
          </label>

          <label className="slicer slicer-grow">
            <span className="slicer-label">Buscar en el hecho</span>
            <input
              type="search"
              value={search}
              placeholder="calificación, emisión, dividendos…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="slicer-foot">
          <span>
            {selected.length.toLocaleString('es-BO')} hecho
            {selected.length === 1 ? '' : 's'} ·{' '}
            {new Set(selected.map((filing) => filing.filer)).size} emisor
            {new Set(selected.map((filing) => filing.filer)).size === 1 ? '' : 'es'}
            {selected.length ? ` · ${selected.at(-1)?.eventDate} a ${selected[0]?.eventDate}` : ''}
          </span>
          <div className="download">
            <span className="download-label">Descargar la selección</span>
            <a className="download-btn" href={`/api/export?${query.toString()}&format=csv`}>
              CSV
            </a>
            <a className="download-btn" href={`/api/export?${query.toString()}&format=json`}>
              JSON
            </a>
          </div>
        </div>
      </div>

      {perDay.length >= 2 ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Actividad por día</h2>
            <p className="panel-sub">
              Hechos comunicados cada jornada dentro de la selección. Los picos suelen coincidir con
              cierres de trimestre y con juntas de accionistas.
            </p>
          </div>
          <SeriesChart
            data={perDay}
            kind="bar"
            tone={SECTOR_TONE[sector] ?? 'var(--official)'}
            unit=""
            decimals={0}
          />
        </div>
      ) : null}

      {selected.length ? (
        <ol className="timeline">
          {selected.slice(0, SHOWN).map((filing, index) => (
            <li key={filing.factClaimId} style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}>
              <div className="tl-stamp">{filing.eventDate}</div>
              <div className="tl-body">
                <span className="card-sector">
                  {SECTOR_LABEL[filing.sector] ?? filing.sector}
                  {filing.filerCode ? ` · ${filing.filerCode}` : ''}
                </span>
                <h4>{filing.subject}</h4>
                <p className="tl-filer">{filing.filer}</p>
                {filing.excerpt ? (
                  <p className="tl-excerpt">{filing.excerpt.slice(0, 260)}…</p>
                ) : null}
                <p className="tl-foot">
                  {filing.instantStatedInDocument
                    ? 'Fecha confirmada por la ficha'
                    : 'Fecha según el registro de la bolsa'}
                  {filing.sourceUrl ? (
                    <>
                      {' · '}
                      <a href={filing.sourceUrl} target="_blank" rel="noreferrer noopener">
                        ficha completa
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="callout">Ningún hecho relevante coincide con esta selección.</div>
      )}

      {selected.length > SHOWN ? (
        <p className="panel-sub">
          Se muestran los {SHOWN} más recientes de {selected.length.toLocaleString('es-BO')}. La
          descarga incluye la selección completa.
        </p>
      ) : null}
    </>
  );
}
