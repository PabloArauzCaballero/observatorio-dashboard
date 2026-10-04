'use client';

import { useMemo, useState } from 'react';
import { RankLines, seriesTone } from './charts';
import { RankRibbons, shortCompanyName } from './rank-ribbons';
import { TOP_TEN, TopTen } from './top-ten';
import type { RankLine } from './charts';
import { CompanyLogo } from './company-logo';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import { Pager } from './pager';
import { Panel } from '@/components/ui/panel';
import { ANY, additive, picked, toggle, without } from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { percent } from '@/lib/exporters-board';
import type { Exporter, ExportersBoard, ReputationSeat } from '@/lib/exporters-board';

/**
 * Quién está mejor visto en Bolivia, edición por edición desde 2013.
 *
 * El capítulo lee el monitor Merco entero —las cien empresas de cada una de sus
 * trece ediciones, con la puntuación que las separa— y lo ordena en cinco
 * piezas, de lo que se lee de un vistazo a lo que se explora:
 *
 * 1. **El podio de la edición**, con la marca de cada empresa y cuánto se movió
 *    desde la anterior. Es lo que el público conoce del monitor.
 * 2. **El ránking entero**, filtrable por sector, por nombre, por movimiento y
 *    por si la empresa además exporta. La puntuación va como barra porque es
 *    lo que el puesto esconde: entre el primero y el segundo puede haber
 *    quinientos puntos o cincuenta.
 * 3. **La trayectoria**, con el puesto de cada empresa elegida en cada edición.
 *    Un puesto solo no dice nada; que Embol pase del cuarto al segundo sí.
 * 4. **El ránking sectorial**, que vale más que el general para un tablero
 *    económico: el general son marcas de consumo, el sectorial nombra a la
 *    primera minera, la primera aceitera y la primera constructora.
 * 5. **El cruce con las exportadoras**, corto a propósito: lo que Bolivia
 *    vende lo extraen y lo muelen empresas que ningún consumidor nombra.
 *
 * Los filtros se cruzan como en el resto del tablero: el sector recorta el
 * ránking y las tarjetas sectoriales, la búsqueda recorta las dos, y la lista
 * de sectores del carril cuenta lo que queda con los otros filtros puestos.
 */

/** Quién publica el monitor: lo que va en el pie de cada panel y en cada archivo que se baja. */
const SOURCE = 'Merco (Monitor Empresarial de Reputación Corporativa)';

const PAGE = 20;
const FOLLOWED_MAX = 6;
const TOP_SCORE = 10_000;
/** El puntaje del centésimo en todas las ediciones: el fondo de la barra. */
const FLOOR_SCORE = 3_000;

type Movement = 'all' | 'up' | 'down' | 'new';

const MOVEMENTS: ReadonlyArray<{ value: Movement; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'up', label: 'Suben' },
  { value: 'down', label: 'Bajan' },
  { value: 'new', label: 'Nuevas' },
];

/** «CADENA DE FARMACIAS» → «Cadena de farmacias», que es como se escribe un rubro. */
function sectorLabel(sector: string): string {
  const lower = sector.toLocaleLowerCase('es');
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
}

/**
 * Cómo se nombra una edición. Merco llama «2025/26» a la que el corpus guarda
 * como 2026, el último año de su rótulo; las demás llevan un año solo.
 */
const editionLabel = (year: number): string => (year === 2026 ? '2025-26' : String(year));

const plain = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLocaleLowerCase('es');

const points = (value: number): string => value.toLocaleString('es-BO');

/**
 * El fondo del eje de la trayectoria: el peor puesto dibujado, redondeado a un
 * escalón legible. Con el eje fijo en cien, las cinco primeras quedaban
 * apretadas en la décima parte de arriba y el resto del gráfico vacío.
 */
function floorOf(lines: readonly RankLine[]): number {
  const worst = Math.max(1, ...lines.flatMap((line) => [...line.ranks.values()]));
  return [10, 25, 50, 100].find((step) => worst <= step) ?? 100;
}

/** Lo que un puesto hizo desde la edición anterior, con su signo y su texto. */
interface Move {
  kind: 'up' | 'down' | 'same' | 'new';
  by: number;
}

function moveOf(rank: number, before: number | undefined): Move {
  if (before === undefined) return { kind: 'new', by: 0 };
  if (before === rank) return { kind: 'same', by: 0 };
  return before > rank ? { kind: 'up', by: before - rank } : { kind: 'down', by: rank - before };
}

function MoveBadge({ move, previous }: { move: Move; previous: number | null }) {
  if (previous === null) return null;
  if (move.kind === 'new') {
    return <span className="rep-move rep-move-new">Nueva</span>;
  }
  if (move.kind === 'same') {
    return (
      <span className="rep-move rep-move-same" title={`Mismo puesto que en ${previous}`}>
        = igual
      </span>
    );
  }
  const up = move.kind === 'up';
  return (
    <span
      className={up ? 'rep-move rep-move-up' : 'rep-move rep-move-down'}
      title={`${up ? 'Sube' : 'Baja'} ${move.by} puesto${move.by === 1 ? '' : 's'} desde ${previous}`}
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {move.by}
    </span>
  );
}

/** Una edición del monitor con todo lo que el capítulo necesita de ella, calculado una vez. */
function useEdition(board: ExportersBoard, year: number) {
  return useMemo(() => {
    const previous = board.editions.find((edition) => edition < year) ?? null;
    const seats = board.general.filter((seat) => seat.year === year);
    const before = new Map(
      board.general.filter((seat) => seat.year === previous).map((seat) => [seat.slug, seat.rank]),
    );
    const sectorSeats = board.sectors.filter((seat) => seat.year === year);
    const sectorOf = new Map<string, string>();
    for (const seat of sectorSeats) {
      if (seat.sector && !sectorOf.has(seat.slug)) sectorOf.set(seat.slug, seat.sector);
    }
    return { previous, seats, before, sectorSeats, sectorOf };
  }, [board, year]);
}

export function ReputationExplorer({ board }: { board: ExportersBoard }) {
  const [year, setYear] = useState<number>(board.editions[0] ?? 0);
  const [sector, setSector] = useState<Choice>(ANY);
  const [query, setQuery] = useState('');
  const [movement, setMovement] = useState<Movement>('all');
  const [onlyExporters, setOnlyExporters] = useState(false);
  const [offset, setOffset] = useState(0);
  const [followed, setFollowed] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const edition = useEdition(board, year);
  const exporters = useMemo(
    () => new Map<string, Exporter>(board.exporters.map((row) => [row.slug, row])),
    [board],
  );

  const needle = plain(query.trim());
  const matches = (seat: ReputationSeat): boolean =>
    (!needle || plain(seat.name).includes(needle)) && (!onlyExporters || exporters.has(seat.slug));
  const inSector = (slug: string): boolean =>
    sector.size === 0 || sector.has(edition.sectorOf.get(slug) ?? '');
  const moving = (seat: ReputationSeat): boolean => {
    if (movement === 'all' || edition.previous === null) return true;
    const move = moveOf(seat.rank, edition.before.get(seat.slug));
    return move.kind === movement;
  };

  const rows = edition.seats.filter((seat) => matches(seat) && inSector(seat.slug) && moving(seat));
  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(offset, offset + PAGE);

  /*
   * Los sectores del carril cuentan lo que queda con los OTROS filtros puestos
   * —búsqueda, movimiento, exportadoras— y no con el propio sector, que es lo
   * que hace que elegir uno no deje a los demás en cero.
   */
  const sectorChoices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const seat of edition.sectorSeats) {
      if (!seat.sector) continue;
      const passes =
        (!needle || plain(seat.name).includes(needle)) &&
        (!onlyExporters || exporters.has(seat.slug));
      counts.set(seat.sector, (counts.get(seat.sector) ?? 0) + (passes ? 1 : 0));
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, label: sectorLabel(value), count }))
      .sort((left, right) => left.label.localeCompare(right.label, 'es'));
  }, [edition.sectorSeats, needle, onlyExporters, exporters]);

  const reset = (): void => {
    setSector(ANY);
    setQuery('');
    setMovement('all');
    setOnlyExporters(false);
    setOffset(0);
  };
  const active =
    (sector.size ? 1 : 0) +
    (needle ? 1 : 0) +
    (movement !== 'all' ? 1 : 0) +
    (onlyExporters ? 1 : 0);

  /*
   * Las empresas de la trayectoria: las que el lector eligió o, mientras no
   * elija ninguna, las cinco primeras de la edición que está mirando.
   */
  const trail = followed.length ? followed : edition.seats.slice(0, 5).map((seat) => seat.slug);
  const follow = (slug: string): void => {
    setFollowed((current) => {
      const base = current.length ? current : trail;
      if (base.includes(slug)) return base.filter((one) => one !== slug);
      return [...base, slug].slice(-FOLLOWED_MAX);
    });
  };

  const names = useMemo(() => {
    const out = new Map<string, string>();
    for (const seat of [...board.general, ...board.sectors]) {
      if (!out.has(seat.slug)) out.set(seat.slug, seat.name);
    }
    return out;
  }, [board]);

  const years = useMemo(() => [...board.editions].sort((left, right) => left - right), [board]);
  const lines: RankLine[] = trail.map((slug, index) => ({
    key: slug,
    label: names.get(slug) ?? slug,
    tone: seriesTone(index),
    ranks: new Map(
      board.general.filter((seat) => seat.slug === slug).map((seat) => [seat.year, seat.rank]),
    ),
  }));

  const newcomers =
    edition.previous === null
      ? null
      : edition.seats.filter((seat) => !edition.before.has(seat.slug)).length;
  const exportersHere = edition.seats.filter((seat) => exporters.has(seat.slug)).length;
  const podium = edition.seats.slice(0, 3);
  const sectorNames = [...new Set(edition.sectorSeats.map((seat) => seat.sector))].filter(
    (value): value is string => Boolean(value),
  );

  const sectorCards = sectorNames
    .filter((name) => sector.size === 0 || sector.has(name))
    .map((name) => ({
      name,
      seats: edition.sectorSeats.filter((seat) => seat.sector === name && matches(seat)),
    }))
    .filter((card) => card.seats.length);

  /** Las que alguna vez estuvieron entre las diez primeras del ránking general: una cinta cada una. */
  const ribbons = useMemo(() => {
    const bySlug = new Map<
      string,
      { key: string; name: string; points: Array<{ period: number; rank: number }> }
    >();
    for (const seat of board.general) {
      const one = bySlug.get(seat.slug) ?? { key: seat.slug, name: seat.name, points: [] };
      one.points.push({ period: seat.year, rank: seat.rank });
      bySlug.set(seat.slug, one);
    }
    return [...bySlug.values()].filter((one) => one.points.some((point) => point.rank <= TOP_TEN));
  }, [board]);
  const scoreOf = useMemo(
    () => new Map(board.general.map((seat) => [`${seat.slug}@${seat.year}`, seat.score])),
    [board],
  );
  const topRows = [...edition.seats]
    .sort((left, right) => left.rank - right.rank)
    .filter((seat) => seat.rank <= TOP_TEN)
    .map((seat) => ({
      key: seat.slug,
      rank: seat.rank,
      name: seat.name,
      detail: edition.sectorOf.get(seat.slug)
        ? sectorLabel(edition.sectorOf.get(seat.slug) ?? '')
        : undefined,
      value: (seat.score ?? FLOOR_SCORE) - FLOOR_SCORE,
      shown: seat.score !== null ? `${points(seat.score)} pts` : '—',
      before: edition.before.get(seat.slug),
      logo: true,
    }));

  if (!edition.seats.length) {
    return <div className="callout">Todavía no hay ránking general de reputación cargado.</div>;
  }

  return (
    <>
      {topRows.length ? (
        <Panel
          id="empresas-reputacion-top"
          title={`Las ${topRows.length} empresas con mejor reputación, Merco ${editionLabel(year)} (puntos Merco)`}
          lede={`Puesto entre las ${edition.seats.length} empresas que mide Merco, y cuánto se movió cada una frente a ${edition.previous === null ? 'la edición anterior' : editionLabel(edition.previous)}. Toca un nombre para resaltar su cinta.`}
          ledeText={`Puesto entre las ${edition.seats.length} empresas que mide Merco en ${editionLabel(year)}.`}
          source={SOURCE}
          data={() => ({
            unidad: 'puesto y puntos',
            columnas: ['Edición', 'Puesto', 'Empresa', 'Puntos Merco'],
            filas: [...board.general]
              .filter((seat) => seat.rank <= TOP_TEN)
              .sort((left, right) => right.year - left.year || left.rank - right.rank)
              .map((seat) => [editionLabel(seat.year), seat.rank, seat.name, seat.score]),
          })}
        >
          <TopTen
            rows={topRows}
            periods={board.editions}
            period={year}
            onPeriod={(when) => {
              setYear(when);
              setSector(ANY);
              setOffset(0);
            }}
            label={editionLabel}
            previous={edition.previous}
            selected={highlighted}
            onPick={(slug) => setHighlighted((current) => (current === slug ? null : slug))}
            legend={`Puntos Merco por encima de ${points(FLOOR_SCORE)}, el centésimo (10.000 = primera)`}
          />
          <details className="panel-note">
            <summary>Cómo leerlo</summary>
            <p>
              La barra arranca en {points(FLOOR_SCORE)} puntos, lo que saca el centésimo, y llega a
              10.000 con la primera. ▲ y ▼ dicen cuántos puestos subió o bajó frente a la edición
              anterior; «nuevo», que no estaba entre las cien. Mide reputación percibida, no tamaño.
            </p>
          </details>
        </Panel>
      ) : null}

      {ribbons.length && years.length > 1 ? (
        <Panel
          id="empresas-reputacion-cintas"
          title={`Puesto de cada empresa entre las ${TOP_TEN} de mejor reputación, ${years[0] ?? ''}–${editionLabel(years.at(-1) ?? 0)} (puesto por edición)`}
          lede="Cada cinta es una empresa: sube cuando mejora su puesto y se corta la edición en que queda fuera de las diez. Pasa por encima para ver la edición; toca una cinta para resaltarla."
          ledeText="Cada cinta es una empresa; se corta la edición en que queda fuera de las diez."
          source={SOURCE}
          data={() => ({
            unidad: 'puesto',
            columnas: ['Empresa', 'Edición', 'Puesto', 'Puntos Merco'],
            filas: ribbons.flatMap((one) =>
              one.points.map((point) => [
                one.name,
                editionLabel(point.period),
                point.rank,
                scoreOf.get(`${one.key}@${point.period}`) ?? null,
              ]),
            ),
          })}
        >
          <RankRibbons
            series={ribbons}
            periods={years}
            places={TOP_TEN}
            selected={highlighted}
            onSelect={(slug, when) => {
              setHighlighted(slug);
              setYear(when);
              setSector(ANY);
              setOffset(0);
            }}
            label={editionLabel}
            shorten={shortCompanyName}
            describe={(slug, when) => {
              const score = scoreOf.get(`${slug}@${when}`);
              return score !== null && score !== undefined ? [`${points(score)} puntos Merco`] : [];
            }}
            subject="empresa"
            highlight="Empresa resaltada"
            others="Las demás empresas"
          />
        </Panel>
      ) : null}

      <Panel
        id="empresas-reputacion-resumen"
        className="emp-hero rep-hero"
        title={`Reputación empresarial: ránking Merco ${editionLabel(year)} (puesto y puntuación)`}
        lede="Merco mide la reputación percibida de cien empresas cada año: no es tamaño, solvencia ni conducta."
        source={SOURCE}
        data={() => ({
          unidad: 'puesto y puntos',
          columnas: ['Cifra', 'Valor', 'Detalle'],
          filas: [
            [
              'Edición',
              editionLabel(year),
              `${board.editions.length} publicadas, desde ${years[0] ?? '—'}`,
            ],
            ['Empresas medidas', edition.seats.length, `en ${sectorNames.length} sectores`],
            [
              'Nuevas en la lista',
              newcomers,
              edition.previous === null ? 'primera edición' : `no estaban en ${edition.previous}`,
            ],
            [
              'También exportan',
              exportersHere,
              `de las ${board.exporters.length} mayores exportadoras de ${board.exportYear ?? '—'}`,
            ],
            ...podium.map((seat) => [
              `Puesto ${seat.rank}`,
              seat.name,
              seat.score !== null ? `${points(seat.score)} pts` : null,
            ]),
          ],
        })}
      >
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Edición</span>
            <span className="stat-value">{editionLabel(year)}</span>
            <span className="stat-hint">
              {board.editions.length} publicadas, desde {years[0] ?? '—'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Empresas medidas</span>
            <span className="stat-value">{edition.seats.length}</span>
            <span className="stat-hint">en {sectorNames.length} sectores</span>
          </div>
          <div className="stat">
            <span className="stat-label">Nuevas en la lista</span>
            <span className="stat-value">{newcomers ?? '—'}</span>
            <span className="stat-hint">
              {edition.previous === null ? 'primera edición' : `no estaban en ${edition.previous}`}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">También exportan</span>
            <span className="stat-value">{exportersHere}</span>
            <span className="stat-hint">
              de las {board.exporters.length} mayores exportadoras de {board.exportYear ?? '—'}
            </span>
          </div>
        </div>

        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            Merco (Monitor Empresarial de Reputación Corporativa) mide cada año a cien empresas con
            cinco evaluaciones, trece fuentes, más de mil seiscientas encuestas y revisión
            independiente de KPMG bajo norma ISAE 3000. Mide <strong>reputación percibida</strong>:
            no es tamaño, solvencia ni conducta. La puntuación va de 10.000 para la primera a 3.000
            para la centésima y sólo se compara dentro de una misma edición.
          </p>
        </details>
      </Panel>

      <div className="workspace">
        <aside className="rail" id="reputacion-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">
              {active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}
            </span>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Edición
            </div>
            <div className="rail-field">
              <select
                aria-label="Edición del monitor"
                value={year}
                onChange={(event) => {
                  setYear(Number(event.target.value));
                  setSector(ANY);
                  setOffset(0);
                }}
              >
                {board.editions.map((edition) => (
                  <option key={edition} value={edition}>
                    Merco {editionLabel(edition)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="buscar" size={13} />
              Empresa
            </div>
            <div className="rail-field">
              <input
                type="search"
                placeholder="Buscar por nombre…"
                aria-label="Buscar una empresa por su nombre"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOffset(0);
                }}
              />
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="tendencia" size={13} />
              Movimiento desde {edition.previous ?? '—'}
            </div>
            <div className="rail-pills">
              {MOVEMENTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={movement === option.value ? 'chip chip-on' : 'chip'}
                  aria-pressed={movement === option.value}
                  disabled={edition.previous === null && option.value !== 'all'}
                  onClick={() => {
                    setMovement(option.value);
                    setOffset(0);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <label className="rep-toggle">
              <input
                type="checkbox"
                checked={onlyExporters}
                onChange={(event) => {
                  setOnlyExporters(event.target.checked);
                  setOffset(0);
                }}
              />
              <span>
                <Icon name="globo" size={13} /> Sólo las que también exportan
              </span>
            </label>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Sector ({editionLabel(year)})
              <PickedCount choice={sector} />
            </div>
            <FilterHint />
            <div className="rail-list rail-list-cut">
              {sectorChoices.map((option) => {
                const on = picked(sector, option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={on ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={on}
                    onClick={(event) => {
                      setSector((current) => toggle(current, option.value, additive(event)));
                      setOffset(0);
                    }}
                  >
                    <span className="rail-name">{option.label}</span>
                    <span className="rail-n">{option.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {active ? (
            <div className="rail-sec">
              <div className="rail-pills">
                {[...sector].sort().map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="chip chip-on chip-wide"
                    onClick={() => setSector((current) => without(current, value))}
                    title={`Quitar ${sectorLabel(value)} del filtro`}
                  >
                    <span className="chip-text">{sectorLabel(value)}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
                <button type="button" className="chip" onClick={reset}>
                  Limpiar todo
                </button>
              </div>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main">
          <Panel
            id="empresas-reputacion-ranking"
            title={`Ránking general ${editionLabel(year)}: puesto y puntuación Merco (10.000 = primera)`}
            lede={
              rows.length === edition.seats.length
                ? `Las ${rows.length} empresas de la edición.`
                : `${rows.length} de ${edition.seats.length} empresas con los filtros puestos.`
            }
            source={SOURCE}
            data={() => ({
              unidad: 'puesto y puntos',
              columnas: ['Puesto', 'Empresa', 'Sector', 'Puntuación', 'Movimiento', 'Exportadora'],
              filas: rows.map((seat) => {
                const move = moveOf(seat.rank, edition.before.get(seat.slug));
                const sectorName = edition.sectorOf.get(seat.slug);
                const exporter = exporters.get(seat.slug);
                return [
                  seat.rank,
                  seat.name,
                  sectorName ? sectorLabel(sectorName) : null,
                  seat.score,
                  edition.previous === null
                    ? null
                    : move.kind === 'new'
                      ? 'nueva'
                      : move.kind === 'same'
                        ? 'igual'
                        : `${move.kind === 'up' ? 'sube' : 'baja'} ${move.by}`,
                  exporter ? `puesto ${exporter.rank}` : null,
                ];
              }),
            })}
          >
            <details className="panel-note">
              <summary>Cómo leerlo</summary>
              <p>
                La barra es la puntuación sobre la escala de la edición; el marcador de la derecha,
                el movimiento desde {edition.previous ?? 'la edición anterior'}. Pulsa{' '}
                <Icon name="linea" size={12} /> para seguir una empresa en la trayectoria de abajo.
              </p>
            </details>

            {shown.length ? (
              <ol className="rep-list">
                {shown.map((seat) => {
                  const exporter = exporters.get(seat.slug);
                  const sectorName = edition.sectorOf.get(seat.slug);
                  const width =
                    seat.score === null
                      ? 0
                      : Math.max(2, ((seat.score - FLOOR_SCORE) / (TOP_SCORE - FLOOR_SCORE)) * 100);
                  const isFollowed = trail.includes(seat.slug);
                  return (
                    <li key={seat.slug} className="rep-row">
                      <span className="rep-rank">{seat.rank}</span>
                      <CompanyLogo slug={seat.slug} name={seat.name} size={36} />
                      <span className="rep-who">
                        <span className="rep-name">{seat.name}</span>
                        <span className="rep-tags">
                          {sectorName ? <span>{sectorLabel(sectorName)}</span> : null}
                          {exporter ? (
                            <span className="rep-tag-export">
                              Exporta · puesto {exporter.rank} ({percent(exporter.share)})
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span
                        className="rep-score"
                        aria-label={`Puntuación ${seat.score ?? 'sin dato'}`}
                      >
                        <span className="rep-bar">
                          <span style={{ width: `${width}%` }} />
                        </span>
                        <span className="rep-score-n">
                          {seat.score === null ? '—' : points(seat.score)}
                        </span>
                      </span>
                      <MoveBadge
                        move={moveOf(seat.rank, edition.before.get(seat.slug))}
                        previous={edition.previous}
                      />
                      <button
                        type="button"
                        className={isFollowed ? 'rep-follow rep-follow-on' : 'rep-follow'}
                        aria-pressed={isFollowed}
                        onClick={() => follow(seat.slug)}
                        title={
                          isFollowed
                            ? `Quitar ${seat.name} de la trayectoria`
                            : `Seguir a ${seat.name} en la trayectoria`
                        }
                      >
                        <Icon name="linea" size={14} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="callout">
                Ninguna empresa de {editionLabel(year)} pasa estos filtros.{' '}
                <button type="button" className="chip" onClick={reset}>
                  Limpiar filtros
                </button>
              </div>
            )}

            <Pager
              page={page}
              pages={pages}
              first={rows.length ? offset + 1 : 0}
              last={Math.min(offset + PAGE, rows.length)}
              total={rows.length}
              pageSize={PAGE}
              onGo={setOffset}
              where="ránking de reputación"
              noun="empresas"
            />
          </Panel>

          <Panel
            id="empresas-reputacion-trayectoria"
            title={`Trayectoria en el ránking general, ${years[0] ?? '—'}–${years.at(-1) ?? '—'} (puesto, 1 = mejor)`}
            lede={
              followed.length
                ? 'Las empresas que elegiste en el ránking.'
                : `Las cinco primeras de ${editionLabel(year)}; elige otras con el botón de cada fila.`
            }
            source={SOURCE}
          >
            <details className="panel-note">
              <summary>Cómo leerlo</summary>
              <p>
                El eje va invertido para que mejorar se lea como subir. Un hueco en la línea es una
                edición en que la empresa no entró entre las cien.
              </p>
            </details>
            <div className="rep-followed">
              {trail.map((slug, index) => (
                <button
                  key={slug}
                  type="button"
                  className="chip chip-on chip-wide"
                  onClick={() => follow(slug)}
                  title={`Quitar ${names.get(slug) ?? slug} de la trayectoria`}
                >
                  <i
                    className="rep-key"
                    style={{ background: seriesTone(index) }}
                    aria-hidden="true"
                  />
                  <CompanyLogo slug={slug} name={names.get(slug) ?? slug} size={18} />
                  <span className="chip-text">{names.get(slug) ?? slug}</span>
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              {followed.length ? (
                <button type="button" className="chip" onClick={() => setFollowed([])}>
                  Volver a las cinco primeras
                </button>
              ) : null}
            </div>
            <RankLines years={years} lines={lines} floor={floorOf(lines)} />
          </Panel>

          <Panel
            id="empresas-reputacion-sectores"
            title={`Ránking sectorial ${editionLabel(year)}: puesto dentro de cada sector (puesto)`}
            lede="Merco publica el orden dentro de cada sector, no una puntuación."
            source={SOURCE}
            data={() => ({
              unidad: 'puesto',
              columnas: ['Sector', 'Puesto', 'Empresa', 'Exportadora'],
              filas: sectorCards.flatMap((card) =>
                card.seats.map((seat) => [
                  sectorLabel(card.name),
                  seat.rank,
                  seat.name,
                  exporters.has(seat.slug) ? 'sí' : 'no',
                ]),
              ),
            })}
          >
            <details className="panel-note">
              <summary>Cómo leerlo</summary>
              <p>
                Vale más que el general para leer la economía: el general está dominado por marcas
                de consumo, y aquí aparecen la primera minera, la primera aceitera, la primera
                constructora y la primera aseguradora.
              </p>
            </details>
            {sectorCards.length ? (
              <div className="rep-sectors">
                {sectorCards.map((card) => (
                  <section key={card.name} className="rep-sector">
                    <h4>{sectorLabel(card.name)}</h4>
                    <ol>
                      {card.seats.map((seat) => (
                        <li key={seat.slug}>
                          <span className="rep-sector-rank">{seat.rank}</span>
                          <CompanyLogo slug={seat.slug} name={seat.name} size={24} />
                          <span className="rep-sector-name">{seat.name}</span>
                          {exporters.has(seat.slug) ? (
                            <span
                              className="rep-tag-export"
                              title="También está entre las mayores exportadoras"
                            >
                              Exporta
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            ) : (
              <div className="callout">
                Ningún sector de {editionLabel(year)} tiene empresas con estos filtros.
              </div>
            )}
          </Panel>

          <Panel
            id="empresas-reputacion-cruce"
            title={`Las que están en las dos listas: reputación Merco y ránking exportador ${board.exportYear ?? ''} (cantidad de empresas)`}
            lede={`Son ${board.crossings.length} las que Merco midió en alguna edición y están entre las ${board.exporters.length} mayores exportadoras.`}
            source={`${SOURCE}; ránking de exportadoras de «Comercio exterior»`}
            data={() => ({
              unidad: 'puesto',
              columnas: [
                'Empresa',
                'Puesto exportador',
                'Parte de las exportaciones (%)',
                'Puesto Merco',
                'Sector Merco',
                'Edición Merco',
              ],
              filas: board.crossings.map((row) => [
                row.name,
                row.exportRank,
                row.share,
                row.reputationRank,
                row.sector ? sectorLabel(row.sector) : null,
                editionLabel(row.reputationYear),
              ]),
            })}
          >
            <details className="panel-note">
              <summary>Cómo leerlo</summary>
              <p>
                Empresas que Merco midió en alguna edición y que además figuran entre las{' '}
                {board.exporters.length} mayores exportadoras de «Comercio exterior». Son{' '}
                <strong>{board.crossings.length}</strong>, y sólo{' '}
                <strong>
                  {
                    board.crossings.filter((row) => row.reputationYear === board.reputationYear)
                      .length
                  }
                </strong>{' '}
                siguen en la edición{' '}
                {board.reputationYear ? editionLabel(board.reputationYear) : ''}: lo que el país
                vende afuera lo producen empresas que el público no reconoce, y lo que el público
                reconoce se vende puertas adentro.
              </p>
            </details>
            {board.crossings.length ? (
              <div className="rep-cross">
                {board.crossings.map((row) => (
                  <div
                    key={row.slug}
                    className={
                      row.reputationYear === board.reputationYear
                        ? 'rep-cross-card'
                        : 'rep-cross-card rep-cross-past'
                    }
                  >
                    <CompanyLogo slug={row.slug} name={row.name} size={40} />
                    <div className="rep-cross-body">
                      <span className="rep-name">{row.name}</span>
                      <span className="rep-cross-figures">
                        <span>
                          Exporta <b>#{row.exportRank}</b> · {percent(row.share)}
                        </span>
                        <span>
                          Merco <b>#{row.reputationRank}</b>{' '}
                          {row.sector ? `en ${sectorLabel(row.sector)}` : 'de las cien'} ·{' '}
                          {row.reputationYear === board.reputationYear
                            ? editionLabel(row.reputationYear)
                            : `última vez en ${editionLabel(row.reputationYear)}`}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="callout">
                {board.exporters.length
                  ? 'Ninguna de las exportadoras del ránking aparece en el monitor de reputación con los datos cargados hoy.'
                  : 'El cruce se llena cuando el núcleo haya sembrado también el registro de exportadoras.'}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
