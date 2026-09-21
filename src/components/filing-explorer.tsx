'use client';

import { useMemo, useState } from 'react';
import {
  ANY,
  accepts,
  additive,
  counts,
  describe,
  list,
  multiTitle,
  picked,
  toggle as toggleChoice,
  without,
} from '@/lib/choice';
import type { Choice } from '@/lib/choice';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { CompanyFiling } from '@/lib/series';

/**
 * The corporate register, read by what was filed and by who filed it.
 *
 * Nineteen thousand filings is a register, not a news feed, and it is asked two
 * different questions. One is sectoral — what has been happening in banking, in
 * energy, in agro-industry — and the industry slicer answers it. The other is
 * about the filings themselves: how much of this register is executives coming
 * and going, how much is money being raised, how much is a rating agency's
 * verdict. The subject line carries that answer and cannot be read as a
 * category on its own, because the exchange lets each issuer word its own and
 * four thousand distinct subjects result.
 *
 * So the subject is read for meaning in the database (migration 0061) and
 * arrives here as one of eleven categories. Both slicers are docked beside the
 * register rather than stacked above it, and they compose with the issuer and
 * with a search over the subject line.
 *
 * Neither classification is the exchange's: the industry is derived from each
 * issuer's registered name, the category from the subject's wording, and the
 * panel says so rather than letting a chip imply an official taxonomy.
 * Anything the rules do not match stays under «Otros» instead of being
 * assigned a plausible bucket.
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

/**
 * What each filing is about, as migration 0061 files it.
 *
 * Ordered here the way the migration tests its rules, so the two definitions
 * stay legible against each other.
 */
const CATEGORY_LABEL: Record<string, string> = {
  CALIFICACION: 'Calificación de riesgo',
  EMISION: 'Emisiones y titularización',
  FINANCIAMIENTO: 'Préstamos y financiamiento',
  CAPITAL: 'Capital y dividendos',
  EJECUTIVOS: 'Cambios de ejecutivos',
  PODERES: 'Poderes y representación',
  JUNTA: 'Juntas y asambleas',
  DIRECTORIO: 'Directorio y comités',
  ESTADOS: 'Estados financieros',
  REGULATORIO: 'Regulación y supervisión',
  OPERACIONES: 'Operaciones y contratos',
  OTROS: 'Otros hechos',
};

const CATEGORY_ICON: Record<string, IconName> = {
  CALIFICACION: 'balanza',
  EMISION: 'velas',
  FINANCIAMIENTO: 'monedas',
  CAPITAL: 'tendencia',
  EJECUTIVOS: 'personas',
  PODERES: 'etiqueta',
  JUNTA: 'calendario',
  DIRECTORIO: 'banco',
  ESTADOS: 'sigma',
  REGULATORIO: 'escudo',
  OPERACIONES: 'maletin',
  OTROS: 'cajas',
};

/**
 * Un rubro es un nombre, no una cantidad, así que todas las barras van del
 * mismo color y la elegida va en tinta.
 *
 * Antes se recorrían cinco colores por puesto en el ranking, y el comentario
 * que lo acompañaba decía la verdad —«para que el color nunca implique una
 * categoría»—: era un canal encendido sin nada que decir. Peor: el color
 * cambiaba de rubro en cuanto cambiaba el orden, así que quien había aprendido
 * que «Directorio» era el naranja se lo encontraba azul al filtrar. Con un solo
 * tono, lo que queda pintado es el único dato que hay: el largo de la barra.
 */
const BAR_TONE = 'var(--official)';

/** One page of the register. The whole register is already in the browser, so
 * paging it costs nothing but the state that says where the reader is. */
const PAGE_SIZE = 40;

/**
 * A chip names one choice, so it has to fit on one line.
 *
 * Clipping it in CSS leaves the ellipsis fighting the × at the end and shows
 * the middle of the name; cutting the string keeps the beginning, which is the
 * part that identifies a company. The full name stays on the chip's tooltip and
 * in the control below it.
 */
const shortName = (name: string): string =>
  name.length > 26 ? `${name.slice(0, 25).trimEnd()}…` : name;

export function FilingExplorer({ filings }: { filings: CompanyFiling[] }) {
  /*
   * Cada recorte es un conjunto y no un nombre.
   *
   * «Banca» y «Energía» a la vez es una pregunta corriente —son los dos rubros
   * que mueven el registro— y con un filtro de uno solo hay que mirarlos por
   * turnos y sumar de cabeza. Vacío quiere decir «todos», igual que el viejo
   * centinela; el gesto que suma está en `toggle`.
   */
  const [sector, setSector] = useState<Choice>(ANY);
  const [category, setCategory] = useState<Choice>(ANY);
  const [filer, setFiler] = useState<Choice>(ANY);
  const [search, setSearch] = useState('');
  /** Which filings the reader has opened; collapsed is a clamp, never a cut. */
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  /** Which page of the register is on screen, counted in filings skipped. */
  const [offset, setOffset] = useState(0);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  /** Whether a filing survives every slicer but the one being counted. */
  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return (filing: CompanyFiling, except: 'sector' | 'category' | 'filer' | null): boolean =>
      (except === 'sector' || accepts(sector, filing.sector)) &&
      (except === 'category' || accepts(category, filing.category)) &&
      (except === 'filer' || accepts(filer, filing.filer)) &&
      (!term ||
        filing.subject.toLocaleLowerCase('es').includes(term) ||
        filing.filer.toLocaleLowerCase('es').includes(term));
  }, [sector, category, filer, search]);

  /**
   * Los tres gestos, escritos una vez.
   *
   * El rubro arrastra al emisor: elegir «Banca» en lugar de «Energía» puede
   * dejar puesto un emisor que ya no existe en la selección, y un filtro que no
   * devuelve nada sin decir por qué es peor que ninguno. Al *sumar* un rubro
   * eso no pasa —la selección sólo se ensancha— así que ahí el emisor se queda.
   */
  const pickSector = (value: string, add: boolean): void => {
    setOffset(0);
    setSector((current) => toggleChoice(current, value, add));
    if (!add) setFiler(ANY);
  };
  const pickCategory = (value: string, add: boolean): void => {
    setOffset(0);
    setCategory((current) => toggleChoice(current, value, add));
  };
  const pickFiler = (value: string, add: boolean): void => {
    setOffset(0);
    setFiler((current) => toggleChoice(current, value, add));
  };

  /**
   * Each slicer counted under every other one, never under itself — choosing an
   * issuer narrows the industries to the ones that issuer files under, while the
   * industry list keeps offering all of them so the choice can be undone.
   */
  const sectors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const filing of filings) {
      if (!matches(filing, 'sector')) continue;
      counts.set(filing.sector, (counts.get(filing.sector) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [filings, matches]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const filing of filings) {
      if (!matches(filing, 'category')) continue;
      counts.set(filing.category, (counts.get(filing.category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [filings, matches]);

  const filers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const filing of filings) {
      if (!matches(filing, 'filer')) continue;
      counts.set(filing.filer, (counts.get(filing.filer) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [filings, matches]);

  const selected = useMemo(
    () => filings.filter((filing) => matches(filing, null)),
    [filings, matches],
  );

  const pages = Math.max(1, Math.ceil(selected.length / PAGE_SIZE));
  const page = Math.min(pages, Math.floor(offset / PAGE_SIZE) + 1);
  const shown = selected.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const peak = sectors.length ? Math.max(...sectors.map(([, count]) => count)) : 1;
  const categoryPeak = categories.length ? Math.max(...categories.map(([, count]) => count)) : 1;
  const categoryTotal = categories.reduce((sum, [, count]) => sum + count, 0);
  /**
   * Whichever field tells the cards apart leads them.
   *
   * Across the register the subject line repeats — a dozen filings called
   * "Determinaciones de Directorio" — and the issuer is what distinguishes
   * them. Once a single issuer is chosen that inverts exactly: every card
   * carries the same name, and the subject is the only thing left that says
   * which filing this is.
   */
  const leadWithSubject = filer.size > 0;
  const issuers = new Set(selected.map((filing) => filing.filer)).size;
  /*
   * Una dimensión cuenta una vez aunque lleve cinco categorías: lo que el
   * lector movió es un filtro, no cinco.
   */
  const active = counts(sector) + counts(category) + counts(filer) + (search.trim() ? 1 : 0);

  const query = new URLSearchParams({
    dataset: 'filings',
    ...(sector.size ? { sector: list(sector).join(',') } : {}),
    ...(category.size ? { categoria: list(category).join(',') } : {}),
    ...(filer.size ? { emisor: list(filer).join(',') } : {}),
    ...(search.trim() ? { buscar: search.trim() } : {}),
  });

  /** Una pastilla por categoría elegida, para poder quitarlas de a una. */
  const chips = [
    ...list(sector).map((value) => ({
      key: `sector-${value}`,
      icon: SECTOR_ICON[value] ?? 'cajas',
      label: SECTOR_LABEL[value] ?? value,
      title: 'Quitar este filtro',
      remove: () => {
        setOffset(0);
        setSector((current) => without(current, value));
      },
    })),
    ...list(category).map((value) => ({
      key: `category-${value}`,
      icon: CATEGORY_ICON[value] ?? 'cajas',
      label: CATEGORY_LABEL[value] ?? value,
      title: 'Quitar este filtro',
      remove: () => {
        setOffset(0);
        setCategory((current) => without(current, value));
      },
    })),
    ...list(filer).map((value) => ({
      key: `filer-${value}`,
      icon: 'edificio' as const,
      label: shortName(value),
      title: `${value} — tocá para quitar este filtro`,
      remove: () => {
        setOffset(0);
        setFiler((current) => without(current, value));
      },
    })),
  ];

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

        <FilterHint />

        {active ? (
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Selección activa
            </div>
            <div className="rail-pills">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="chip chip-on"
                  onClick={chip.remove}
                  title={chip.title}
                >
                  <Icon name={chip.icon} size={12} />
                  {chip.label} ×
                </button>
              ))}
              {search.trim() ? (
                <button type="button" className="chip chip-on" onClick={() => setSearch('')}>
                  <Icon name="buscar" size={12} />«{search.trim()}» ×
                </button>
              ) : null}
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setOffset(0);
                  setSector(ANY);
                  setCategory(ANY);
                  setFiler(ANY);
                  setSearch('');
                }}
              >
                Limpiar todo
              </button>
            </div>
          </div>
        ) : null}

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="etiqueta" size={13} />
            Tipo de hecho
            <PickedCount choice={category} />
          </div>
          <button
            type="button"
            className={category.size === 0 ? 'rail-item rail-item-on' : 'rail-item'}
            aria-pressed={category.size === 0}
            onClick={() => {
              setOffset(0);
              setCategory(ANY);
            }}
          >
            <Icon name="capas" size={16} />
            <span className="rail-name">Todos los tipos</span>
            <span className="rail-n">{categoryTotal.toLocaleString('es-BO')}</span>
          </button>
          {categories.map(([key, count]) => {
            const on = picked(category, key);
            return (
              <button
                key={key}
                type="button"
                className={on ? 'rail-item rail-item-on' : 'rail-item'}
                aria-pressed={on}
                title={multiTitle(CATEGORY_LABEL[key] ?? key, on)}
                onClick={(event) => pickCategory(key, additive(event))}
              >
                <Icon name={CATEGORY_ICON[key] ?? 'cajas'} size={16} />
                <span className="rail-name">{CATEGORY_LABEL[key] ?? key}</span>
                <span className="rail-n">{count.toLocaleString('es-BO')}</span>
              </button>
            );
          })}
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="cajas" size={13} />
            Rubro del emisor
            <PickedCount choice={sector} />
          </div>
          <button
            type="button"
            className={sector.size === 0 ? 'rail-item rail-item-on' : 'rail-item'}
            aria-pressed={sector.size === 0}
            onClick={() => {
              setOffset(0);
              setSector(ANY);
              setFiler(ANY);
            }}
          >
            <Icon name="cajas" size={16} />
            <span className="rail-name">Todos los rubros</span>
            <span className="rail-n">
              {sectors.reduce((sum, [, count]) => sum + count, 0).toLocaleString('es-BO')}
            </span>
          </button>
          {sectors.map(([key, count]) => {
            const on = picked(sector, key);
            return (
              <button
                key={key}
                type="button"
                className={on ? 'rail-item rail-item-on' : 'rail-item'}
                aria-pressed={on}
                title={multiTitle(SECTOR_LABEL[key] ?? key, on)}
                onClick={(event) => pickSector(key, additive(event))}
              >
                <Icon name={SECTOR_ICON[key] ?? 'cajas'} size={16} />
                <span className="rail-name">{SECTOR_LABEL[key] ?? key}</span>
                <span className="rail-n">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="edificio" size={13} />
            Emisor ({filers.length})
            <PickedCount choice={filer} />
          </div>
          {/*
            Una lista y no un desplegable.

            Un `select` nativo elige uno y sólo uno: no hay Ctrl+clic dentro de
            un desplegable, y dejar el emisor como la única dimensión del
            informe que no se puede sumar convertía el atajo en una regla con
            excepciones que el lector descubre fallando. La lista se desplaza
            dentro de su sección —son decenas de emisores— y el buscador de
            abajo sigue sirviendo para llegar a uno por nombre.
          */}
          <div className={filers.length > 8 ? 'rail-list rail-list-cut' : 'rail-list'}>
            <button
              type="button"
              className={filer.size === 0 ? 'rail-item rail-item-on' : 'rail-item'}
              aria-pressed={filer.size === 0}
              onClick={() => {
                setOffset(0);
                setFiler(ANY);
              }}
            >
              <Icon name="capas" size={16} />
              <span className="rail-name">Todos los emisores</span>
              <span className="rail-n">{filers.reduce((sum, [, count]) => sum + count, 0)}</span>
            </button>
            {filers.map(([name, count]) => {
              const on = picked(filer, name);
              return (
                <button
                  key={name}
                  type="button"
                  className={on ? 'rail-item rail-item-on' : 'rail-item'}
                  aria-pressed={on}
                  title={multiTitle(name, on)}
                  onClick={(event) => pickFiler(name, additive(event))}
                >
                  <Icon name="edificio" size={16} />
                  <span className="rail-name">{name}</span>
                  <span className="rail-n">{count}</span>
                </button>
              );
            })}
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
              aria-label="Buscar en el hecho relevante"
              placeholder="calificación, emisión, dividendos…"
              onChange={(event) => {
                setOffset(0);
                setSearch(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="rail-foot">
          Selección: <b>{selected.length.toLocaleString('es-BO')}</b> hechos
          <br />
          de <b>{issuers}</b> emisor{issuers === 1 ? '' : 'es'}
          <br />
          Rubro <b>derivado</b> de la razón social
          <br />
          Tipo <b>derivado</b> del asunto comunicado
        </div>
      </aside>

      <div className="workspace-main" id="tablero" tabIndex={-1}>
        <div className="briefcard">
          <span className="briefcard-mark">
            <Icon name="edificio" size={20} />
          </span>
          <div>
            <h2>Hechos relevantes</h2>
            <p>
              Comunicados que los emisores registran en la Bolsa Boliviana de Valores. Elegí un
              rubro a la izquierda para leer sólo ese sector, o sumá varios con{' '}
              <strong>Ctrl+clic</strong>; la bolsa no publica una clasificación sectorial propia,
              así que el rubro se <strong>deriva de la razón social</strong> del emisor.
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
          <Icon name={SECTOR_ICON[list(sector)[0] ?? ''] ?? 'cajas'} size={17} />
          <h2>
            {describe(sector, (value) => SECTOR_LABEL[value] ?? value, 'Todos los rubros')}
          </h2>
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

        {categories.length > 1 ? (
          <div className="panel">
            <div className="tile-head">
              <Icon name="etiqueta" size={17} />
              <h2>Análisis por tipo de hecho</h2>
              <span className="tile-hint">
                {categoryTotal.toLocaleString('es-BO')} comunicados, sin filtrar por tipo · el
                asunto leído por su redacción, no una clasificación de la bolsa
              </span>
            </div>
            <div className="barlist">
              {categories.map(([key, count]) => {
                const on = picked(category, key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={on ? 'barlist-row barlist-row-on' : 'barlist-row'}
                    aria-pressed={on}
                    title={multiTitle(CATEGORY_LABEL[key] ?? key, on)}
                    onClick={(event) => pickCategory(key, additive(event))}
                  >
                    <Icon name={CATEGORY_ICON[key] ?? 'cajas'} size={14} />
                    <span className="barlist-name">{CATEGORY_LABEL[key] ?? key}</span>
                    <span className="barlist-track">
                      <span
                        className="barlist-fill"
                        style={{
                          width: `${(count / categoryPeak) * 100}%`,
                          background: on ? 'var(--ink)' : BAR_TONE,
                        }}
                      />
                    </span>
                    <span className="barlist-n">{count.toLocaleString('es-BO')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {sectors.length > 1 ? (
          <div className="panel">
            <div className="tile-head">
              <Icon name="barras" size={17} />
              <h2>Actividad por rubro</h2>
              <span className="tile-hint">
                {sectors.reduce((sum, [, count]) => sum + count, 0).toLocaleString('es-BO')}{' '}
                comunicados, sin filtrar por rubro
              </span>
            </div>
            <div className="barlist">
              {sectors.map(([key, count]) => {
                const on = picked(sector, key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={on ? 'barlist-row barlist-row-on' : 'barlist-row'}
                    aria-pressed={on}
                    title={multiTitle(SECTOR_LABEL[key] ?? key, on)}
                    onClick={(event) => pickSector(key, additive(event))}
                  >
                    <Icon name={SECTOR_ICON[key] ?? 'cajas'} size={14} />
                    <span className="barlist-name">{SECTOR_LABEL[key] ?? key}</span>
                    <span className="barlist-track">
                      <span
                        className="barlist-fill"
                        style={{
                          width: `${(count / peak) * 100}%`,
                          background: on ? 'var(--ink)' : BAR_TONE,
                        }}
                      />
                    </span>
                    <span className="barlist-n">{count.toLocaleString('es-BO')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {shown.length ? (
          <div className="filing-grid">
            {shown.map((filing, index) => {
              const isOpen = open.has(filing.factClaimId);
              return (
                <article
                  className={
                    isOpen ? 'filing-card filing-card-open' : 'filing-card filing-card-tight'
                  }
                  key={filing.factClaimId}
                  style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                >
                  <div className="filing-top">
                    <Icon name={SECTOR_ICON[filing.sector] ?? 'cajas'} size={13} />
                    <span>{SECTOR_LABEL[filing.sector] ?? filing.sector}</span>
                    <span className="filing-date">{filing.eventDate}</span>
                  </div>
                  {leadWithSubject ? (
                    <>
                      <p className="filing-kicker">{filing.filer}</p>
                      <h4>{filing.subject}</h4>
                    </>
                  ) : (
                    <>
                      <p className="filing-kicker">{filing.subject}</p>
                      <h4>{filing.filer}</h4>
                    </>
                  )}
                  {filing.summary ? <p className="filing-summary">{filing.summary}</p> : null}
                  {isOpen && !filing.summaryIsComplete ? (
                    <p className="filing-partial">
                      <Icon name="info" size={12} /> La bolsa publica este hecho resumido en su
                      registro; el texto íntegro está en la ficha.
                    </p>
                  ) : null}
                  <p className="filing-foot">
                    <button
                      type="button"
                      className="filing-toggle"
                      onClick={() => toggle(filing.factClaimId)}
                      aria-expanded={isOpen}
                    >
                      <Icon name={isOpen ? 'plegar' : 'desplegar'} size={13} />
                      {isOpen ? 'Plegar' : 'Ver completo'}
                    </button>
                    <span style={{ color: 'var(--ink-faint)' }}>
                      {filing.instantStatedInDocument
                        ? 'Confirmado por la ficha'
                        : 'Según el registro'}
                      {filing.filerCode ? ` · ${filing.filerCode}` : ''}
                    </span>
                    {filing.sourceUrl ? (
                      <a href={filing.sourceUrl} target="_blank" rel="noreferrer noopener">
                        ficha completa
                      </a>
                    ) : null}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="callout">Ningún hecho relevante coincide con esta selección.</div>
        )}

        {pages > 1 ? (
          <nav className="pager" aria-label="Páginas del registro">
            <button
              type="button"
              className="pager-step"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={page <= 1}
            >
              <Icon name="plegar" size={14} /> Más recientes
            </button>
            <span className="pager-where">
              Página <b>{page}</b> de <b>{pages.toLocaleString('es-BO')}</b> ·{' '}
              {selected.length.toLocaleString('es-BO')} hechos
            </span>
            <button
              type="button"
              className="pager-step"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={page >= pages}
            >
              Más antiguos <Icon name="desplegar" size={14} />
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
