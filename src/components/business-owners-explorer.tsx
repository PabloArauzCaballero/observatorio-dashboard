'use client';

import { useMemo, useState } from 'react';
import { ChartLegend, WorldLines, seriesTone } from './charts';
import type { WorldLineSeries } from './charts';
import { BusinessOwnerHistory, ESTIMATE_SOURCE } from './business-owner-history';
import { OwnerRankRibbons } from './owner-rank-ribbons';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import styles from './business.module.css';
import { Panel } from '@/components/ui/panel';
import { ANY, additive, picked, toggle } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { TOP_PLACES } from '@/lib/business-owners-board';
import type { OwnerEstimate, OwnersBoard, OwnerYearHistory } from '@/lib/business-owners-board';

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
  /** El año del top; `null` es el último dato de cada persona, con lo que abre. */
  const [topYear, setTopYear] = useState<number | null>(null);
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

  /** El puesto de cada persona en cada año, para decir cuánto se movió. */
  const rankOf = new Map<string, Map<number, OwnerYearHistory>>(
    board.histories.map((history) => [
      history.person,
      new Map(history.years.map((row) => [row.year, row])),
    ]),
  );
  const fullYears = board.podiums
    .filter((one) => one.places.length >= TOP_PLACES)
    .map((one) => one.year);
  const podium =
    board.podiums.find((one) => one.year === year) ??
    board.podiums.filter((one) => one.year <= year).at(-1) ??
    board.podiums.at(-1);

  /*
   * El top abre con los diez mayores según la última estimación de cada uno.
   *
   * Un año solo no llega a diez: desde 2022 hay seis personas con participación
   * y patrimonio públicos, y la lista abría con «Los 6 mayores». Con el último
   * dato de cada persona hay diez; el año de ese dato va junto al nombre cuando
   * no es el más reciente, porque una estimación de 2015 no dice cuánto tiene esa
   * persona hoy. El selector sigue dando el orden de un año solo.
   */
  const latestYear = board.podiums.at(-1)?.year ?? 0;
  const latestTop = [...board.histories]
    .flatMap((history) => {
      const last = history.years.at(-1);
      return last ? [{ history, last }] : [];
    })
    .sort(
      (left, right) =>
        right.last.book - left.last.book ||
        left.history.name.localeCompare(right.history.name, 'es'),
    )
    .slice(0, TOP_PLACES);
  const topRows =
    topYear === null
      ? latestTop.map(({ history, last }, index) => ({
          person: history.person,
          name: history.name,
          rank: index + 1,
          book: last.book,
          year: last.year,
          detail:
            last.year === latestYear
              ? last.leadingHolding
              : `${last.leadingHolding} · último dato: ${last.year}`,
          move: null as string | null,
          moveTitle:
            last.year === latestYear
              ? `Dato de ${last.year}`
              : `Sin estimación después de ${last.year}`,
        }))
      : (podium?.places ?? []).map((place) => {
          const before = rankOf.get(place.person)?.get(podium!.year - 1)?.rank;
          const moved = before === undefined ? null : before - place.rank;
          return {
            person: place.person,
            name: place.name,
            rank: place.rank,
            book: place.book,
            year: podium!.year,
            detail: rankOf.get(place.person)?.get(podium!.year)?.leadingHolding ?? '',
            move:
              moved === null ? 'nuevo' : moved > 0 ? `▲ ${moved}` : moved < 0 ? `▼ ${-moved}` : '=',
            moveTitle:
              before === undefined
                ? `Sin estimación en ${podium!.year - 1}`
                : `${before}.º en ${podium!.year - 1}`,
          };
        });
  const stale = latestTop.filter(({ last }) => last.year < latestYear).length;

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
      {podium && topRows.length ? (
        <Panel
          id="empresarios-top"
          title={
            topYear === null
              ? `Los ${topRows.length} mayores empresarios por fortuna estimada en libros, último dato de cada uno (millones de dólares)`
              : `Los ${topRows.length} mayores empresarios por fortuna estimada en libros, ${podium.year} (millones de dólares)`
          }
          lede={
            topYear === null
              ? `Cada persona con su estimación más reciente.${stale ? ` ${topRows.length - stale} llegan a ${latestYear}; para las otras ${stale} el último documento público es anterior y el año va junto al nombre.` : ''} Elegí un año para ver el orden de ese año solo. Toca un nombre para abrir su ficha.`
              : podium.places.length < TOP_PLACES
                ? `En ${podium.year} sólo ${podium.population} personas tienen participación y patrimonio públicos, así que hay ${podium.places.length} puestos y no diez${fullYears.length ? `; los diez completos están en ${fullYears.join(', ')}` : ''}. Toca un nombre para abrir su ficha.`
                : `Puesto entre las ${podium.population} personas con participación y patrimonio públicos ese año, y cuánto se movió cada una frente al año anterior. Toca un nombre para abrir su ficha.`
          }
          ledeText={
            topYear === null
              ? 'Cada persona con su estimación más reciente; el año va junto al nombre cuando es anterior.'
              : `Puesto entre las ${podium.population} personas con participación y patrimonio públicos en ${podium.year}.`
          }
          source={ESTIMATE_SOURCE}
          data={() => ({
            unidad: 'millones de dólares',
            columnas: [
              'Año',
              'Estimaciones calculables',
              'Puesto',
              'Persona',
              'Piso contable (millones de dólares)',
              'Mayor empresa',
            ],
            filas: [...board.podiums]
              .reverse()
              .flatMap((one) =>
                one.places.map((place) => [
                  one.year,
                  one.population,
                  place.rank,
                  place.name,
                  place.book,
                  rankOf.get(place.person)?.get(one.year)?.leadingHolding ?? null,
                ]),
              ),
          })}
        >
          <div className={styles.topBar}>
            <label className={styles.topYear}>
              <span>Año</span>
              <select
                value={topYear === null ? '' : String(podium.year)}
                onChange={(event) => {
                  if (!event.target.value) {
                    setTopYear(null);
                    return;
                  }
                  const chosen = Number(event.target.value);
                  setTopYear(chosen);
                  setYear(chosen);
                }}
              >
                <option value="">Último dato de cada uno</option>
                {[...board.podiums].reverse().map((one) => (
                  <option key={one.year} value={one.year}>
                    {one.year}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ol className={styles.topList}>
            {topRows.map((row) => {
              const peakBook = topRows[0]?.book ?? 1;
              return (
                <li key={row.person} className={styles.topRow}>
                  <span className={styles.topRank}>{row.rank}.º</span>
                  <button
                    type="button"
                    className={styles.personButton}
                    aria-controls="empresario-ficha"
                    aria-expanded={open === row.person}
                    onClick={() => {
                      setOpen(row.person);
                      setYear(row.year);
                    }}
                  >
                    <strong>{row.name}</strong>
                    <small>{row.detail}</small>
                  </button>
                  <span className={styles.topBarTrack} aria-hidden="true">
                    <span style={{ width: `${Math.max(2, (row.book / peakBook) * 100)}%` }} />
                  </span>
                  <span className={styles.topValue}>{usd(row.book)}</span>
                  <span className={styles.topMove} title={row.moveTitle}>
                    {row.move ?? ''}
                  </span>
                </li>
              );
            })}
          </ol>
          <ChartLegend
            items={[{ color: 'var(--official)', label: 'Piso contable (millones de dólares)' }]}
          />
          <details className="panel-note">
            <summary>Cómo leerlo</summary>
            <p>
              Ordena sólo a las personas con participación y patrimonio públicos: no es un ránking
              de fortunas reales. Con «Último dato de cada uno» cada persona entra con su estimación
              más reciente, y a la derecha va el año cuando no es el último publicado. Con un año
              elegido, ▲ y ▼ dicen cuántos puestos subió o bajó frente al año anterior; «nuevo», que
              ese año no tenía estimación. Un año con menos de diez personas calculables muestra
              menos puestos.
            </p>
          </details>
        </Panel>
      ) : null}

      {board.histories.length ? (
        <Panel
          id="empresarios-cintas"
          title={`Puesto de cada empresario entre los ${TOP_PLACES} primeros, ${board.podiums[0]?.year ?? ''}–${board.podiums.at(-1)?.year ?? ''} (puesto por año)`}
          lede="Cada cinta es una persona: sube cuando mejora su puesto y se corta el año en que no tiene estimación o queda fuera de los diez. Pasa por encima para ver el año; toca una cinta para resaltarla y abrir su ficha."
          ledeText="Cada cinta es una persona; se corta el año en que no tiene estimación o queda fuera de los diez."
          source={ESTIMATE_SOURCE}
          data={() => ({
            unidad: 'puesto',
            columnas: [
              'Persona',
              'Año',
              'Puesto',
              'Estimaciones calculables',
              'Piso contable (millones de dólares)',
            ],
            filas: board.histories.flatMap((history) =>
              history.years.map((row) => [
                history.name,
                row.year,
                row.rank,
                row.population,
                row.book,
              ]),
            ),
          })}
        >
          <OwnerRankRibbons
            histories={board.histories}
            places={TOP_PLACES}
            selected={open}
            onSelect={(person, chosen) => {
              setOpen(person);
              setYear(chosen);
            }}
          />
        </Panel>
      ) : null}

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

          {/* Las referencias del país son doce gráficos chicos: tres por fila, no doce apilados. */}
          <div className="grid-three">
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
      </div>
    </>
  );
}
