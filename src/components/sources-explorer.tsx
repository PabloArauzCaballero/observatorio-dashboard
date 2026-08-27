'use client';

import { useMemo, useState } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { SourceNote } from '@/lib/series';

/**
 * Where every figure in the report came from, and what to know before reading it.
 *
 * This is the page that has to answer "can I check this", so it is a table
 * rather than a list: what the series measures, who publishes it, how many
 * readings there are, how many documents they were assembled from and over what
 * span. Columns that line up let a reader compare series down the page instead
 * of reading each row as a sentence.
 *
 * A hundred and eleven series is more than anyone reads at once, so the
 * publisher and the frequency are slicers, each counted under the other. The
 * methodological notes below are the caveats a figure cannot carry in its own
 * cell, and they are cards rather than a wall of prose because a reader looks
 * for the one that applies to what they are about to quote.
 */

/** Daily series carry no published name; these are the report's own. */
const NAMES: Record<string, string> = {
  FX_OFFICIAL_USD_BOB: 'Tipo de cambio oficial',
  FX_PARALLEL_USD_BOB: 'Dólar paralelo',
  UFV_BOB: 'Unidad de Fomento de Vivienda',
  BTC_USD: 'Bitcoin',
  USDT_USD: 'Estables USDT/USDC',
  XAU_USD: 'Oro (PAX Gold)',
  GOLD_USD_OZT: 'Oro, cotización oficial del BCB',
};

const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  ANNUAL: 'Anual',
};

const FREQUENCY_ICON: Record<string, IconName> = {
  DAILY: 'reloj',
  WEEKLY: 'calendario',
  MONTHLY: 'calendario',
  QUARTERLY: 'calendario',
  ANNUAL: 'capas',
};

const PUBLISHER_ICON: Record<string, IconName> = {
  'BANCO MUNDIAL': 'globo',
  'BANCO CENTRAL DE BOLIVIA': 'banco',
  'DOLAR BLUE BOLIVIA': 'monedas',
  BINANCE: 'chip',
};

/** The caveats a figure cannot carry in its own cell. */
interface Note {
  icon: IconName;
  title: string;
  body: React.ReactNode;
}

export function SourcesExplorer({
  sources,
  readingCount,
  reversal,
}: {
  sources: SourceNote[];
  readingCount: number;
  /** The day the parallel source swapped its two labels, when it did. */
  reversal: string | null;
}) {
  const [publisher, setPublisher] = useState('TODOS');
  const [frequency, setFrequency] = useState('TODAS');
  const [search, setSearch] = useState('');

  const named = (source: SourceNote): string =>
    NAMES[source.indicator] ?? source.name ?? source.indicator;

  /** A row survives every slicer but the one being counted. */
  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return (source: SourceNote, except: 'publisher' | 'frequency' | null): boolean =>
      (except === 'publisher' || publisher === 'TODOS' || source.publisher === publisher) &&
      (except === 'frequency' || frequency === 'TODAS' || source.frequency === frequency) &&
      (!term ||
        source.indicator.toLocaleLowerCase('es').includes(term) ||
        (NAMES[source.indicator] ?? source.name ?? '').toLocaleLowerCase('es').includes(term));
  }, [publisher, frequency, search]);

  const publishers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const source of sources) {
      if (!matches(source, 'publisher')) continue;
      counts.set(source.publisher, (counts.get(source.publisher) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [sources, matches]);

  const frequencies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const source of sources) {
      if (!matches(source, 'frequency') || !source.frequency) continue;
      counts.set(source.frequency, (counts.get(source.frequency) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [sources, matches]);

  const selected = useMemo(
    () =>
      sources
        .filter((source) => matches(source, null))
        .sort((left, right) => named(left).localeCompare(named(right), 'es')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sources, matches],
  );

  const readings = selected.reduce((sum, source) => sum + source.readings, 0);
  const documents = selected.reduce((sum, source) => sum + source.documents, 0);
  const active =
    (publisher === 'TODOS' ? 0 : 1) + (frequency === 'TODAS' ? 0 : 1) + (search.trim() ? 1 : 0);

  const notes: Note[] = [
    {
      icon: 'balanza',
      title: 'Los dos lados del paralelo no son una horquilla compra/venta',
      body: (
        <>
          La fuente publica dos valores por día bajo las etiquetas <code>buy</code> y{' '}
          <code>sell</code>.
          {reversal ? (
            <>
              {' '}
              Su orden <strong>se invierte el {reversal}</strong>: antes de esa fecha uno es
              sistemáticamente mayor y después el otro. Una horquilla de compra y venta no puede
              intercambiarse, así que estas etiquetas no corresponden a la convención boliviana.
            </>
          ) : (
            ' Se reportan tal como las publica la fuente.'
          )}{' '}
          Por eso el informe no las traduce, encabeza con el <strong>punto medio</strong> —que no
          depende de esa distinción— y mide la brecha contra él.
        </>
      ),
    },
    {
      icon: 'banco',
      title: 'El oficial sí es consistente',
      body: (
        <>
          En el tipo de cambio oficial el lado «sell» es mayor o igual al «buy» en toda la serie.
          Cuando existe el valor único que publica el Banco Central, el informe usa ese; si no, el
          lado «sell», que es lo que paga quien adquiere dólares.
        </>
      ),
    },
    {
      icon: 'sigma',
      title: 'Valor del día',
      body: (
        <>
          Cuando varias plazas cotizan el mismo día, el valor publicado es la{' '}
          <strong>mediana discreta</strong>: resiste que una plaza se desvíe y devuelve un precio
          efectivamente cotizado en lugar de un valor intermedio que nadie ofreció.
        </>
      ),
    },
    {
      icon: 'reloj',
      title: 'Promedio diario frente a lectura puntual',
      body: (
        <>
          La serie anterior al inicio de la recolección diaria es un{' '}
          <strong>promedio diario</strong> de las cotizaciones intradía; desde que el recolector
          opera, cada lectura es el precio <strong>en el momento</strong> de la consulta. Son
          estadísticos distintos y no se promedian entre sí.
        </>
      ),
    },
    {
      icon: 'capas',
      title: 'Frecuencias separadas',
      body: (
        <>
          Una cifra anual y un precio cotizado a diario viven en modelos de lectura distintos, de
          modo que ningún gráfico puede ponerlas en el mismo eje ni promediarlas.
        </>
      ),
    },
    {
      icon: 'diana',
      title: 'Trazabilidad y sus límites',
      body: (
        <>
          Cada lectura cita su fuente y conserva el hash del documento del que se obtuvo. En la
          serie histórica del <strong>oficial</strong> y en los hechos relevantes, la cita es el
          fragmento literal del que se leyó el dato. En la del <strong>paralelo</strong>, cargada
          antes de esa mejora, es una reformulación de los valores y no un extracto literal: sigue
          siendo trazable hasta el documento y su hash, pero no al nivel de la cita.
        </>
      ),
    },
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

        {active ? (
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} />
              Selección activa
            </div>
            <div className="rail-pills">
              {publisher === 'TODOS' ? null : (
                <button
                  type="button"
                  className="chip chip-on"
                  onClick={() => setPublisher('TODOS')}
                >
                  <Icon name={PUBLISHER_ICON[publisher] ?? 'edificio'} size={12} />
                  {publisher} ×
                </button>
              )}
              {frequency === 'TODAS' ? null : (
                <button
                  type="button"
                  className="chip chip-on"
                  onClick={() => setFrequency('TODAS')}
                >
                  <Icon name={FREQUENCY_ICON[frequency] ?? 'calendario'} size={12} />
                  {FREQUENCY_LABEL[frequency] ?? frequency} ×
                </button>
              )}
              {search.trim() ? (
                <button type="button" className="chip chip-on" onClick={() => setSearch('')}>
                  <Icon name="buscar" size={12} />«{search.trim()}» ×
                </button>
              ) : null}
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setPublisher('TODOS');
                  setFrequency('TODAS');
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
            <Icon name="edificio" size={13} />
            Publicador
          </div>
          <button
            type="button"
            className={publisher === 'TODOS' ? 'rail-item rail-item-on' : 'rail-item'}
            onClick={() => setPublisher('TODOS')}
          >
            <Icon name="capas" size={16} />
            <span className="rail-name">Todos los publicadores</span>
            <span className="rail-n">{publishers.reduce((sum, [, count]) => sum + count, 0)}</span>
          </button>
          {publishers.map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={publisher === name ? 'rail-item rail-item-on' : 'rail-item'}
              onClick={() => setPublisher(publisher === name ? 'TODOS' : name)}
            >
              <Icon name={PUBLISHER_ICON[name] ?? 'edificio'} size={16} />
              <span className="rail-name">{name}</span>
              <span className="rail-n">{count}</span>
            </button>
          ))}
        </div>

        {frequencies.length > 1 ? (
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} />
              Frecuencia
            </div>
            {frequencies.map(([key, count]) => (
              <button
                key={key}
                type="button"
                className={frequency === key ? 'rail-item rail-item-on' : 'rail-item'}
                onClick={() => setFrequency(frequency === key ? 'TODAS' : key)}
              >
                <Icon name={FREQUENCY_ICON[key] ?? 'calendario'} size={16} />
                <span className="rail-name">{FREQUENCY_LABEL[key] ?? key}</span>
                <span className="rail-n">{count}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="rail-sec">
          <div className="rail-head">
            <Icon name="buscar" size={13} />
            Buscar serie
          </div>
          <div className="rail-field">
            <input
              type="search"
              value={search}
              aria-label="Buscar una serie por nombre o código"
              placeholder="reservas, deuda, dólar…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="rail-foot">
          Selección: <b>{selected.length}</b> serie{selected.length === 1 ? '' : 's'}
          <br />
          <b>{readings.toLocaleString('es-BO')}</b> lecturas
          <br />
          de <b>{documents.toLocaleString('es-BO')}</b> documento
          {documents === 1 ? '' : 's'}
        </div>
      </aside>

      <div className="workspace-main" id="tablero" tabIndex={-1}>
        <div className="briefcard">
          <span className="briefcard-mark">
            <Icon name="diana" size={20} />
          </span>
          <div>
            <h2>De dónde sale cada cifra</h2>
            <p>
              Toda lectura de este informe cita el documento del que se leyó y conserva su{' '}
              <strong>huella sha256</strong>. Abajo está una fila por serie y publicador, con
              cuántas lecturas tiene y de cuántos documentos se armó.
            </p>
            <div className="brief-points">
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="escudo" size={17} />
                </span>
                <div>
                  <b>Nada sin fuente</b>
                  <span>una cifra sin documento no se publica</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="capas" size={17} />
                </span>
                <div>
                  <b>Frecuencias aparte</b>
                  <span>lo anual y lo diario nunca comparten eje</span>
                </div>
              </div>
              <div className="brief-point">
                <span className="brief-point-mark">
                  <Icon name="refrescar" size={17} />
                </span>
                <div>
                  <b>Correcciones, no borrados</b>
                  <span>una lectura corregida crea una revisión</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="strap">
          <Icon name={PUBLISHER_ICON[publisher] ?? 'capas'} size={17} />
          <h2>{publisher === 'TODOS' ? 'Todas las fuentes' : publisher}</h2>
          <span className="tile-hint">
            {selected.length} serie{selected.length === 1 ? '' : 's'} ·{' '}
            {readings.toLocaleString('es-BO')} lecturas
          </span>
        </div>

        {selected.length ? (
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Serie</th>
                  <th>Publicador</th>
                  <th>Frecuencia</th>
                  <th className="num">Lecturas</th>
                  <th className="num">Docs.</th>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((source) => (
                  <tr key={`${source.indicator}-${source.publisher}`}>
                    <td>
                      <span className="cell-name">{named(source)}</span>
                      <code className="cell-code">{source.indicator}</code>
                    </td>
                    <td>{source.publisher}</td>
                    <td>
                      {source.frequency
                        ? (FREQUENCY_LABEL[source.frequency] ?? source.frequency)
                        : '—'}
                    </td>
                    <td className="num">{source.readings.toLocaleString('es-BO')}</td>
                    <td className="num">{source.documents.toLocaleString('es-BO')}</td>
                    <td className="num">{source.firstDay}</td>
                    <td className="num">{source.lastDay}</td>
                    <td>
                      <a href={source.sourceUrl} target="_blank" rel="noreferrer noopener">
                        abrir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    {selected.length} serie{selected.length === 1 ? '' : 's'}
                  </td>
                  <td className="num">{readings.toLocaleString('es-BO')}</td>
                  <td className="num">{documents.toLocaleString('es-BO')}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="callout">Ninguna serie coincide con esta selección.</div>
        )}

        <div className="strap">
          <Icon name="info" size={17} />
          <h2>Notas metodológicas</h2>
          <span className="tile-hint">{notes.length} advertencias</span>
        </div>

        <div className="note-grid">
          {notes.map((note) => (
            <article className="note-card" key={note.title}>
              <span className="note-mark">
                <Icon name={note.icon} size={17} />
              </span>
              <div>
                <h3>{note.title}</h3>
                <p>{note.body}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="panel-sub">
          El núcleo del observatorio guarda {readingCount.toLocaleString('es-BO')} puntos de serie
          en total, con o sin filtro.
        </p>
      </div>
    </div>
  );
}
