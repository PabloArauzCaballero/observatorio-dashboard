'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';
import { PressPulse } from './press-pulse';
import {
  ECONOMIC_TOPICS,
  NO_SELECTION,
  activeCount,
  countsFor,
  pressQuery,
  totalFor,
} from '@/lib/cross-filter';
import type { PressSelection } from '@/lib/cross-filter';
import type { PressArticle, PressCube } from '@/lib/series';

/**
 * What the Bolivian press published, sliced from any visual on the page.
 *
 * Every count here speaks for the whole corpus, not for the page of stories on
 * screen: the panel holds a cross-tabulation of all twenty-two thousand
 * articles and re-sums it on every click, while the stories themselves are
 * fetched for the selection. The alternative — filtering a cached first
 * thousand — produces a filter that says "338" beside a corpus of 22,302, which
 * is a number that means nothing to the reader it is shown to.
 *
 * This section answers a question no series can: why a number moved. A fuel
 * decree, a blockade or a shortage is reported days before any table records
 * its effect, and an official figure never explains itself.
 *
 * It is also the section where provenance matters most, so the panel is blunt
 * about what it is showing. An outlet reporting that the dollar rose is not a
 * reading of the dollar — it is a report, and nothing here reaches a series.
 * The subject is derived from the headline, not published by the outlet, and
 * coverage that no economic rule matches stays under «Otros» rather than being
 * filed somewhere flattering.
 */

const TOPIC_LABEL: Record<string, string> = {
  HIDROCARBUROS: 'Hidrocarburos',
  CAMBIARIO: 'Tipo de cambio',
  PRECIOS: 'Precios',
  MONETARIO: 'Monetario y financiero',
  FISCAL: 'Fiscal',
  COMERCIO_EXTERIOR: 'Comercio exterior',
  SECTOR_REAL: 'Sector real',
  LABORAL: 'Laboral',
  ENERGIA: 'Energía y electricidad',
  INFRAESTRUCTURA: 'Obras e infraestructura',
  SOCIAL: 'Social',
  ACTIVIDAD: 'Actividad económica',
  CONFLICTO: 'Conflicto social',
  POLITICA: 'Política y Estado',
  EMPRESARIAL: 'Empresas y marcas',
  CRONICA_ROJA: 'Crónica roja',
  OTROS: 'Otros temas',
};

const TOPIC_ICON: Record<string, IconName> = {
  HIDROCARBUROS: 'gota',
  CAMBIARIO: 'balanza',
  PRECIOS: 'etiqueta',
  MONETARIO: 'monedas',
  FISCAL: 'banco',
  COMERCIO_EXTERIOR: 'globo',
  SECTOR_REAL: 'fabrica',
  LABORAL: 'personas',
  ENERGIA: 'rayo',
  INFRAESTRUCTURA: 'casco',
  SOCIAL: 'personas',
  ACTIVIDAD: 'tendencia',
  CONFLICTO: 'rayo',
  POLITICA: 'banco',
  EMPRESARIAL: 'maletin',
  CRONICA_ROJA: 'escudo',
  OTROS: 'cajas',
};

const TONE_LABEL: Record<string, string> = {
  ALARMA: 'Alarma',
  CONFLICTO: 'Conflicto',
  DETERIORO: 'Deterioro',
  INCERTIDUMBRE: 'Incertidumbre',
  MEJORA: 'Mejora',
  DESINFORMACION: 'Desinformación',
  MEDIDA: 'Medida tomada',
  NEUTRO: 'Sin marca',
};

const REGION_LABEL: Record<string, string> = {
  SANTA_CRUZ: 'Santa Cruz',
  LA_PAZ: 'La Paz',
  COCHABAMBA: 'Cochabamba',
  ORURO: 'Oruro',
  POTOSI: 'Potosí',
  TARIJA: 'Tarija',
  CHUQUISACA: 'Chuquisaca',
  BENI: 'Beni',
  PANDO: 'Pando',
  NACIONAL: 'Sin departamento',
};

const BAR_TONES = ['var(--official)', 'var(--parallel)', 'var(--gap)', 'var(--down)', 'var(--up)'];

/** One page of the register; the API is asked for exactly this many. */
const PAGE_SIZE = 60;

/** What each active slicer is called, so it can be named and removed. */
function chipsFor(
  selection: PressSelection,
  terms: PressCube['terms'],
): Array<{ dimension: keyof PressSelection; value: string; label: string; icon: IconName }> {
  const out: Array<{
    dimension: keyof PressSelection;
    value: string;
    label: string;
    icon: IconName;
  }> = [];
  if (selection.topic !== ECONOMIC_TOPICS) {
    out.push({
      dimension: 'topic',
      value: selection.topic,
      label:
        selection.topic === 'TODOS'
          ? 'Todos los temas'
          : (TOPIC_LABEL[selection.topic] ?? selection.topic),
      icon: TOPIC_ICON[selection.topic] ?? 'cajas',
    });
  }
  if (selection.year !== 'TODOS') {
    out.push({
      dimension: 'year',
      value: selection.year,
      label: selection.year,
      icon: 'calendario',
    });
  }
  if (selection.tone !== 'TODOS') {
    out.push({
      dimension: 'tone',
      value: selection.tone,
      label: TONE_LABEL[selection.tone] ?? selection.tone,
      icon: 'campana',
    });
  }
  if (selection.region !== 'TODOS') {
    out.push({
      dimension: 'region',
      value: selection.region,
      label: REGION_LABEL[selection.region] ?? selection.region,
      icon: 'globo',
    });
  }
  if (selection.outlet !== 'TODOS') {
    out.push({
      dimension: 'outlet',
      value: selection.outlet,
      label: selection.outlet,
      icon: 'ventana',
    });
  }
  if (selection.term !== 'TODOS') {
    out.push({
      dimension: 'term',
      value: selection.term,
      label: terms.find((entry) => entry.term === selection.term)?.label ?? selection.term,
      icon: 'etiqueta',
    });
  }
  return out;
}

export function PressExplorer({
  cube,
  initialArticles,
  span,
}: {
  cube: PressCube;
  initialArticles: PressArticle[];
  span: {
    total: number;
    outlets: number;
    firstDay: string | null;
    lastDay: string | null;
    unmarked: { archive: number; live: number; archiveLength: number; liveLength: number };
  };
}) {
  const [selection, setSelection] = useState<PressSelection>(NO_SELECTION);
  const [search, setSearch] = useState('');
  const [articles, setArticles] = useState<PressArticle[]>(initialArticles);
  /**
   * The cross-tabulation every visual is counted from.
   *
   * It is the whole corpus until the reader searches, and there is no text in
   * it to search — so a searching request brings back a cube rebuilt under the
   * same predicate and it takes over. Without that the tone strip, the years
   * and the vocabulary all keep reporting the corpus while the stories below
   * report the search, and the figures on the page are simply wrong.
   */
  const [searchCube, setSearchCube] = useState<PressCube | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * Whether the last request failed.
   *
   * A failed request used to render as an empty result: zero stories under a
   * count of zero, which reads as "there is nothing here" when what happened is
   * "we could not find out". The panel says which.
   */
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  /** Which page of the register is on screen, counted in stories skipped. */
  const [offset, setOffset] = useState(0);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const pick = (dimension: keyof PressSelection, value: string): void => {
    // Page four of a selection that no longer has four pages is a blank screen
    // with nothing on it to explain itself.
    setOffset(0);
    setSelection((current) => ({ ...current, [dimension]: value }));
  };

  const counting = searchCube ?? cube;
  const byTopic = useMemo(() => countsFor(counting, selection, 'topic'), [counting, selection]);
  const byOutlet = useMemo(() => countsFor(counting, selection, 'outlet'), [counting, selection]);
  const total = useMemo(() => totalFor(counting, selection), [counting, selection]);
  const economicTotal = useMemo(
    () => totalFor(counting, { ...selection, topic: ECONOMIC_TOPICS }),
    [counting, selection],
  );

  /**
   * Subjects by weight, with the residual last.
   *
   * Sorting «Otros» by its count put the bucket that means "no rule claimed
   * this" second from the top of the pane, above every subject the observatory
   * can actually name. A residual is not a finding and does not compete for
   * that place; it is what is left, and it reads last, where a reader looks for
   * it rather than past it.
   */
  const topics = [...byTopic.entries()]
    .filter(([, count]) => count > 0)
    .sort((left, right) => {
      if (left[0] === 'OTROS') return 1;
      if (right[0] === 'OTROS') return -1;
      return right[1] - left[1];
    });
  const outlets = [...byOutlet.entries()]
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);

  const query = pressQuery(selection, search);
  const address = query.toString();

  /**
   * The stories for the selection. The counts already changed on the click; the
   * cards catch up, and a request that is overtaken by a newer one is dropped
   * rather than allowed to land after it.
   */
  const generation = useRef(0);
  const searching = search.trim().length > 0;
  useEffect(() => {
    const mine = ++generation.current;
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/prensa?${address}${searching ? '&cubo=1' : ''}&desde=${offset}`)
        .then(
          (response) =>
            response.json() as Promise<{
              articles: PressArticle[];
              cube: PressCube | null;
              error?: string;
            }>,
        )
        .then((page) => {
          if (mine !== generation.current) return;
          // A search whose counts could not be rebuilt would leave every visual
          // reporting the corpus while the cards report the search.
          const broken = Boolean(page.error) || (searching && !page.cube);
          setFailed(broken);
          if (!broken) {
            setArticles(page.articles ?? []);
            setSearchCube(searching ? (page.cube ?? null) : null);
          }
          setLoading(false);
        })
        .catch(() => {
          if (mine !== generation.current) return;
          setFailed(true);
          setLoading(false);
        });
    }, 180);
    return () => clearTimeout(timer);
  }, [address, searching, offset]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.floor(offset / PAGE_SIZE) + 1);
  const active = activeCount(selection, search);
  const chips = chipsFor(selection, cube.terms);
  const peakTopic = topics.length ? Math.max(...topics.map(([, count]) => count)) : 1;

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

        {chips.length || search.trim() ? (
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Selección activa
            </div>
            <div className="rail-pills">
              {search.trim() ? (
                <button type="button" className="chip chip-on" onClick={() => setSearch('')}>
                  <Icon name="buscar" size={12} />«{search.trim()}» ×
                </button>
              ) : null}
              {chips.map((chip) => (
                <button
                  key={`${chip.dimension}-${chip.value}`}
                  type="button"
                  className="chip chip-on"
                  onClick={() => pick(chip.dimension, NO_SELECTION[chip.dimension])}
                  title="Quitar este filtro"
                >
                  <Icon name={chip.icon} size={12} />
                  {chip.label} ×
                </button>
              ))}
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setSelection(NO_SELECTION);
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
            <Icon name="cajas" size={13} />
            Tema
          </div>
          <button
            type="button"
            className={selection.topic === ECONOMIC_TOPICS ? 'rail-item rail-item-on' : 'rail-item'}
            onClick={() => pick('topic', ECONOMIC_TOPICS)}
          >
            <Icon name="tendencia" size={16} />
            <span className="rail-name">Sólo económicos</span>
            <span className="rail-n">{economicTotal.toLocaleString('es-BO')}</span>
          </button>
          {topics.map(([key, count]) => (
            <button
              key={key}
              type="button"
              className={selection.topic === key ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => pick('topic', selection.topic === key ? ECONOMIC_TOPICS : key)}
            >
              <Icon name={TOPIC_ICON[key] ?? 'cajas'} size={16} />
              <span className="rail-name">{TOPIC_LABEL[key] ?? key}</span>
              <span className="rail-n">{count.toLocaleString('es-BO')}</span>
            </button>
          ))}
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="ventana" size={13} />
            Medio ({outlets.length})
          </div>
          <button
            type="button"
            className={selection.outlet === 'TODOS' ? 'rail-item rail-item-on' : 'rail-item'}
            onClick={() => pick('outlet', 'TODOS')}
          >
            <Icon name="ventana" size={16} />
            <span className="rail-name">Todos los medios</span>
            <span className="rail-n">{total.toLocaleString('es-BO')}</span>
          </button>
          {outlets.map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={selection.outlet === name ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => pick('outlet', selection.outlet === name ? 'TODOS' : name)}
            >
              <Icon name="ventana" size={16} />
              <span className="rail-name">{name}</span>
              <span className="rail-n">{count.toLocaleString('es-BO')}</span>
            </button>
          ))}
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="buscar" size={13} />
            Buscar en el titular
          </div>
          <div className="rail-field">
            <input
              type="search"
              value={search}
              aria-label="Buscar en el titular de las notas"
              placeholder="diésel, dólar, reservas…"
              onChange={(event) => {
                setOffset(0);
                setSearch(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="rail-foot">
          Selección: <b>{total.toLocaleString('es-BO')}</b> nota{total === 1 ? '' : 's'}
          <br />
          de <b>{outlets.length}</b> medio{outlets.length === 1 ? '' : 's'}
          <br />
          Tema <b>derivado</b> del titular
        </div>
      </aside>

      <div className="workspace-main" id="tablero" tabIndex={-1}>
        <div className="briefcard">
          <span className="briefcard-mark">
            <Icon name="ventana" size={20} />
          </span>
          <div>
            <h2>Qué publica la prensa</h2>
            <p>
              Cobertura de siete medios bolivianos. Esta sección responde lo que ninguna serie
              puede: <strong>por qué se movió un número</strong>. Un decreto o un bloqueo se reporta
              días antes de que una tabla registre su efecto.
            </p>
            <div className="brief-points">
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="info" size={17} />
                </span>
                <div>
                  <b>Es reporte, no medición</b>
                  <span>ninguna cifra de aquí entra a una serie</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="capas" size={17} />
                </span>
                <div>
                  <b>Todo cruza con todo</b>
                  <span>tocá cualquier barra y el resto se filtra</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="diana" size={17} />
                </span>
                <div>
                  <b>Cada nota cita su medio</b>
                  <span>con el enlace y la huella del listado</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="strap">
          <Icon name={TOPIC_ICON[selection.topic] ?? 'tendencia'} size={17} />
          <h2>
            {selection.topic === ECONOMIC_TOPICS
              ? 'Cobertura económica'
              : selection.topic === 'TODOS'
                ? 'Toda la cobertura'
                : (TOPIC_LABEL[selection.topic] ?? selection.topic)}
          </h2>
          <span className="tile-hint">
            {total.toLocaleString('es-BO')} de {span.total.toLocaleString('es-BO')} nota
            {span.total === 1 ? '' : 's'}
          </span>
          <div className="download">
            <a className="download-btn" href={`/api/export?dataset=prensa&${address}&format=csv`}>
              CSV
            </a>
            <a className="download-btn" href={`/api/export?dataset=prensa&${address}&format=json`}>
              JSON
            </a>
          </div>
        </div>

        <PressPulse cube={counting} selection={selection} span={span} onPick={pick} />

        {topics.length > 1 ? (
          <div className="panel">
            <div className="tile-head">
              <Icon name="barras" size={17} />
              <h2>Cobertura por tema</h2>
              <span className="tile-hint">
                {topics.reduce((sum, [, count]) => sum + count, 0).toLocaleString('es-BO')} notas,
                sin filtrar por tema
              </span>
            </div>
            <div className="barlist">
              {topics.map(([key, count], index) => {
                const on = selection.topic === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={on ? 'barlist-row barlist-row-on' : 'barlist-row'}
                    onClick={() => pick('topic', on ? ECONOMIC_TOPICS : key)}
                  >
                    <Icon name={TOPIC_ICON[key] ?? 'cajas'} size={14} />
                    <span className="barlist-name">{TOPIC_LABEL[key] ?? key}</span>
                    <span className="barlist-track">
                      <span
                        className="barlist-fill"
                        style={{
                          width: `${(count / peakTopic) * 100}%`,
                          background: on ? 'var(--ink)' : BAR_TONES[index % BAR_TONES.length],
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

        {failed ? (
          <div className="callout callout-warn">
            <Icon name="campana" size={14} /> No se pudo consultar esta selección, así que la página
            no muestra cifras que no pudo verificar. Las de arriba son de la selección anterior.
          </div>
        ) : null}

        {total > PAGE_SIZE ? (
          <p className="panel-sub register-note">
            <Icon name="reloj" size={13} /> El registro va de lo más reciente a lo más antiguo:
            página <b>{page}</b> de <b>{pages.toLocaleString('es-BO')}</b>,{' '}
            <b>{total.toLocaleString('es-BO')}</b> notas en esta selección. La descarga trae la
            selección completa.
          </p>
        ) : null}

        {articles.length ? (
          <div className={loading ? 'filing-grid filing-grid-loading' : 'filing-grid'}>
            {articles.map((article, index) => {
              const isOpen = open.has(article.factClaimId);
              return (
                <article
                  className={
                    isOpen ? 'filing-card filing-card-open' : 'filing-card filing-card-tight'
                  }
                  key={article.factClaimId}
                  style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                >
                  <div className="filing-top">
                    <Icon name={TOPIC_ICON[article.topic] ?? 'cajas'} size={13} />
                    <span>{article.outlet}</span>
                    <span className="filing-date">{article.eventDate}</span>
                  </div>
                  <h4>{article.headline}</h4>
                  <p className="filing-filer">
                    {TOPIC_LABEL[article.topic] ?? article.topic} · {article.section}
                  </p>
                  {article.summary ? <p className="filing-summary">{article.summary}</p> : null}
                  <p className="filing-foot">
                    <button
                      type="button"
                      className="filing-toggle"
                      onClick={() => toggle(article.factClaimId)}
                      aria-expanded={isOpen}
                    >
                      <Icon name={isOpen ? 'plegar' : 'desplegar'} size={13} />
                      {isOpen ? 'Plegar' : 'Ver completo'}
                    </button>
                    <span style={{ color: 'var(--ink-faint)' }}>{article.domain}</span>
                    <a href={article.url} target="_blank" rel="noreferrer noopener">
                      leer en el medio
                    </a>
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="callout">
            {loading ? (
              'Buscando las notas de esta selección…'
            ) : search.trim() ? (
              <>
                Ninguna nota contiene «{search.trim()}» con los demás filtros puestos.{' '}
                <button type="button" className="callout-link" onClick={() => setSearch('')}>
                  Quitar la búsqueda
                </button>
              </>
            ) : (
              'Ninguna nota coincide con esta selección.'
            )}
          </div>
        )}
        {pages > 1 ? (
          <nav className="pager" aria-label="Páginas del registro">
            <button
              type="button"
              className="pager-step"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={page <= 1 || loading}
            >
              <Icon name="plegar" size={14} /> Más recientes
            </button>
            <span className="pager-where">
              Página <b>{page}</b> de <b>{pages.toLocaleString('es-BO')}</b>
            </span>
            <button
              type="button"
              className="pager-step"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={page >= pages || loading}
            >
              Más antiguas <Icon name="desplegar" size={14} />
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
