'use client';

import { useEffect, useRef } from 'react';
import { WorldLines, seriesTone } from './charts';
import type { WorldLineSeries } from './charts';
import { CompanyLogo } from './company-logo';
import styles from './business.module.css';
import type { OwnersBoard } from '@/lib/business-owners-board';

const usd = (value: number): string =>
  `$us ${value.toLocaleString('es-BO', { minimumFractionDigits: value < 10 ? 1 : 0, maximumFractionDigits: value < 10 ? 1 : 0 })} M`;
const pct = (value: number): string =>
  `${value.toLocaleString('es-BO', { maximumFractionDigits: 2 })} %`;

const personSeries: WorldLineSeries[] = [
  { key: 'book', label: 'Piso contable', tone: seriesTone(0) },
  { key: 'market', label: 'Referencia de mercado', tone: seriesTone(1), dashed: true },
];

export function BusinessOwnerHistory({
  board,
  person,
  year,
  onSelect,
}: {
  board: OwnersBoard;
  person: string | null;
  year: number;
  onSelect: (person: string, latestYear: number) => void;
}) {
  const profileRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const histories = [...board.histories].sort((left, right) => left.name.localeCompare(right.name, 'es'));
  const history = person ? board.histories.find((one) => one.person === person) ?? null : null;
  const sheet = person ? board.estimates.filter((one) => one.person === person) : [];
  const current = sheet.find((one) => one.year === year) ?? sheet.at(-1) ?? null;
  const firstHistory = history?.years[0] ?? null;
  const latestHistory = history?.years.at(-1) ?? null;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      profileRef.current?.focus({ preventScroll: true });
      profileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [person]);

  if (!current || !history) return null;

  return (
    <div className={`panel ${styles.historyPicker}`}>
      <div className={styles.historyChooser}>
        <div>
          <span className={styles.eyebrow}>Histórico individual visible</span>
          <h2>Nombre, trayectoria y empresas principales</h2>
          <p>Elegí cualquiera de las {histories.length} personas con estimaciones documentables.</p>
        </div>
        <label>
          Empresario
          <select
            aria-label="Empresario con historial"
            value={person ?? ''}
            onChange={(event) => {
              const next = board.histories.find((one) => one.person === event.target.value);
              if (next) onSelect(next.person, next.latestYear);
            }}
          >
            {histories.map((one) => (
              <option key={one.person} value={one.person}>{one.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div
        ref={profileRef}
        id="empresario-ficha"
        className={styles.sheet}
        tabIndex={-1}
        aria-label={`Ficha histórica de ${history.name}`}
      >
        <div className={styles.profileHead}>
          <div>
            <span className={styles.eyebrow}>Ficha histórica</span>
            <h3>{history.name}</h3>
            <p>
              Estimaciones disponibles entre {history.firstYear} y {history.latestYear}; cada cifra conserva las
              empresas y documentos que sostienen el cálculo.
            </p>
          </div>
        </div>

        <div className={styles.figures}>
          <div className={styles.figure}>
            <span>Mejor posición entre estimaciones</span>
            <b>#{history.bestRank}</b>
            <span>{history.podiumYears.length ? `${history.podiumYears.length} año${history.podiumYears.length === 1 ? '' : 's'} entre las tres mayores` : 'sin apariciones entre las tres mayores'}</span>
          </div>
          <div className={styles.figure}>
            <span>Máximo histórico</span>
            <b>{usd(history.peak.book)}</b>
            <span>{history.peak.year} · posición #{history.peak.rank} entre estimaciones</span>
          </div>
          <div className={styles.figure}>
            <span>Primera aparición</span>
            <b>{history.firstYear}</b>
            <span>{firstHistory ? `posición #${firstHistory.rank} de ${firstHistory.population}` : '—'}</span>
          </div>
          <div className={styles.figure}>
            <span>Última aparición</span>
            <b>{history.latestYear}</b>
            <span>{latestHistory ? `posición #${latestHistory.rank} de ${latestHistory.population} · ${usd(latestHistory.book)}` : '—'}</span>
          </div>
        </div>

        <div className={styles.historyGrid}>
          <div>
            <h4 className={styles.subhead}>Fortuna y posición a través del tiempo</h4>
            {sheet.length > 1 ? (
              <WorldLines
                data={sheet.map((one) => ({ year: String(one.year), book: one.book, market: one.market }))}
                series={personSeries}
                format={usd}
                tick={(value) => value.toLocaleString('es-BO', { maximumFractionDigits: 0 })}
                countsOnly
              />
            ) : <div className="callout">Sólo hay una gestión con estimación calculable para esta persona.</div>}
            <div className="table-wrap">
              <table className={`grid-table ${styles.historyTable}`}>
                <thead>
                  <tr>
                    <th>Año</th>
                    <th className="num">Posición disponible</th>
                    <th className="num">Piso contable</th>
                    <th className="num">Referencia de mercado</th>
                  </tr>
                </thead>
                <tbody>
                  {history.years.map((row) => (
                    <tr key={row.year}>
                      <th scope="row">{row.year}</th>
                      <td className="num">#{row.rank} de {row.population}</td>
                      <td className="num">{usd(row.book)}</td>
                      <td className="num">{row.market === null ? '—' : usd(row.market)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h4 className={styles.subhead}>Principales hitos históricos</h4>
            <ol className={styles.milestones}>
              {firstHistory ? (
                <li><b>{firstHistory.year}</b><span>Primera estimación: {usd(firstHistory.book)}, posición #{firstHistory.rank} de {firstHistory.population}; principal empresa: {firstHistory.leadingHolding}.</span></li>
              ) : null}
              <li><b>{history.peak.year}</b><span>Máximo estimado: {usd(history.peak.book)}, posición #{history.peak.rank} entre los pisos disponibles.</span></li>
              {history.podiumYears.length ? (
                <li><b>Tres mayores</b><span>Años en que estuvo entre los tres mayores pisos calculables: {history.podiumYears.join(', ')}.</span></li>
              ) : null}
              {latestHistory && latestHistory.year !== firstHistory?.year ? (
                <li><b>{latestHistory.year}</b><span>Última estimación: {usd(latestHistory.book)}, posición #{latestHistory.rank} de {latestHistory.population}; principal empresa: {latestHistory.leadingHolding}.</span></li>
              ) : null}
            </ol>
          </div>
        </div>

        <h4 className={styles.subhead}>Principales empresas en su historial</h4>
        <div className="table-wrap">
          <table className={`grid-table ${styles.holdingsTable}`}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Años con estimación</th>
                <th className="num">Mayor aporte estimado</th>
                <th className="num">Participación aplicada en la última estimación</th>
              </tr>
            </thead>
            <tbody>
              {history.mainHoldings.map((holding) => (
                <tr key={holding.company}>
                  <td><CompanyLogo slug={holding.company} name={holding.name} size={18} /> {holding.name}</td>
                  <td>{holding.estimateYears.join(', ')}</td>
                  <td className="num">{usd(holding.peakBook)} ({holding.peakYear})</td>
                  <td className="num">{pct(holding.latestStake)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className={styles.subhead}>Composición de la estimación, {current.year}</h4>
        <div className="table-wrap">
          <table className={`grid-table ${styles.compositionTable}`}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Sector</th>
                <th className="num">Participación</th>
                <th className="num">Documento</th>
                <th className="num">Patrimonio</th>
                <th className="num">Piso contable</th>
                <th className="num">P/VL</th>
                <th className="num">Mercado</th>
              </tr>
            </thead>
            <tbody>
              {current.holdings.map((holding) => (
                <tr key={holding.company}>
                  <td>
                    <CompanyLogo slug={holding.company} name={holding.name} size={18} /> {holding.name}
                    {holding.via ? <small> · vía {holding.via}</small> : null}
                  </td>
                  <td>{holding.sector ?? '—'}</td>
                  <td className="num">{pct(holding.stake)}</td>
                  <td className="num">{holding.documentYear}</td>
                  <td className="num">{usd(holding.equity)}</td>
                  <td className="num">{usd(holding.book)}</td>
                  <td className="num" title={holding.industry ?? ''}>{holding.multiple === null ? '—' : holding.multiple.toLocaleString('es-BO', { maximumFractionDigits: 2 })}</td>
                  <td className="num">{holding.market === null ? '—' : usd(holding.market)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
