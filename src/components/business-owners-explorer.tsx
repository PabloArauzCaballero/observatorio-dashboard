'use client';

import { useMemo, useState } from 'react';
import { ChartLegend, WorldLines, seriesTone } from './charts';
import type { WorldLineSeries } from './charts';
import { BusinessOwnerHistory, ESTIMATE_SOURCE } from './business-owner-history';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import styles from './business.module.css';
import { Panel } from '@/components/ui/panel';
import { ANY, additive, picked, toggle } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import type { OwnerEstimate, OwnersBoard } from '@/lib/business-owners-board';

/**
 * Los principales empresarios de Bolivia y sus fortunas, año a año.
 *
 * Dos clases de cifra, siempre rotuladas y nunca mezcladas sin decirlo:
 *
 * - **Forbes**, donde Forbes publica a la persona. Son dos, nacidos en Bolivia
 *   y con otra ciudadanía.
 * - **Estimación del observatorio** para el resto: la participación que los
 *   documentos públicos atribuyen a cada accionista por el patrimonio de cada
 *   empresa, y una referencia de mercado con el múltiplo de su industria. Es
 *   una cota inferior y la ficha de cada persona la abre empresa por empresa,
 *   con el documento que sostiene cada tramo.
 *
 * Abajo va lo que se sabe de la riqueza del país sin nombres: cuántos pagan el
 * impuesto a las grandes fortunas y cuánto, y los millonarios que cuenta UBS.
 */

/**
 * Qué mide cada referencia de riqueza del país. El tablero solo trae el nombre del país como
 * rótulo («Bolivia»), así que el nombre de la medida se dice aquí, por su código.
 */
const BENCHMARK_NAMES: Record<string, { name: string; unit: string }> = {
  WEALTH_UBS_ADULTS_UNDER_10K_PCT: {
    name: 'Adultos con patrimonio de menos de 10.000 dólares',
    unit: '% de los adultos',
  },
  WEALTH_UBS_ADULTS_10K_100K_PCT: {
    name: 'Adultos con patrimonio de 10.000 a 100.000 dólares',
    unit: '% de los adultos',
  },
  WEALTH_UBS_ADULTS_100K_1M_PCT: {
    name: 'Adultos con patrimonio de 100.000 a 1 millón de dólares',
    unit: '% de los adultos',
  },
  WEALTH_UBS_ADULTS_OVER_1M_PCT: {
    name: 'Adultos con patrimonio de más de 1 millón de dólares',
    unit: '% de los adultos',
  },
  WEALTH_UBS_ADULTS_THOUSAND: { name: 'Población adulta', unit: 'miles de personas' },
  WEALTH_UBS_DEBTS_PER_ADULT_USD: { name: 'Deudas por adulto', unit: 'dólares' },
  WEALTH_UBS_FINANCIAL_PER_ADULT_USD: { name: 'Patrimonio financiero por adulto', unit: 'dólares' },
  WEALTH_UBS_NONFINANCIAL_PER_ADULT_USD: {
    name: 'Patrimonio no financiero por adulto',
    unit: 'dólares',
  },
  WEALTH_UBS_MEAN_PER_ADULT_USD: { name: 'Patrimonio medio por adulto', unit: 'dólares' },
  WEALTH_UBS_MEDIAN_PER_ADULT_USD: { name: 'Patrimonio mediano por adulto', unit: 'dólares' },
  WEALTH_UBS_GINI_PCT: { name: 'Desigualdad de la riqueza (índice de Gini)', unit: '%' },
  WEALTH_UBS_TOTAL_WEALTH_BN_USD: {
    name: 'Patrimonio total',
    unit: 'miles de millones de dólares',
  },
};

const FALLBACK_SOURCE = 'Observatorio Económico de Bolivia (ver «Método»)';

type Basis = 'book' | 'market';

const usd = (value: number): string =>
  `$us ${value.toLocaleString('es-BO', { minimumFractionDigits: value < 10 ? 1 : 0, maximumFractionDigits: value < 10 ? 1 : 0 })} M`;
const UNIT_LABEL: Record<string, string> = {
  COUNT: 'cantidad',
  USD: 'dólares',
  MILLION_USD: 'millones de dólares',
  BILLION_USD: 'miles de millones de dólares',
  THOUSAND_PERSONS: 'miles de personas',
  PERCENT: '%',
  RATIO: 'razón',
};
const plain = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLocaleLowerCase('es');

interface Row {
  key: string;
  name: string;
  kind: 'estimate' | 'forbes';
  rank: number | null;
  value: number;
  low: number | null;
  high: number | null;
  estimate: OwnerEstimate | null;
  note: string;
}

export function BusinessOwnersExplorer({ board }: { board: OwnersBoard }) {
  const years = useMemo(
    () =>
      [
        ...new Set([
          ...board.estimates.map((one) => one.year),
          ...board.forbes.flatMap((one) => one.points.map((point) => point.year)),
        ]),
      ].sort((a, b) => b - a),
    [board],
  );
  const [chosenYear, setYear] = useState<number | null>(null);
  const year =
    chosenYear ??
    years.find((one) => board.estimates.some((row) => row.year === one)) ??
    years[0] ??
    0;
  const [basis, setBasis] = useState<Basis>('book');
  const [withForbes, setWithForbes] = useState(true);
  const [sector, setSector] = useState<Choice>(ANY);
  const [query, setQuery] = useState('');
  const latestEstimate = [...board.estimates].sort(
    (left, right) =>
      right.year - left.year || right.book - left.book || left.name.localeCompare(right.name, 'es'),
  )[0];
  const initialOwner = latestEstimate?.person ?? board.histories[0]?.person ?? null;
  const [open, setOpen] = useState<string | null>(initialOwner);

  const needle = plain(query.trim());
  const estimates = board.estimates.filter((one) => one.year === year);
  const inSector = (estimate: OwnerEstimate | null): boolean =>
    sector.size === 0 ||
    Boolean(estimate?.holdings.some((holding) => sector.has(holding.sector ?? '')));
  const estimateRows: Row[] = estimates
    .map((one) => ({
      key: one.person,
      name: one.name,
      kind: 'estimate' as const,
      rank: 0,
      value: basis === 'market' && one.market !== null ? one.market : one.book,
      low: one.book,
      high: one.market,
      estimate: one,
      note: `${one.holdings.length} empresa${one.holdings.length === 1 ? '' : 's'} · ${one.holdings[0]?.name ?? ''}`,
    }))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, 'es'))
    .map((row, index) => ({ ...row, rank: index + 1 }))
    .filter((row) => (!needle || plain(row.name).includes(needle)) && inSector(row.estimate));
  const forbesRows: Row[] =
    withForbes && sector.size === 0
      ? board.forbes
          .map((one) => ({ one, point: one.points.find((point) => point.year === year) }))
          .filter(
            (
              row,
            ): row is {
              one: OwnersBoard['forbes'][number];
              point: { year: number; value: number };
            } => Boolean(row.point),
          )
          .map(({ one, point }) => ({
            key: `forbes:${one.slug}`,
            name: one.name,
            kind: 'forbes' as const,
            rank: null,
            value: point.value,
            low: null,
            high: null,
            estimate: null,
            note: [
              one.attributes.fuente_riqueza,
              one.attributes.ciudadania ? `ciudadanía: ${one.attributes.ciudadania}` : '',
            ]
              .filter(Boolean)
              .join(' · '),
          }))
          .filter((row) => !needle || plain(row.name).includes(needle))
          .sort((left, right) => right.value - left.value)
      : [];
  const rows = [...estimateRows, ...forbesRows];
  const peak = Math.max(1, ...rows.map((row) => row.value));

  const sectorCounts = new Map<string, number>();
  for (const one of estimates) {
    for (const holding of new Set(one.holdings.map((h) => h.sector).filter(Boolean))) {
      sectorCounts.set(holding as string, (sectorCounts.get(holding as string) ?? 0) + 1);
    }
  }

  const forbesSeries: WorldLineSeries[] = board.forbes.map((one, index) => ({
    key: one.slug,
    label: one.name,
    tone: seriesTone(index),
  }));
  const forbesYears = [
    ...new Set(board.forbes.flatMap((one) => one.points.map((point) => point.year))),
  ].sort((a, b) => a - b);
  const latestTax = board.wealthTax.at(-1);

  const rankingItem = (row: Row) => (
    <li key={row.key} className={styles.rankingRow}>
      <span
        className={styles.rankingPosition}
        aria-label={row.rank === null ? 'Cifra Forbes sin puesto comparable' : `Puesto ${row.rank}`}
      >
        {row.rank ?? '—'}
      </span>
      <span className={styles.rankingPerson}>
        {row.estimate ? (
          <button
            type="button"
            className={styles.rankingName}
            aria-controls="empresario-ficha"
            aria-expanded={open === row.key}
            onClick={() => setOpen(row.key)}
          >
            {row.name}
          </button>
        ) : (
          <span className={styles.rankingName}>{row.name}</span>
        )}
        <span className={styles.rankingMeta}>
          <span
            className={row.kind === 'forbes' ? styles.badge : `${styles.badge} ${styles.estimate}`}
          >
            {row.kind === 'forbes' ? 'Forbes' : 'Estimación'}
          </span>
          <span>{row.note}</span>
        </span>
      </span>
      <span className={styles.rankingValue}>
        <span className={styles.rankingBar}>
          <span style={{ width: `${Math.max(2, (row.value / peak) * 100)}%` }} />
        </span>
        <span className={styles.rankingNumber}>
          {usd(row.value)}
          {row.low !== null && row.high !== null ? (
            <small>
              {' '}
              ({usd(row.low)}–{usd(row.high)})
            </small>
          ) : null}
        </span>
      </span>
    </li>
  );

  return (
    <>
      <Panel
        id="empresarios-resumen"
        title={`Empresarios de Bolivia: fortuna estimada por sus participaciones en empresas, ${year} (millones de dólares)`}
        lede="Estimación del Observatorio, una cota inferior: participación documentada por patrimonio de la empresa."
        source={ESTIMATE_SOURCE}
        data={() => ({
          columnas: ['Cifra', 'Valor', 'Detalle'],
          filas: [
            [
              'Personas con estimación',
              board.coverage.people,
              'accionistas con 10 % o más en un documento público',
            ],
            [
              'Empresas con dueños documentados',
              board.coverage.withOwners,
              `de ${board.coverage.withEquity} con patrimonio publicado`,
            ],
            ...(latestTax
              ? [
                  [
                    `Impuesto a las grandes fortunas, ${latestTax.year}`,
                    latestTax.payers,
                    'contribuyentes con patrimonio sobre Bs 30 millones',
                  ],
                ]
              : []),
            ['En Forbes', board.forbes.length, 'nacidos en Bolivia, con otra ciudadanía'],
          ],
        })}
      >
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Personas con estimación</span>
            <span className="stat-value">{board.coverage.people}</span>
            <span className="stat-hint">accionistas con 10 % o más en un documento público</span>
          </div>
          <div className="stat">
            <span className="stat-label">Empresas con dueños documentados</span>
            <span className="stat-value">{board.coverage.withOwners}</span>
            <span className="stat-hint">
              de {board.coverage.withEquity} con patrimonio publicado
            </span>
          </div>
          {latestTax ? (
            <div className="stat">
              <span className="stat-label">Impuesto a las grandes fortunas, {latestTax.year}</span>
              <span className="stat-value">{latestTax.payers?.toLocaleString('es-BO') ?? '—'}</span>
              <span className="stat-hint">contribuyentes con patrimonio sobre Bs 30 millones</span>
            </div>
          ) : null}
          <div className="stat">
            <span className="stat-label">En Forbes</span>
            <span className="stat-value">{board.forbes.length}</span>
            <span className="stat-hint">nacidos en Bolivia, con otra ciudadanía</span>
          </div>
        </div>
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            <span className={`${styles.badge} ${styles.estimate}`}>
              Estimación del Observatorio
            </span>{' '}
            cota inferior: participación documentada × patrimonio de la empresa. No incluye
            inmuebles, cuentas, empresas fuera de la lista ni activos fuera de Bolivia.{' '}
            <span className={styles.badge}>Forbes</span> cifra publicada por Forbes, sólo para quien
            Forbes nombra.
          </p>
          <p>
            Cómo se calcula. 1) Participación efectiva de cada persona en cada empresa, directa o a
            través de sociedades, según el documento público más reciente hasta ese año (memorias de
            bancos, prospectos y registros de la bolsa). 2) Piso contable: participación ×
            patrimonio del balance auditado que publica la propia empresa. 3) Referencia de mercado:
            el piso por la razón precio/valor en libros de su industria en mercados emergentes
            (Damodaran) ese año. 4) Bolivianos a dólares a 6,96.
          </p>
        </details>
      </Panel>

      <BusinessOwnerHistory
        board={board}
        person={open}
        year={year}
        onSelect={(person, latestYear) => {
          setOpen(person);
          setYear(latestYear);
        }}
      />

      {board.podiums.length ? (
        <Panel
          id="empresarios-podio"
          title="Podio histórico de estimaciones documentables (millones de dólares)"
          lede="Los tres mayores pisos contables que se pueden calcular en cada gestión; cada nombre abre su trayectoria."
          source={ESTIMATE_SOURCE}
          data={() => ({
            unidad: 'millones de dólares',
            columnas: [
              'Año',
              'Estimaciones calculables',
              'Puesto',
              'Persona',
              'Piso contable (millones de dólares)',
            ],
            filas: [...board.podiums]
              .reverse()
              .flatMap((podium) =>
                podium.places.map((place) => [
                  podium.year,
                  podium.population,
                  place.rank,
                  place.name,
                  place.book,
                ]),
              ),
          })}
        >
          <details className="panel-note">
            <summary>Cómo leerlo</summary>
            <p>
              Ordena sólo a las personas con participación y patrimonio públicos ese año: no es un
              ránking de fortunas reales. Cada nombre abre su trayectoria, sus hitos y las empresas
              que sostienen la estimación.
            </p>
          </details>
          <div className={`table-wrap ${styles.podiumDesktop}`}>
            <table className={`grid-table ${styles.podiumTable}`}>
              <thead>
                <tr>
                  <th>Año</th>
                  <th>1.º</th>
                  <th>2.º</th>
                  <th>3.º</th>
                </tr>
              </thead>
              <tbody>
                {[...board.podiums].reverse().map((podium) => (
                  <tr key={podium.year}>
                    <th scope="row">
                      {podium.year}
                      <small className={styles.population}>{podium.population} estimaciones</small>
                    </th>
                    {[0, 1, 2].map((index) => {
                      const place = podium.places[index];
                      return (
                        <td key={index}>
                          {place ? (
                            <button
                              type="button"
                              className={styles.personButton}
                              aria-controls="empresario-ficha"
                              aria-expanded={open === place.person}
                              onClick={() => {
                                setOpen(place.person);
                                setYear(podium.year);
                              }}
                            >
                              <strong>{place.name}</strong>
                              <small>{usd(place.book)}</small>
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.podiumCards}>
            {[...board.podiums].reverse().map((podium) => (
              <section key={podium.year} className={styles.podiumCard}>
                <h4>
                  {podium.year} <span>{podium.population} estimaciones</span>
                </h4>
                <ol>
                  {podium.places.map((place) => (
                    <li key={place.person}>
                      <span>{place.rank}.º</span>
                      <button
                        type="button"
                        className={styles.personButton}
                        aria-controls="empresario-ficha"
                        aria-expanded={open === place.person}
                        onClick={() => {
                          setOpen(place.person);
                          setYear(podium.year);
                        }}
                      >
                        <strong>{place.name}</strong>
                        <small>{usd(place.book)}</small>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="workspace">
        <aside className="rail" id="empresarios-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Año
            </div>
            <div className="rail-field">
              <select
                aria-label="Año"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              >
                {years.map((one) => (
                  <option key={one} value={one}>
                    {one}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="monedas" size={13} />
              Vara de la estimación
            </div>
            <div className="rail-pills">
              {(['book', 'market'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={basis === value ? 'chip chip-on chip-wide' : 'chip chip-wide'}
                  aria-pressed={basis === value}
                  onClick={() => setBasis(value)}
                >
                  {value === 'book' ? 'Piso contable' : 'Referencia de mercado'}
                </button>
              ))}
            </div>
          </div>
          <div className="rail-sec">
            <label className="rep-toggle">
              <input
                type="checkbox"
                checked={withForbes}
                onChange={(event) => setWithForbes(event.target.checked)}
              />
              <span>Incluir las cifras de Forbes</span>
            </label>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="buscar" size={13} />
              Persona
            </div>
            <div className="rail-field">
              <input
                type="search"
                placeholder="Buscar por nombre…"
                aria-label="Buscar una persona"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          {sectorCounts.size ? (
            <div className="rail-sec">
              <div className="rail-head">
                <Icon name="capas" size={13} />
                Sector de sus empresas
                <PickedCount choice={sector} />
              </div>
              <FilterHint />
              <div className="rail-list rail-list-cut">
                {[...sectorCounts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([value, count]) => {
                    const on = picked(sector, value);
                    return (
                      <button
                        key={value}
                        type="button"
                        className={on ? 'rail-item rail-item-on' : 'rail-item'}
                        aria-pressed={on}
                        onClick={(event) =>
                          setSector((choice) => toggle(choice, value, additive(event)))
                        }
                      >
                        <span className="rail-name">{value}</span>
                        <span className="rail-n">{count}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </aside>

        <div className={`workspace-main ${styles.board}`}>
          <Panel
            id="empresarios-orden"
            title={`Orden ${year}: ${estimates.length} estimaciones por fortuna ${basis === 'book' ? 'en libros' : 'a valor de mercado de referencia'} (millones de dólares)`}
            lede="La posición compara sólo los pisos que pudieron calcularse ese año, no fortunas reales. Toca un nombre para abrir su ficha."
            source={`${ESTIMATE_SOURCE}; Forbes, World’s Billionaires, sólo para quien Forbes nombra`}
            data={() => ({
              unidad: 'millones de dólares',
              columnas: [
                'Puesto',
                'Persona',
                'Cifra',
                'Piso contable (M USD)',
                'Referencia de mercado (M USD)',
                'Valor mostrado (M USD)',
              ],
              filas: rows.map((row) => [
                row.rank,
                row.name,
                row.kind === 'forbes'
                  ? 'Forbes (sin puesto comparable)'
                  : 'Estimación del Observatorio',
                row.low,
                row.high,
                row.value,
              ]),
            })}
          >
            {rows.length ? (
              <>
                {estimateRows.length ? (
                  <ol className={styles.ranking}>{estimateRows.map(rankingItem)}</ol>
                ) : null}
                {forbesRows.length ? (
                  <>
                    <h4 className={styles.listSubhead}>
                      Cifras publicadas por Forbes · sin puesto comparable
                    </h4>
                    <ul className={styles.ranking} aria-label="Cifras Forbes sin puesto comparable">
                      {forbesRows.map(rankingItem)}
                    </ul>
                  </>
                ) : null}
                <ChartLegend
                  items={[
                    { color: 'var(--official)', label: 'Fortuna mostrada (millones de dólares)' },
                  ]}
                />
              </>
            ) : (
              <div className="callout">
                No hay fortunas publicadas ni estimadas para {year} con estos filtros.
              </div>
            )}
            <details className="panel-note">
              <summary>Cómo leerlo</summary>
              <p>
                Las cifras Forbes se muestran aparte y sin puesto comparable. La barra fina marca el
                rango entre el piso contable y la referencia de mercado.
              </p>
            </details>
          </Panel>

          {forbesSeries.length ? (
            <Panel
              id="empresarios-forbes"
              title={`Nacidos en Bolivia en la lista de Forbes, ${forbesYears[0]}–${forbesYears.at(-1)} (patrimonio, millones de dólares)`}
              lede="Ninguna persona con ciudadanía boliviana figura en la lista en ningún año."
              source={`${board.sources['WEALTH_FORBES']?.publisher || 'Forbes'}, World’s Billionaires`}
            >
              <WorldLines
                data={forbesYears.map((when) => {
                  const row: { year: string; [key: string]: string | number | null } = {
                    year: String(when),
                  };
                  for (const one of board.forbes)
                    row[one.slug] = one.points.find((point) => point.year === when)?.value ?? null;
                  return row;
                })}
                series={forbesSeries}
                format={usd}
                tick={(value) => value.toLocaleString('es-BO', { maximumFractionDigits: 0 })}
                countsOnly
              />
            </Panel>
          ) : null}

          {board.wealthTax.length ? (
            <div className="grid-pair">
              <Panel
                id="empresarios-fortunas-contribuyentes"
                title="Impuesto a las Grandes Fortunas: contribuyentes por año (cantidad de personas)"
                lede="Personas con patrimonio neto sobre Bs 30 millones que lo declararon y pagaron."
                source={board.sources['WEALTH_IGF']?.publisher || 'Impuestos Nacionales'}
              >
                <WorldLines
                  data={board.wealthTax.map((row) => ({
                    year: String(row.year),
                    payers: row.payers,
                  }))}
                  series={[{ key: 'payers', label: 'Contribuyentes', tone: seriesTone(0) }]}
                  format={(value) => `${value.toLocaleString('es-BO')} personas`}
                  tick={(value) => value.toLocaleString('es-BO')}
                  countsOnly
                />
              </Panel>
              <Panel
                id="empresarios-fortunas-recaudacion"
                title={`Impuesto a las Grandes Fortunas: recaudación por año (${board.wealthTax.find((row) => row.unit)?.unit === 'MILLION_BOB' ? 'millones de bolivianos' : 'bolivianos'})`}
                lede="Lo que el impuesto recaudó cada gestión; el año en curso puede ser parcial."
                source={board.sources['WEALTH_IGF']?.publisher || 'Impuestos Nacionales'}
              >
                <WorldLines
                  data={board.wealthTax.map((row) => ({
                    year: String(row.year),
                    collected: row.collected,
                  }))}
                  series={[{ key: 'collected', label: 'Recaudación', tone: seriesTone(1) }]}
                  format={(value) => value.toLocaleString('es-BO', { maximumFractionDigits: 1 })}
                  tick={(value) => value.toLocaleString('es-BO', { notation: 'compact' })}
                  countsOnly
                />
              </Panel>
            </div>
          ) : null}

          {board.benchmarks
            .filter((one) => !one.code.startsWith('WEALTH_PBV_'))
            .map((one, index) => {
              const known = BENCHMARK_NAMES[one.code];
              const name = known?.name ?? one.label;
              const unit = known?.unit ?? UNIT_LABEL[one.unit] ?? one.unit;
              const first = one.points[0]?.year;
              const last = one.points.at(-1)?.year;
              const single = one.points.length === 1;
              const only = one.points[0];
              const format = (value: number): string =>
                value.toLocaleString('es-BO', { maximumFractionDigits: 1 });
              return (
                <Panel
                  key={one.code}
                  id={`empresarios-referencia-${one.code.toLowerCase().replace(/[^a-z0-9]+/gu, '-')}`}
                  title={`${name}, ${first === last ? first : `${first}–${last}`} (${unit})`}
                  lede={
                    single
                      ? 'Una cifra del país, sin nombres de personas.'
                      : 'Una cifra del país, sin nombres de personas, año a año.'
                  }
                  source={
                    board.sources[one.code.split('_').slice(0, 2).join('_')]?.publisher ||
                    FALLBACK_SOURCE
                  }
                  {...(single && only
                    ? {
                        data: () => ({
                          unidad: unit,
                          columnas: ['Año', `${name} (${unit})`],
                          filas: [[only.year, only.value]],
                        }),
                      }
                    : {})}
                >
                  {single && only ? (
                    <div className="stat-strip">
                      <div className="stat">
                        <span className="stat-label">
                          {name}, {only.year}
                        </span>
                        <span className="stat-value">{format(only.value)}</span>
                        <span className="stat-hint">{unit}; la fuente publica un solo año</span>
                      </div>
                    </div>
                  ) : (
                    <WorldLines
                      data={one.points.map((point) => ({
                        year: String(point.year),
                        value: point.value,
                      }))}
                      series={[{ key: 'value', label: name, tone: seriesTone(index) }]}
                      format={format}
                      tick={(value) => value.toLocaleString('es-BO', { notation: 'compact' })}
                      countsOnly
                    />
                  )}
                </Panel>
              );
            })}
        </div>
      </div>
    </>
  );
}
