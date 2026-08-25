'use client';

import { useMemo, useState } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { CompanyFiling } from '@/lib/series';

/**
 * The corporate register, read by industry rather than as one undifferentiated list.
 *
 * Six hundred filings from ninety-three issuers is a register, not a news feed,
 * and the question an analyst brings to it is sectoral: what has been happening
 * in banking, in energy, in agro-industry. So the industry is the first slicer,
 * docked beside the register rather than stacked above it, and it composes with
 * the issuer and a search over the subject line.
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

const SECTOR_ICON: Record<string, IconName> = {
  MERCADO_VALORES: 'velas',
  FINANCIERO: 'banco',
  SEGUROS: 'escudo',
  HIDROCARBUROS: 'gota',
  ELECTRICIDAD: 'rayo',
  MINERIA: 'gema',
  AGROINDUSTRIA: 'espiga',
  MANUFACTURA: 'fabrica',
  COMERCIO: 'tienda',
  TRANSPORTE: 'camion',
  CONSTRUCCION: 'casco',
  SALUD: 'pulso',
  TECNOLOGIA: 'chip',
  SERVICIOS: 'maletin',
  OTROS: 'cajas',
};

/** Five tones cycled by rank, so a bar's colour never implies a category. */
const TONES = ['var(--official)', 'var(--parallel)', 'var(--gap)', 'var(--down)', 'var(--up)'];

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

  const peak = sectors.length ? Math.max(...sectors.map(([, count]) => count)) : 1;
  const issuers = new Set(selected.map((filing) => filing.filer)).size;
  const active =
    (sector === 'TODOS' ? 0 : 1) + (filer === 'TODOS' ? 0 : 1) + (search.trim() ? 1 : 0);

  const query = new URLSearchParams({
    dataset: 'filings',
    ...(sector === 'TODOS' ? {} : { sector }),
    ...(search.trim() ? { buscar: search.trim() } : {}),
  });

  return (
    <div className="workspace">
      <aside className="rail">
        <div className="rail-top">
          <Icon name="filtro" size={15} />
          <span className="rail-title">Filtros</span>
          <span className="rail-count">
            {active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}
          </span>
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="cajas" size={13} />
            Rubro del emisor
          </div>
          <button
            type="button"
            className={sector === 'TODOS' ? 'rail-item rail-item-on' : 'rail-item'}
            onClick={() => {
              setSector('TODOS');
              setFiler('TODOS');
            }}
          >
            <Icon name="cajas" size={16} />
            <span className="rail-name">Todos los rubros</span>
            <span className="rail-n">{filings.length}</span>
          </button>
          {sectors.map(([key, count]) => (
            <button
              key={key}
              type="button"
              className={sector === key ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => {
                setSector(sector === key ? 'TODOS' : key);
                setFiler('TODOS');
              }}
            >
              <Icon name={SECTOR_ICON[key] ?? 'cajas'} size={16} />
              <span className="rail-name">{SECTOR_LABEL[key] ?? key}</span>
              <span className="rail-n">{count}</span>
            </button>
          ))}
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="edificio" size={13} />
            Emisor ({filers.length})
          </div>
          <div className="rail-field">
            <select value={filer} onChange={(event) => setFiler(event.target.value)}>
              <option value="TODOS">Todos los emisores</option>
              {filers.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="buscar" size={13} />
            Buscar en el hecho
          </div>
          <div className="rail-field">
            <input
              type="search"
              value={search}
              placeholder="calificación, emisión, dividendos…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="rail-foot">
          Selección: <b>{selected.length.toLocaleString('es-BO')}</b> hechos
          <br />
          de <b>{issuers}</b> emisor{issuers === 1 ? '' : 'es'}
          <br />
          Rubro <b>derivado</b> de la razón social
        </div>
      </aside>

      <div className="workspace-main">
        <div className="briefcard">
          <span className="briefcard-mark">
            <Icon name="edificio" size={20} />
          </span>
          <div>
            <h2>Hechos relevantes</h2>
            <p>
              Comunicados que los emisores registran en la Bolsa Boliviana de Valores. Elegí un
              rubro a la izquierda para leer sólo ese sector; la bolsa no publica una clasificación
              sectorial propia, así que el rubro se <strong>deriva de la razón social</strong> del
              emisor.
            </p>
            <div className="brief-points">
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="banco" size={17} />
                </span>
                <div>
                  <b>Banca y valores</b>
                  <span>el grueso del registro</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="gota" size={17} />
                </span>
                <div>
                  <b>Energía y minería</b>
                  <span>YPFB, ENDE, Corani, Paititi</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="espiga" size={17} />
                </span>
                <div>
                  <b>Economía real</b>
                  <span>Sofía, Nutrioil, FANCESA, TSM</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="strap">
          <Icon name={SECTOR_ICON[sector] ?? 'cajas'} size={17} />
          <h2>{sector === 'TODOS' ? 'Todos los rubros' : (SECTOR_LABEL[sector] ?? sector)}</h2>
          <span className="tile-hint">
            {selected.length} hecho{selected.length === 1 ? '' : 's'}
          </span>
          <div className="download">
            <a className="download-btn" href={`/api/export?${query.toString()}&format=csv`}>
              CSV
            </a>
            <a className="download-btn" href={`/api/export?${query.toString()}&format=json`}>
              JSON
            </a>
          </div>
        </div>

        {sectors.length > 1 ? (
          <div className="panel">
            <div className="tile-head">
              <Icon name="barras" size={17} />
              <h2>Actividad por rubro</h2>
              <span className="tile-hint">{filings.length} comunicados</span>
            </div>
            <div className="barlist">
              {sectors.map(([key, count], index) => (
                <button
                  key={key}
                  type="button"
                  className="barlist-row"
                  onClick={() => {
                    setSector(sector === key ? 'TODOS' : key);
                    setFiler('TODOS');
                  }}
                  style={{
                    appearance: 'none',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <Icon name={SECTOR_ICON[key] ?? 'cajas'} size={14} />
                  <span className="barlist-name">{SECTOR_LABEL[key] ?? key}</span>
                  <span className="barlist-track">
                    <span
                      className="barlist-fill"
                      style={{
                        width: `${(count / peak) * 100}%`,
                        background: sector === key ? 'var(--ink)' : TONES[index % TONES.length],
                      }}
                    />
                  </span>
                  <span className="barlist-n">{count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {selected.length ? (
          <div className="filing-grid">
            {selected.slice(0, SHOWN).map((filing, index) => (
              <article
                className="filing-card"
                key={filing.factClaimId}
                style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
              >
                <div className="filing-top">
                  <Icon name={SECTOR_ICON[filing.sector] ?? 'cajas'} size={13} />
                  <span>{SECTOR_LABEL[filing.sector] ?? filing.sector}</span>
                  <span className="filing-date">{filing.eventDate}</span>
                </div>
                <h4>{filing.subject}</h4>
                <p className="filing-filer">{filing.filer}</p>
                {filing.summary ? <p className="filing-summary">{filing.summary}</p> : null}
                <p className="filing-foot">
                  <Icon name={filing.instantStatedInDocument ? 'diana' : 'reloj'} size={12} />
                  {filing.instantStatedInDocument ? 'Confirmado por la ficha' : 'Según el registro'}
                  {filing.filerCode ? ` · ${filing.filerCode}` : ''}
                  {filing.sourceUrl ? (
                    <a href={filing.sourceUrl} target="_blank" rel="noreferrer noopener">
                      ficha completa
                    </a>
                  ) : null}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="callout">Ningún hecho relevante coincide con esta selección.</div>
        )}

        {selected.length > SHOWN ? (
          <p className="panel-sub">
            Se muestran los {SHOWN} más recientes de {selected.length.toLocaleString('es-BO')}. La
            descarga incluye la selección completa.
          </p>
        ) : null}
      </div>
    </div>
  );
}
