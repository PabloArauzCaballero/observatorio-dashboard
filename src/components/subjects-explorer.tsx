'use client';

import { useState } from 'react';
import { HeatGrid, MonthlyBars, ShareBars, TermCloud, YearlyBars } from './charts';
import type { CloudWord, HeatCell, MonthBar, ShareSlice, YearBar } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { TermMonth, TermTotal } from '@/lib/series';

/**
 * What the country's press has talked about: first across every subject, then
 * inside the one the reader opened.
 *
 * The section is read in that order on purpose. Two hundred watched subjects
 * cannot be understood one chart at a time, so the page opens on the whole
 * watchlist at once — the cloud, the families ranked against each other, the
 * archive month by month, and how adversely each family is covered — and only
 * then narrows to a single subject. Anything else asks the reader to choose a
 * subject before the page has given them a reason to prefer one.
 *
 * Every filter is in the docked pane on the left, where the rest of the report
 * keeps its filters, and every panel to the right of it obeys them. The one
 * rule the panels follow is that a chart never filters by its own dimension:
 * the ranking of families still shows every family when one is chosen — with
 * the chosen one marked — because a bar chart of one bar is not a ranking, and
 * a subject's year-by-year breakdown still shows every year. Where that
 * happens, the caption says so.
 *
 * And the numbers behind all of it are one click away in both formats, carrying
 * the same selection the panels are drawing: a file of everything, handed to a
 * reader looking at a filtered chart, is the quickest way to make them distrust
 * both.
 */

const FAMILY_LABEL: Record<string, string> = {
  HIDROCARBUROS: 'Hidrocarburos',
  ENERGIA: 'Energía',
  CAMBIARIO: 'Tipo de cambio',
  MONETARIO: 'Dinero y banca',
  PRECIOS: 'Precios',
  FISCAL: 'Cuentas del Estado',
  COMERCIO_EXTERIOR: 'Comercio exterior',
  COMERCIO_INTERNO: 'Comercio interno',
  SECTOR_REAL: 'Sectores productivos',
  LABORAL: 'Trabajo',
  TRANSPORTE: 'Transporte',
  INFRAESTRUCTURA: 'Infraestructura',
  SERVICIOS_BASICOS: 'Servicios básicos',
  TECNOLOGIA: 'Tecnología',
  VIVIENDA: 'Vivienda',
  TURISMO: 'Turismo',
  SALUD: 'Salud',
  EDUCACION: 'Educación',
  CONFLICTO: 'Conflicto',
  INSTITUCIONAL: 'Instituciones',
  SEGURIDAD: 'Seguridad',
  AMBIENTE: 'Ambiente',
  SOCIAL: 'Social',
  ACTIVIDAD: 'Actividad económica',
};

const FAMILY_ICON: Record<string, IconName> = {
  HIDROCARBUROS: 'gota',
  ENERGIA: 'rayo',
  CAMBIARIO: 'balanza',
  MONETARIO: 'monedas',
  PRECIOS: 'etiqueta',
  FISCAL: 'banco',
  COMERCIO_EXTERIOR: 'globo',
  COMERCIO_INTERNO: 'tienda',
  SECTOR_REAL: 'fabrica',
  LABORAL: 'personas',
  TRANSPORTE: 'camion',
  INFRAESTRUCTURA: 'casco',
  SERVICIOS_BASICOS: 'gota',
  TECNOLOGIA: 'chip',
  VIVIENDA: 'edificio',
  TURISMO: 'mapa',
  SALUD: 'corazon',
  EDUCACION: 'hoja',
  CONFLICTO: 'rayo',
  INSTITUCIONAL: 'banco',
  SEGURIDAD: 'escudo',
  AMBIENTE: 'hoja',
  SOCIAL: 'personas',
  ACTIVIDAD: 'tendencia',
};

/** The tones that make up the adverse share, and the ones that do not. */
const TONES: Array<{
  key: 'alarma' | 'deterioro' | 'conflicto' | 'incertidumbre' | 'mejora' | 'medida' | 'neutro';
  label: string;
  adverse: boolean;
}> = [
  { key: 'alarma', label: 'Alarma', adverse: true },
  { key: 'deterioro', label: 'Deterioro', adverse: true },
  { key: 'conflicto', label: 'Conflicto', adverse: true },
  { key: 'incertidumbre', label: 'Incertidumbre', adverse: true },
  { key: 'mejora', label: 'Mejora', adverse: false },
  { key: 'medida', label: 'Medida tomada', adverse: false },
  { key: 'neutro', label: 'Sin marca', adverse: false },
];

const count = (value: number): string => value.toLocaleString('es-BO');
const percent = (value: number): string =>
  value.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** A month written the way a caption says it, not the way a database stores it. */
function sayMonth(month: string): string {
  const [year = '', index = ''] = month.split('-');
  const names = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return `${names[Number(index) - 1] ?? index} de ${year}`;
}

/** The adverse part of one month: the four tones that read badly. */
const adverseOf = (row: TermMonth): number =>
  row.alarma + row.deterioro + row.conflicto + row.incertidumbre;

/**
 * One subject, folded from whichever months survived the filters.
 *
 * The database publishes the same totals over the whole archive, and they are
 * the wrong ones here: the moment a reader picks a year, a total that still
 * counts every year is a number the charts beside it contradict. So the totals
 * are folded from the rows actually on screen — a few thousand of them, which
 * is cheaper than the round trip it would take to ask the database again.
 */
interface Rollup {
  term: string;
  label: string;
  family: string;
  mentions: number;
  adverse: number;
  months: number;
  firstMonth: string;
  lastMonth: string;
  peakMonth: string;
  peakMentions: number;
  /** Percent of the subject's own mentions, or null where it has none. */
  adverseShare: number | null;
}

function rollUp(rows: readonly TermMonth[]): Rollup[] {
  const held = new Map<string, Rollup>();
  for (const row of rows) {
    const kept = held.get(row.term);
    const adverse = adverseOf(row);
    if (!kept) {
      held.set(row.term, {
        term: row.term,
        label: row.label,
        family: row.family,
        mentions: row.mentions,
        adverse,
        months: 1,
        firstMonth: row.month,
        lastMonth: row.month,
        peakMonth: row.month,
        peakMentions: row.mentions,
        adverseShare: null,
      });
      continue;
    }
    kept.mentions += row.mentions;
    kept.adverse += adverse;
    kept.months += 1;
    if (row.month < kept.firstMonth) kept.firstMonth = row.month;
    if (row.month > kept.lastMonth) kept.lastMonth = row.month;
    if (row.mentions > kept.peakMentions) {
      kept.peakMentions = row.mentions;
      kept.peakMonth = row.month;
    }
  }
  const out = [...held.values()];
  for (const one of out) {
    one.adverseShare = one.mentions > 0 ? (one.adverse / one.mentions) * 100 : null;
  }
  return out.sort((left, right) => right.mentions - left.mentions);
}

/** Mentions and their adverse part, grouped by whatever key the caller names. */
function foldBy(
  rows: readonly TermMonth[],
  key: (row: TermMonth) => string,
): Map<string, { mentions: number; adverse: number }> {
  const held = new Map<string, { mentions: number; adverse: number }>();
  for (const row of rows) {
    const at = key(row);
    const kept = held.get(at) ?? { mentions: 0, adverse: 0 };
    kept.mentions += row.mentions;
    kept.adverse += adverseOf(row);
    held.set(at, kept);
  }
  return held;
}

const sumOf = (folds: Iterable<{ mentions: number }>): number => {
  let total = 0;
  for (const fold of folds) total += fold.mentions;
  return total;
};

export function SubjectsExplorer({ months, totals }: { months: TermMonth[]; totals: TermTotal[] }) {
  const [family, setFamily] = useState('');
  const [term, setTerm] = useState('');
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');

  /*
   * Said before anything is folded, and after the hooks so the order of hooks
   * never changes: the section is deployed from a different repository than the
   * one that migrates, and between the two deploys this model has no rows.
   */
  if (!months.length) {
    return (
      <div className="callout">
        Todavía no hay lecturas por tema. El modelo existe en la base; se llena cuando se refresca
        la copia del corpus de prensa.
      </div>
    );
  }

  const query = search.trim().toLocaleLowerCase('es');
  const inSearch = (row: TermMonth): boolean =>
    !query ||
    row.label.toLocaleLowerCase('es').includes(query) ||
    row.term.toLocaleLowerCase('es').includes(query);
  const inYear = (row: TermMonth): boolean => !year || row.month.slice(0, 4) === year;
  const inFamily = (row: TermMonth): boolean => !family || row.family === family;

  /*
   * Three sets, because no list of options may be narrowed by the dimension it
   * chooses. A year list narrowed by the chosen year offers one year; a family
   * list narrowed by the chosen family offers one family — and a reader who
   * clicks one can then never reach another without first finding the way out.
   */
  const searched = months.filter(inSearch);
  const forYears = searched.filter(inFamily);
  const forFamilies = searched.filter(inYear);
  /** What every panel of the panorama draws: the whole selection but the subject. */
  const scope = forFamilies.filter(inFamily);

  const ranked = rollUp(scope);
  const missing = term !== '' && !ranked.some((one) => one.term === term);
  const subject = term ? ranked.find((one) => one.term === term) : ranked[0];

  const yearCounts = foldBy(forYears, (row) => row.month.slice(0, 4));
  const years = [...yearCounts.keys()].sort();
  const familyCounts = foldBy(forFamilies, (row) => row.family);
  const families = [...familyCounts.entries()].sort(
    (left, right) => right[1].mentions - left[1].mentions,
  );

  const active = (year ? 1 : 0) + (family ? 1 : 0) + (term ? 1 : 0) + (query ? 1 : 0);
  const clearAll = (): void => {
    setYear('');
    setFamily('');
    setTerm('');
    setSearch('');
  };

  /** The file carries exactly the selection the panels are drawing. */
  const exportQuery = (subjectTerm?: string): string => {
    const params = new URLSearchParams({ dataset: 'temas' });
    if (family) params.set('familia', family);
    if (subjectTerm) params.set('termino', subjectTerm);
    if (year) params.set('anio', year);
    if (query) params.set('buscar', search.trim());
    return params.toString();
  };
  /**
   * A name that says what is inside the file.
   *
   * Four downloads taken from four different selections all arrive as
   * `observatorio-temas.csv`, and the reader is left with `(1)`, `(2)` and `(3)`
   * in their downloads folder and no way to tell which year is which.
   */
  const fileName = (subjectTerm: string | undefined, format: string): string => {
    const parts = ['observatorio-temas'];
    if (subjectTerm) parts.push(subjectTerm.toLocaleLowerCase('es'));
    else if (family) parts.push(family.toLocaleLowerCase('es'));
    if (year) parts.push(year);
    return `${parts.join('-')}.${format}`;
  };

  /* ------------------------------------------------------------------ *
   * Panorama: every subject at once, before any one of them is opened.
   * ------------------------------------------------------------------ */

  const cloud: CloudWord[] = ranked.map((one) => ({
    term: one.term,
    label: one.label,
    value: one.mentions,
    adverse: one.adverseShare,
  }));

  const familyShare: ShareSlice[] = families.map(([name, fold]) => ({
    name: FAMILY_LABEL[name] ?? name,
    value: fold.mentions,
    ...(name === family ? { emphasis: true } : {}),
  }));

  const familyAdverse: ShareSlice[] = families
    .filter(([, fold]) => fold.mentions > 0)
    .map(([name, fold]) => ({
      name: FAMILY_LABEL[name] ?? name,
      value: (fold.adverse / fold.mentions) * 100,
      ...(name === family ? { emphasis: true } : {}),
    }));

  const topTerms: ShareSlice[] = ranked.slice(0, 15).map((one) => ({
    name: one.label,
    value: one.mentions,
    ...(one.term === subject?.term ? { emphasis: true } : {}),
  }));

  const archiveMonths: MonthBar[] = [...foldBy(scope, (row) => row.month).entries()]
    .map(([month, fold]) => ({ month, mentions: fold.mentions, adverse: fold.adverse }))
    .sort((left, right) => left.month.localeCompare(right.month));

  /**
   * Coverage by family and year, over the whole archive.
   *
   * This is the one panel the year and the family do not narrow, and that is
   * what it is for: it is the map a reader picks a year off, so cutting it down
   * to the year already picked would leave a single column and nothing to
   * compare it against.
   */
  const calendar = ((): { rows: string[]; columns: string[]; cells: HeatCell[] } => {
    const cells: HeatCell[] = [];
    for (const [key, fold] of foldBy(searched, (row) => `${row.family}|${row.month.slice(0, 4)}`)) {
      const [name = '', at = ''] = key.split('|');
      cells.push({ row: FAMILY_LABEL[name] ?? name, column: at, value: fold.mentions });
    }
    const rows = [...foldBy(searched, (row) => row.family).entries()]
      .sort((left, right) => right[1].mentions - left[1].mentions)
      .map(([name]) => FAMILY_LABEL[name] ?? name);
    const columns = [...new Set(searched.map((row) => row.month.slice(0, 4)))].sort();
    return { rows, columns, cells };
  })();

  /* ------------------------------------------------------------------ *
   * Análisis del tema: the one subject the reader opened.
   * ------------------------------------------------------------------ */

  const subjectRows = subject ? months.filter((row) => row.term === subject.term) : [];
  const subjectInYear = subjectRows.filter(inYear);

  const subjectMonths: MonthBar[] = subjectInYear
    .map((row) => ({ month: row.month, mentions: row.mentions, adverse: adverseOf(row) }))
    .sort((left, right) => left.month.localeCompare(right.month));

  const subjectYears: YearBar[] = [...foldBy(subjectRows, (row) => row.month.slice(0, 4)).entries()]
    .map(([at, fold]) => ({ year: at, mentions: fold.mentions, adverse: fold.adverse }))
    .sort((left, right) => left.year.localeCompare(right.year));

  const subjectTones: ShareSlice[] = TONES.map((tone) => ({
    name: tone.label,
    value: subjectInYear.reduce((sum, row) => sum + row[tone.key], 0),
    ...(tone.adverse ? { emphasis: true } : {}),
  })).filter((slice) => slice.value > 0);

  const siblingShare: ShareSlice[] = (
    subject ? ranked.filter((one) => one.family === subject.family) : []
  ).map((one) => ({
    name: one.label,
    value: one.mentions,
    ...(one.term === subject?.term ? { emphasis: true } : {}),
  }));

  /** The family's subjects, year by year, so a peak is read against its neighbours. */
  const familyCalendar = ((): { rows: string[]; columns: string[]; cells: HeatCell[] } => {
    if (!subject) return { rows: [], columns: [], cells: [] };
    const inside = searched.filter((row) => row.family === subject.family);
    const top = rollUp(inside).slice(0, 12);
    const keep = new Map(top.map((one) => [one.term, one.label]));
    const cells: HeatCell[] = [];
    for (const [key, fold] of foldBy(
      inside.filter((row) => keep.has(row.term)),
      (row) => `${row.term}|${row.month.slice(0, 4)}`,
    )) {
      const [name = '', at = ''] = key.split('|');
      cells.push({ row: keep.get(name) ?? name, column: at, value: fold.mentions });
    }
    return {
      rows: top.map((one) => one.label),
      columns: [...new Set(inside.map((row) => row.month.slice(0, 4)))].sort(),
      cells,
    };
  })();

  const selectedMentions = ranked.reduce((sum, one) => sum + one.mentions, 0);
  const selectedAdverse = ranked.reduce((sum, one) => sum + one.adverse, 0);
  const selectedMonths = new Set(scope.map((row) => row.month)).size;
  const selectedShare =
    selectedMentions > 0 ? `${percent((selectedAdverse / selectedMentions) * 100)} %` : '—';

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

        {active ? (
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Selección activa
            </div>
            <div className="rail-pills">
              {year ? (
                <button
                  type="button"
                  className="chip chip-on"
                  onClick={() => setYear('')}
                  title="Quitar este filtro"
                >
                  <Icon name="calendario" size={12} />
                  {year} ×
                </button>
              ) : null}
              {family ? (
                <button
                  type="button"
                  className="chip chip-on"
                  onClick={() => {
                    setFamily('');
                    setTerm('');
                  }}
                  title="Quitar este filtro"
                >
                  <Icon name={FAMILY_ICON[family] ?? 'capas'} size={12} />
                  {FAMILY_LABEL[family] ?? family} ×
                </button>
              ) : null}
              {term ? (
                <button
                  type="button"
                  className="chip chip-on"
                  onClick={() => setTerm('')}
                  title="Quitar este filtro"
                >
                  <Icon name="etiqueta" size={12} />
                  {ranked.find((one) => one.term === term)?.label ?? term} ×
                </button>
              ) : null}
              {query ? (
                <button type="button" className="chip chip-on" onClick={() => setSearch('')}>
                  <Icon name="buscar" size={12} />«{search.trim()}» ×
                </button>
              ) : null}
              <button type="button" className="chip" onClick={clearAll}>
                Limpiar todo
              </button>
            </div>
          </div>
        ) : null}

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="calendario" size={13} />
            Año
          </div>
          <button
            type="button"
            className={year === '' ? 'rail-item rail-item-on' : 'rail-item'}
            onClick={() => setYear('')}
          >
            <Icon name="calendario" size={16} />
            <span className="rail-name">Todos los años</span>
            <span className="rail-n">{count(sumOf(yearCounts.values()))}</span>
          </button>
          {years.map((at) => (
            <button
              key={at}
              type="button"
              className={year === at ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => setYear(year === at ? '' : at)}
            >
              <Icon name="calendario" size={16} />
              <span className="rail-name">{at}</span>
              <span className="rail-n">{count(yearCounts.get(at)?.mentions ?? 0)}</span>
            </button>
          ))}
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="capas" size={13} />
            Familia ({families.length})
          </div>
          <button
            type="button"
            className={family === '' ? 'rail-item rail-item-on' : 'rail-item'}
            onClick={() => {
              setFamily('');
              setTerm('');
            }}
          >
            <Icon name="capas" size={16} />
            <span className="rail-name">Todas las familias</span>
            <span className="rail-n">{count(sumOf(familyCounts.values()))}</span>
          </button>
          {families.map(([name, fold]) => (
            <button
              key={name}
              type="button"
              className={family === name ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => {
                setFamily(family === name ? '' : name);
                setTerm('');
              }}
            >
              <Icon name={FAMILY_ICON[name] ?? 'cajas'} size={16} />
              <span className="rail-name">{FAMILY_LABEL[name] ?? name}</span>
              <span className="rail-n">{count(fold.mentions)}</span>
            </button>
          ))}
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="etiqueta" size={13} />
            Tema ({ranked.length})
          </div>
          <div className="rail-field">
            <select
              value={term}
              aria-label="Tema vigilado"
              onChange={(event) => setTerm(event.target.value)}
            >
              <option value="">Sin tema elegido</option>
              {ranked.map((one) => (
                <option key={one.term} value={one.term}>
                  {one.label} ({count(one.mentions)})
                </option>
              ))}
            </select>
          </div>
          <p className="rail-hint">
            También se elige tocando una palabra de la nube, y se quita tocándola otra vez.
          </p>
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="buscar" size={13} />
            Buscar un tema
          </div>
          <div className="rail-field">
            <input
              type="search"
              value={search}
              aria-label="Buscar entre los temas vigilados"
              placeholder="diésel, dólar, contrabando…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="descarga" size={13} />
            Descargar la selección
          </div>
          <div className="rail-download">
            <a
              className="download-btn"
              href={`/api/export?${exportQuery(term || undefined)}&format=csv`}
              download={fileName(term || undefined, 'csv')}
            >
              CSV
            </a>
            <a
              className="download-btn"
              href={`/api/export?${exportQuery(term || undefined)}&format=json`}
              download={fileName(term || undefined, 'json')}
            >
              JSON
            </a>
          </div>
          <p className="rail-hint">
            El archivo lleva estos mismos filtros: una fila por tema y por mes, con los tonos que
            componen la cobertura adversa.
          </p>
        </div>

        <div className="rail-foot">
          Selección: <b>{count(selectedMentions)}</b> mencion{selectedMentions === 1 ? '' : 'es'}
          <br />
          en <b>{count(ranked.length)}</b> tema{ranked.length === 1 ? '' : 's'} y{' '}
          <b>{selectedMonths}</b> mes{selectedMonths === 1 ? '' : 'es'}
          <br />
          Cobertura adversa: <b>{selectedShare}</b>
          <br />
          Tema <b>derivado</b> del titular, no publicado por el medio
        </div>
      </aside>

      <div className="workspace-main" id="tablero" tabIndex={-1}>
        <div className="briefcard">
          <span className="briefcard-mark">
            <Icon name="etiqueta" size={20} />
          </span>
          <div>
            <h2>De qué se habla, y cuándo</h2>
            <p>
              Cada nota del archivo se lee contra una lista de temas vigilados y queda fechada por
              el mes en que se publicó. Una nota puede nombrar varios temas: los conteos son{' '}
              <strong>menciones, no notas</strong>, y por eso suman más que el archivo.
            </p>
            <div className="brief-points">
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="globo" size={17} />
                </span>
                <div>
                  <b>Primero, entre temas</b>
                  <span>la nube, las familias y el archivo entero</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="diana" size={17} />
                </span>
                <div>
                  <b>Después, dentro de uno</b>
                  <span>su serie, sus tonos y sus vecinos</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="calendario" size={17} />
                </span>
                <div>
                  <b>Siempre fechado</b>
                  <span>el año se elige a la izquierda</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">
              <Icon name="etiqueta" size={12} />
              Temas en la selección
            </span>
            <span className="stat-value">{count(ranked.length)}</span>
            <span className="stat-hint">
              de {count(totals.length || ranked.length)} vigilados, en {families.length} familias
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="barras" size={12} />
              Menciones fechadas
            </span>
            <span className="stat-value">{count(selectedMentions)}</span>
            <span className="stat-hint">{year ? `sólo ${year}` : 'todo el archivo'}</span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="pulso" size={12} />
              Cobertura adversa
            </span>
            <span className="stat-value">{selectedShare}</span>
            <span className="stat-hint">alarma, deterioro, conflicto o incertidumbre</span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="calendario" size={12} />
              Meses cubiertos
            </span>
            <span className="stat-value">{selectedMonths}</span>
            <span className="stat-hint">
              {archiveMonths.length
                ? `${archiveMonths[0]?.month} → ${archiveMonths[archiveMonths.length - 1]?.month}`
                : '—'}
            </span>
          </div>
        </div>

        <div className="strap">
          <Icon name="globo" size={17} />
          <h2>Panorama: los temas entre sí</h2>
          <span className="tile-hint">
            {year ? `año ${year}` : 'archivo completo'}
            {family ? ` · ${FAMILY_LABEL[family] ?? family}` : ''}
          </span>
        </div>

        <div className="panel">
          <div className="tile-head">
            <Icon name="cajas" size={17} />
            <h2>La nube de temas</h2>
            <span className="tile-hint">
              {cloud.length} tema{cloud.length === 1 ? '' : 's'} · tocá uno para abrirlo
            </span>
          </div>
          <TermCloud
            data={cloud}
            selected={subject?.term ?? ''}
            onPick={(picked) => setTerm(term === picked ? '' : picked)}
          />
          <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
            El tamaño es cuántas veces la prensa nombró cada asunto — en raíz cuadrada, porque lo
            que el ojo compara es el área — y el color es qué parte de esa cobertura fue adversa:
            del azul, casi nada, al rojo, casi toda. El orden es alfabético para que un tema pueda
            buscarse; el dato es el tamaño, no la posición.
          </p>
        </div>

        <div className="grid-pair">
          <div className="panel">
            <div className="tile-head">
              <Icon name="capas" size={17} />
              <h2>Las familias, comparadas</h2>
              <span className="tile-hint">{families.length} familias</span>
            </div>
            <ShareBars
              data={familyShare}
              unit="menciones"
              height={Math.max(200, familyShare.length * 22)}
            />
            <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
              Siguen todas aunque haya una elegida — va marcada —, porque un ranking de una sola
              barra no compara nada.
            </p>
          </div>

          <div className="panel">
            <div className="tile-head">
              <Icon name="pulso" size={17} />
              <h2>Qué familia se cubre peor</h2>
              <span className="tile-hint">% de cobertura adversa</span>
            </div>
            <ShareBars
              data={familyAdverse}
              unit="%"
              tone="var(--gap)"
              height={Math.max(200, familyAdverse.length * 22)}
            />
            <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
              La parte de las menciones de cada familia que la prensa cubrió con alarma, deterioro,
              conflicto o incertidumbre. Es tono de la cobertura, no estado de la economía.
            </p>
          </div>

          <div className="panel">
            <div className="tile-head">
              <Icon name="etiqueta" size={17} />
              <h2>Los quince más nombrados</h2>
              <span className="tile-hint">
                {family ? (FAMILY_LABEL[family] ?? family) : 'todas las familias'}
              </span>
            </div>
            <ShareBars
              data={topTerms}
              unit="menciones"
              height={Math.max(200, topTerms.length * 26)}
            />
            <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
              La altura es atención mediática y no tamaño económico: el contrabando ocupa más
              titulares que la manufactura sin mover más dinero.
            </p>
          </div>

          <div className="panel">
            <div className="tile-head">
              <Icon name="barras" size={17} />
              <h2>El archivo, mes a mes</h2>
              <span className="tile-hint">{archiveMonths.length} meses</span>
            </div>
            <MonthlyBars data={archiveMonths} height={240} />
            <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
              Todas las menciones de la selección sumadas por mes; en rojo, la parte adversa. Los
              años delgados son los que se reconstruyeron desde los mapas de sitio de cada medio, no
              años sin economía.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="tile-head">
            <Icon name="calendario" size={17} />
            <h2>Qué se cubrió cada año</h2>
            <span className="tile-hint">menciones por familia y año</span>
          </div>
          <HeatGrid
            rows={calendar.rows}
            columns={calendar.columns}
            cells={calendar.cells}
            unit="menciones"
          />
          <p className="panel-sub" style={{ marginTop: 'var(--s2)' }}>
            Cuanto más oscura la celda, más se habló de esa familia ese año. Es el único panel que
            el año y la familia elegidos no recortan: es el mapa contra el que se eligen, y
            reducirlo a la casilla ya elegida no dejaría nada con qué compararla. Las celdas vacías
            son años sin ninguna mención del asunto, no años con cero cobertura económica.
          </p>
        </div>

        {missing ? (
          <div className="callout">
            El tema elegido no tiene ninguna mención{year ? ` en ${year}` : ''}
            {family ? ` dentro de ${FAMILY_LABEL[family] ?? family}` : ''}. Quitá el filtro del año
            o elegí otro tema para ver su análisis.
          </div>
        ) : null}

        {subject ? (
          <>
            <div className="strap">
              <Icon name="diana" size={17} />
              <h2>{subject.label}</h2>
              <span className="tile-hint">
                {count(subject.mentions)} menciones · {subject.months} meses ·{' '}
                {FAMILY_LABEL[subject.family] ?? subject.family}
              </span>
              <div className="download">
                <span className="download-label">Serie mensual del tema</span>
                <a
                  className="download-btn"
                  href={`/api/export?${exportQuery(subject.term)}&format=csv`}
                  download={fileName(subject.term, 'csv')}
                >
                  CSV
                </a>
                <a
                  className="download-btn"
                  href={`/api/export?${exportQuery(subject.term)}&format=json`}
                  download={fileName(subject.term, 'json')}
                >
                  JSON
                </a>
              </div>
            </div>

            <div className="grid-pair">
              <div className="panel">
                <div className="tile-head">
                  <Icon name="barras" size={17} />
                  <h2>{subject.label}, mes a mes</h2>
                  <span className="tile-hint">
                    {sayMonth(subject.firstMonth)} → {sayMonth(subject.lastMonth)}
                  </span>
                </div>
                <MonthlyBars data={subjectMonths} height={240} />
                <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
                  Acumula <strong>{count(subject.mentions)} menciones</strong> en {subject.months}{' '}
                  meses, con su pico en {sayMonth(subject.peakMonth)} ({count(subject.peakMentions)}{' '}
                  notas)
                  {subject.adverseShare === null
                    ? ''
                    : ` y un ${percent(subject.adverseShare)} % de cobertura adversa`}
                  .
                </p>
              </div>

              <div className="panel">
                <div className="tile-head">
                  <Icon name="calendario" size={17} />
                  <h2>{subject.label}, año por año</h2>
                  <span className="tile-hint">{subjectYears.length} años</span>
                </div>
                <YearlyBars data={subjectYears} height={240} />
                <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
                  Este panel ignora el filtro del año a propósito: es la comparación entre años, y
                  recortarla a uno dejaría una sola barra.
                </p>
              </div>

              <div className="panel">
                <div className="tile-head">
                  <Icon name="pulso" size={17} />
                  <h2>Con qué tono se lo cubrió</h2>
                  <span className="tile-hint">{year ? `año ${year}` : 'todo el archivo'}</span>
                </div>
                <ShareBars
                  data={subjectTones}
                  unit="menciones"
                  height={Math.max(180, subjectTones.length * 32)}
                />
                <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
                  Van marcados los cuatro tonos que componen la cobertura adversa. «Sin marca» es
                  una nota que nombró el tema sin que ninguna regla de tono la alcanzara, no una
                  nota neutral.
                </p>
              </div>

              <div className="panel">
                <div className="tile-head">
                  <Icon name={FAMILY_ICON[subject.family] ?? 'capas'} size={17} />
                  <h2>Dentro de {FAMILY_LABEL[subject.family] ?? subject.family}</h2>
                  <span className="tile-hint">
                    {siblingShare.length} tema{siblingShare.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ShareBars
                  data={siblingShare}
                  unit="menciones"
                  height={Math.max(180, Math.min(siblingShare.length, 16) * 26)}
                />
                <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
                  El tema abierto va marcado, para leerlo contra sus vecinos de familia y no contra
                  el archivo entero.
                </p>
              </div>
            </div>

            {familyCalendar.rows.length > 1 ? (
              <div className="panel">
                <div className="tile-head">
                  <Icon name="capas" size={17} />
                  <h2>
                    {FAMILY_LABEL[subject.family] ?? subject.family}, tema por tema y año por año
                  </h2>
                  <span className="tile-hint">hasta 12 temas</span>
                </div>
                <HeatGrid
                  rows={familyCalendar.rows}
                  columns={familyCalendar.columns}
                  cells={familyCalendar.cells}
                  unit="menciones"
                />
                <p className="panel-sub" style={{ marginTop: 'var(--s2)' }}>
                  Un pico sólo significa algo contra los de al lado: esta rejilla dice si el año que
                  disparó a este tema disparó también a los demás de su familia — un shock del
                  sector — o sólo a él.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
