'use client';

import { useEffect, useRef } from 'react';
import { WorldLines, seriesTone } from './charts';
import type { WorldLineSeries } from './charts';
import { CompanyLogo } from './company-logo';
import styles from './business.module.css';
import { Panel } from '@/components/ui/panel';
import type { OwnersBoard } from '@/lib/business-owners-board';

/** De dónde sale cada estimación: los documentos públicos de cada empresa, no el Observatorio solo. */
export const ESTIMATE_SOURCE =
  'Documentos públicos de cada empresa (memorias de bancos, prospectos y registros de la bolsa, vía ASFI y la Bolsa Boliviana de Valores) y razón precio/valor en libros de Aswath Damodaran (NYU Stern); cálculo del Observatorio';

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
  const histories = [...board.histories].sort((left, right) =>
    left.name.localeCompare(right.name, 'es'),
  );
  const history = person ? (board.histories.find((one) => one.person === person) ?? null) : null;
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
    <section
      ref={profileRef}
      id="empresario-ficha"
      className={`panel-group ${styles.ficha}`}
      tabIndex={-1}
      aria-label={`Ficha histórica de ${history.name}`}
    >
      <header className="panel-group-head">
        <h3>Nombre, trayectoria y empresas principales</h3>
        <p>Elegí cualquiera de las {histories.length} personas con estimaciones documentables.</p>
        <label className={styles.chooser}>
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
              <option key={one.person} value={one.person}>
                {one.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <Panel
        id="empresario-trayectoria"
        title={`${history.name}: fortuna y posición a través del tiempo (millones de dólares)`}
        lede={`Estimaciones disponibles entre ${history.firstYear} y ${history.latestYear}; cada cifra conserva las empresas y documentos que sostienen el cálculo.`}
        source={ESTIMATE_SOURCE}
        data={() => ({
          columnas: ['Dato', 'Valor', 'Detalle'],
          filas: [
            [
              'Mejor posición entre estimaciones',
              history.bestRank,
              history.podiumYears.length
                ? `${history.podiumYears.length} año${history.podiumYears.length === 1 ? '' : 's'} entre las tres mayores`
                : 'sin apariciones entre las tres mayores',
            ],
            [
              'Máximo histórico (millones de dólares)',
              history.peak.book,
              `${history.peak.year} · posición #${history.peak.rank} entre estimaciones`,
            ],
            [
              'Primera aparición',
              history.firstYear,
              firstHistory ? `posición #${firstHistory.rank} de ${firstHistory.population}` : null,
            ],
            [
              'Última aparición',
              history.latestYear,
              latestHistory
                ? `posición #${latestHistory.rank} de ${latestHistory.population} · ${usd(latestHistory.book)}`
                : null,
            ],
          ],
        })}
      >
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Mejor posición entre estimaciones</span>
            <span className="stat-value">#{history.bestRank}</span>
            <span className="stat-hint">
              {history.podiumYears.length
                ? `${history.podiumYears.length} año${history.podiumYears.length === 1 ? '' : 's'} entre las tres mayores`
                : 'sin apariciones entre las tres mayores'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Máximo histórico</span>
            <span className="stat-value">{usd(history.peak.book)}</span>
            <span className="stat-hint">
              {history.peak.year} · posición #{history.peak.rank} entre estimaciones
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Primera aparición</span>
            <span className="stat-value">{history.firstYear}</span>
            <span className="stat-hint">
              {firstHistory ? `posición #${firstHistory.rank} de ${firstHistory.population}` : '—'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Última aparición</span>
            <span className="stat-value">{history.latestYear}</span>
            <span className="stat-hint">
              {latestHistory
                ? `posición #${latestHistory.rank} de ${latestHistory.population} · ${usd(latestHistory.book)}`
                : '—'}
            </span>
          </div>
        </div>

        <div className={styles.historyGrid}>
          <div>
            {sheet.length > 1 ? (
              <WorldLines
                data={sheet.map((one) => ({
                  year: String(one.year),
                  book: one.book,
                  market: one.market,
                }))}
                series={personSeries}
                format={usd}
                tick={(value) => value.toLocaleString('es-BO', { maximumFractionDigits: 0 })}
                countsOnly
              />
            ) : (
              <div className="callout">
                Sólo hay una gestión con estimación calculable para esta persona.
              </div>
            )}
          </div>
          <div>
            <h4 className={styles.subhead}>Principales hitos históricos</h4>
            <ol className={styles.milestones}>
              {firstHistory ? (
                <li>
                  <b>{firstHistory.year}</b>
                  <span>
                    Primera estimación: {usd(firstHistory.book)}, posición #{firstHistory.rank} de{' '}
                    {firstHistory.population}; principal empresa: {firstHistory.leadingHolding}.
                  </span>
                </li>
              ) : null}
              <li>
                <b>{history.peak.year}</b>
                <span>
                  Máximo estimado: {usd(history.peak.book)}, posición #{history.peak.rank} entre los
                  pisos disponibles.
                </span>
              </li>
              {history.podiumYears.length ? (
                <li>
                  <b>Tres mayores</b>
                  <span>
                    Años en que estuvo entre los tres mayores pisos calculables:{' '}
                    {history.podiumYears.join(', ')}.
                  </span>
                </li>
              ) : null}
              {latestHistory && latestHistory.year !== firstHistory?.year ? (
                <li>
                  <b>{latestHistory.year}</b>
                  <span>
                    Última estimación: {usd(latestHistory.book)}, posición #{latestHistory.rank} de{' '}
                    {latestHistory.population}; principal empresa: {latestHistory.leadingHolding}.
                  </span>
                </li>
              ) : null}
            </ol>
          </div>
        </div>
      </Panel>

      <Panel
        id="empresario-anios"
        title={`${history.name}: posición y fortuna estimada por año (millones de dólares)`}
        lede="El puesto es entre las estimaciones calculables de ese año, no entre fortunas reales."
        source={ESTIMATE_SOURCE}
      >
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
                  <td className="num">
                    #{row.rank} de {row.population}
                  </td>
                  <td className="num">{usd(row.book)}</td>
                  <td className="num">{row.market === null ? '—' : usd(row.market)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        id="empresario-empresas"
        title={`Principales empresas en el historial de ${history.name} (millones de dólares y % de participación)`}
        lede="Las empresas que más aportaron a la estimación, con el año del mayor aporte."
        source={ESTIMATE_SOURCE}
      >
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
                  <td>
                    <CompanyLogo slug={holding.company} name={holding.name} size={18} />{' '}
                    {holding.name}
                  </td>
                  <td>{holding.estimateYears.join(', ')}</td>
                  <td className="num">
                    {usd(holding.peakBook)} ({holding.peakYear})
                  </td>
                  <td className="num">{pct(holding.latestStake)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        id="empresario-composicion"
        title={`Composición de la estimación de ${history.name}, ${current.year} (millones de dólares)`}
        lede="Cada empresa con la participación, el documento y el patrimonio que sostienen su tramo."
        source={ESTIMATE_SOURCE}
      >
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
                    <CompanyLogo slug={holding.company} name={holding.name} size={18} />{' '}
                    {holding.name}
                    {holding.via ? <small> · vía {holding.via}</small> : null}
                  </td>
                  <td>{holding.sector ?? '—'}</td>
                  <td className="num">{pct(holding.stake)}</td>
                  <td className="num">{holding.documentYear}</td>
                  <td className="num">{usd(holding.equity)}</td>
                  <td className="num">{usd(holding.book)}</td>
                  <td className="num" title={holding.industry ?? ''}>
                    {holding.multiple === null
                      ? '—'
                      : holding.multiple.toLocaleString('es-BO', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="num">{holding.market === null ? '—' : usd(holding.market)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}
