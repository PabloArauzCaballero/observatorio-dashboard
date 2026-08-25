'use client';

import { useMemo, useState } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';
import { PressPulse } from './press-pulse';
import type { PressArticle, TermMention } from '@/lib/series';

/**
 * What the Bolivian press published, filtered by outlet and by subject.
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
  OTROS: 'cajas',
};

const TONES = ['var(--official)', 'var(--parallel)', 'var(--gap)', 'var(--down)', 'var(--up)'];

/** Economic subjects, so the default view is the observatory's own remit. */
const ECONOMIC = Object.keys(TOPIC_LABEL).filter((key) => key !== 'OTROS');

const SHOWN = 40;

export function PressExplorer({
  articles,
  terms,
}: {
  articles: PressArticle[];
  terms: TermMention[];
}) {
  const [topic, setTopic] = useState('ECONOMICOS');
  const [outlet, setOutlet] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [tone, setTone] = useState('TODOS');
  const [region, setRegion] = useState('TODOS');
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of articles) counts.set(article.topic, (counts.get(article.topic) ?? 0) + 1);
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [articles]);

  const economicCount = useMemo(
    () => articles.filter((article) => ECONOMIC.includes(article.topic)).length,
    [articles],
  );

  const outlets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of articles) {
      if (topic === 'ECONOMICOS' && !ECONOMIC.includes(article.topic)) continue;
      if (topic !== 'ECONOMICOS' && topic !== 'TODOS' && article.topic !== topic) continue;
      counts.set(article.outlet, (counts.get(article.outlet) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [articles, topic]);

  const selected = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return articles.filter(
      (article) =>
        (topic === 'TODOS' ||
          (topic === 'ECONOMICOS' ? ECONOMIC.includes(article.topic) : article.topic === topic)) &&
        (outlet === 'TODOS' || article.outlet === outlet) &&
        (tone === 'TODOS' || article.tone === tone) &&
        (region === 'TODOS' || article.region === region) &&
        (!term ||
          article.headline.toLocaleLowerCase('es').includes(term) ||
          (article.summary ?? '').toLocaleLowerCase('es').includes(term)),
    );
  }, [articles, topic, outlet, tone, region, search]);

  const peak = topics.length ? Math.max(...topics.map(([, count]) => count)) : 1;
  const active =
    (topic === 'ECONOMICOS' ? 0 : 1) +
    (outlet === 'TODOS' ? 0 : 1) +
    (tone === 'TODOS' ? 0 : 1) +
    (region === 'TODOS' ? 0 : 1) +
    (search ? 1 : 0);

  const query = new URLSearchParams({
    dataset: 'prensa',
    ...(topic === 'ECONOMICOS' || topic === 'TODOS' ? {} : { tema: topic }),
    ...(outlet === 'TODOS' ? {} : { medio: outlet }),
    ...(tone === 'TODOS' ? {} : { tono: tone }),
    ...(region === 'TODOS' ? {} : { region }),
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
            Tema
          </div>
          <button
            type="button"
            className={topic === 'ECONOMICOS' ? 'rail-item rail-item-on' : 'rail-item'}
            onClick={() => {
              setTopic('ECONOMICOS');
              setOutlet('TODOS');
            }}
          >
            <Icon name="tendencia" size={16} />
            <span className="rail-name">Sólo económicos</span>
            <span className="rail-n">{economicCount}</span>
          </button>
          {topics.map(([key, count]) => (
            <button
              key={key}
              type="button"
              className={topic === key ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => {
                setTopic(topic === key ? 'ECONOMICOS' : key);
                setOutlet('TODOS');
              }}
            >
              <Icon name={TOPIC_ICON[key] ?? 'cajas'} size={16} />
              <span className="rail-name">{TOPIC_LABEL[key] ?? key}</span>
              <span className="rail-n">{count}</span>
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
            className={outlet === 'TODOS' ? 'rail-item rail-item-on' : 'rail-item'}
            onClick={() => setOutlet('TODOS')}
          >
            <Icon name="ventana" size={16} />
            <span className="rail-name">Todos los medios</span>
            <span className="rail-n">{selected.length}</span>
          </button>
          {outlets.map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={outlet === name ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => setOutlet(outlet === name ? 'TODOS' : name)}
            >
              <Icon name="ventana" size={16} />
              <span className="rail-name">{name}</span>
              <span className="rail-n">{count}</span>
            </button>
          ))}
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="campana" size={13} />
            Tono
          </div>
          <div className="rail-field">
            <select value={tone} onChange={(event) => setTone(event.target.value)}>
              <option value="TODOS">Cualquier tono</option>
              <option value="ALARMA">Alarma</option>
              <option value="CONFLICTO">Conflicto</option>
              <option value="DETERIORO">Deterioro</option>
              <option value="INCERTIDUMBRE">Incertidumbre</option>
              <option value="MEJORA">Mejora</option>
              <option value="DESINFORMACION">Desinformación</option>
              <option value="NEUTRO">Sin marca</option>
            </select>
          </div>
        </div>

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="globo" size={13} />
            Departamento
          </div>
          <div className="rail-field">
            <select value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="TODOS">Todo el país</option>
              <option value="SANTA_CRUZ">Santa Cruz</option>
              <option value="LA_PAZ">La Paz</option>
              <option value="COCHABAMBA">Cochabamba</option>
              <option value="ORURO">Oruro</option>
              <option value="POTOSI">Potosí</option>
              <option value="TARIJA">Tarija</option>
              <option value="CHUQUISACA">Chuquisaca</option>
              <option value="BENI">Beni</option>
              <option value="PANDO">Pando</option>
              <option value="NACIONAL">Sin departamento</option>
            </select>
          </div>
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
              placeholder="diésel, dólar, reservas…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="rail-foot">
          Selección: <b>{selected.length}</b> nota{selected.length === 1 ? '' : 's'}
          <br />
          de <b>{new Set(selected.map((article) => article.outlet)).size}</b> medio
          {new Set(selected.map((article) => article.outlet)).size === 1 ? '' : 's'}
          <br />
          Tema <b>derivado</b> del titular
        </div>
      </aside>

      <div className="workspace-main">
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
                  <Icon name="cajas" size={17} />
                </span>
                <div>
                  <b>Tema derivado</b>
                  <span>del titular; el medio no lo publica</span>
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
          <Icon name={TOPIC_ICON[topic] ?? 'tendencia'} size={17} />
          <h2>
            {topic === 'ECONOMICOS'
              ? 'Cobertura económica'
              : topic === 'TODOS'
                ? 'Toda la cobertura'
                : (TOPIC_LABEL[topic] ?? topic)}
          </h2>
          <span className="tile-hint">
            {selected.length} nota{selected.length === 1 ? '' : 's'}
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

        <PressPulse
          articles={articles}
          terms={terms}
          tone={tone}
          region={region}
          onTone={setTone}
          onRegion={setRegion}
        />

        {topics.length > 1 ? (
          <div className="panel">
            <div className="tile-head">
              <Icon name="barras" size={17} />
              <h2>Cobertura por tema</h2>
              <span className="tile-hint">{articles.length} notas</span>
            </div>
            <div className="barlist">
              {topics.map(([key, count], index) => (
                <button
                  key={key}
                  type="button"
                  className="barlist-row"
                  onClick={() => {
                    setTopic(topic === key ? 'ECONOMICOS' : key);
                    setOutlet('TODOS');
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
                  <Icon name={TOPIC_ICON[key] ?? 'cajas'} size={14} />
                  <span className="barlist-name">{TOPIC_LABEL[key] ?? key}</span>
                  <span className="barlist-track">
                    <span
                      className="barlist-fill"
                      style={{
                        width: `${(count / peak) * 100}%`,
                        background: topic === key ? 'var(--ink)' : TONES[index % TONES.length],
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
            {selected.slice(0, SHOWN).map((article, index) => {
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
          <div className="callout">Ninguna nota coincide con esta selección.</div>
        )}

        {selected.length > SHOWN ? (
          <p className="panel-sub">
            Se muestran las {SHOWN} más recientes de {selected.length}. La descarga incluye la
            selección completa.
          </p>
        ) : null}
      </div>
    </div>
  );
}
