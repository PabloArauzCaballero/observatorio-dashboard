'use client';

import { useMemo, useState } from 'react';
import { ChartLegend, DatedLines, HeatGrid, ShareBars, TermCloud, YearStackBars } from './charts';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import { OnOpenNotice, useOnOpen } from './on-open';
import { Panel } from '@/components/ui/panel';
import { ViewToggle } from '@/components/ui/view-toggle';
import { additive, picked, toggle, type Choice } from '@/lib/choice';
import { productName, readable } from '@/lib/live-words';
import {
  KIND_LABEL,
  NO_VIDEO_FILTERS,
  ORIGIN_LABEL,
  TACTIC_LABEL,
  daily,
  filterVideos,
  formats,
  publishHeat,
  rubroByYear,
  tactics,
  videoOptions,
  videoPrices,
  type VideoBoard,
  type VideoDimension,
  type VideoFilters,
} from '@/lib/tiktok-videos-board';

/**
 * «Empresas › Videos de vendedores»: lo que publican en TikTok los vendedores que se ven en los lives
 * bolivianos y las cuentas parecidas que sus perfiles sugieren (ADR 0031 del núcleo). Catálogo aparte de
 * «Ventas en vivo»: un video no es un live.
 */

const SOURCE =
  'Perfiles públicos de TikTok de vendedores bolivianos, leídos por el Observatorio sin iniciar sesión (cifras al día de la lectura)';
const MIN_PRICES = 3;

const count = (value: number): string => value.toLocaleString('es-BO');
const decimal = (value: number | null, digits = 1): string =>
  value === null ? '—' : value.toLocaleString('es-BO', { maximumFractionDigits: digits });
const barsKey = (label: string) => <ChartLegend items={[{ color: 'var(--official)', label }]} />;

const DIMENSION_LABEL: Record<VideoDimension, { title: string; icon: 'tienda' | 'personas' | 'capas' | 'mapa' }> = {
  kind: { title: 'Clase de cuenta', icon: 'tienda' },
  origin: { title: 'Cómo se la encontró', icon: 'personas' },
  rubro: { title: 'Rubro', icon: 'capas' },
  city: { title: 'Departamento', icon: 'mapa' },
};

export function TiktokVideosExplorer({ board }: { board: VideoBoard }) {
  const [filters, setFilters] = useState<VideoFilters>(NO_VIDEO_FILTERS);
  const [tacticView, setTacticView] = useState<'share' | 'likes'>('share');

  const labelOf = (dimension: VideoDimension, value: string): string => {
    switch (dimension) {
      case 'kind':
        return KIND_LABEL[value] ?? value;
      case 'origin':
        return ORIGIN_LABEL[value] ?? value;
      case 'rubro':
        return board.rubros[value] ?? (value === 'SIN_IDENTIFICAR' ? 'Sin rubro identificado' : value);
      case 'city':
        return board.departments[value] ?? 'Sin dato';
    }
  };

  const videos = useMemo(() => filterVideos(board, filters), [board, filters]);
  const sellers = useMemo(() => new Set(videos.map((video) => video.seller)), [videos]);
  const days = daily(videos);
  const byYear = rubroByYear(videos);
  const rubrosShown = [...new Set(videos.map((video) => video.rubro))]
    .map((rubro) => ({ rubro, n: videos.filter((video) => video.rubro === rubro).length }))
    .sort((a, b) => b.n - a.n);
  const prices = videoPrices(videos, MIN_PRICES);
  const tacticRows = tactics(videos);
  const formatRows = formats(videos);
  const years = [...new Set(board.videos.map((video) => video.date.slice(0, 4)))].sort();
  const rubroFilter = filters.rubro;
  const termTotals = new Map<string, number>();
  for (const term of board.terms) {
    if (rubroFilter.size && !rubroFilter.has(term.rubro)) continue;
    termTotals.set(term.term, (termTotals.get(term.term) ?? 0) + term.count);
  }
  const cloud = [...termTotals.entries()].map(([term, value]) => ({ term, label: `#${term}`, value, adverse: null }));
  const coverage = board.coverage;
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;

  const set = (dimension: VideoDimension, value: string, add: boolean): void =>
    setFilters((current) => ({ ...current, [dimension]: toggle(current[dimension] as Choice, value, add) }));
  const active =
    (['kind', 'origin', 'rubro', 'city'] as const).filter((dimension) => filters[dimension].size).length +
    (filters.fromYear ? 1 : 0) +
    (filters.toYear ? 1 : 0);

  if (!board.videos.length) {
    return (
      <Panel id="videos-de-vendedores-vacio" title="Videos de vendedores leídos (cantidad)" source={SOURCE}>
        <div className="callout">Todavía no hay una lectura de videos publicada.</div>
      </Panel>
    );
  }

  return (
    <>
      <Panel
        id="videos-de-vendedores-resumen"
        title="Videos de vendedores bolivianos leídos (cantidad)"
        lede={`Lo que publican en TikTok quienes venden, cocinan o entretienen en vivo, y cuentas parecidas, del ${first ?? '—'} al ${last ?? '—'}. Es un catálogo aparte de «Ventas en vivo»: un video no es un live.`}
        source={SOURCE}
        {...(board.analyzedAt ? { updated: board.analyzedAt.slice(0, 10) } : {})}
      >
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Videos en el recorte</span>
            <span className="stat-value">{count(videos.length)}</span>
            <span className="stat-hint">de {count(board.videos.length)} leídos</span>
          </div>
          <div className="stat">
            <span className="stat-label">Cuentas</span>
            <span className="stat-value">{count(sellers.size)}</span>
            <span className="stat-hint">de {count(board.accounts.length)} bolivianas incluidas</span>
          </div>
          <div className="stat">
            <span className="stat-label">Vistas sumadas</span>
            <span className="stat-value">{decimal(videos.reduce((sum, video) => sum + (video.plays ?? 0), 0) / 1_000_000)} M</span>
            <span className="stat-hint">al día de la lectura, no el día de publicación</span>
          </div>
          <div className="stat">
            <span className="stat-label">Con precio en el texto</span>
            <span className="stat-value">{decimal(videos.length ? (100 * videos.filter((video) => video.tactics.includes('PRECIO')).length) / videos.length : null)} %</span>
            <span className="stat-hint">de los videos del recorte</span>
          </div>
        </div>
        {coverage ? (
          <ul className="social-coverage" aria-label="Cobertura de la lectura de videos">
            <li>
              <b>Cuentas</b> {count(coverage.accountsRead)} leídas · {count(coverage.accountsIncluded)} incluidas ·{' '}
              {count(coverage.excludedNotBolivia)} fuera por no ser de Bolivia · {count(coverage.excludedNoActivity)} fuera por no vender ni
              entretener
            </li>
            <li>
              <b>Videos por año</b>{' '}
              {Object.entries(coverage.videosByYear)
                .map(([year, n]) => `${year}: ${count(n)}`)
                .join(' · ')}
            </li>
          </ul>
        ) : null}
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            Sin iniciar sesión, TikTok muestra de cada perfil sus videos más recientes (unos 16 a 35). Para quien publica poco eso llega
            años atrás; para quien publica a diario, semanas. Por eso la serie diaria está cargada hacia lo reciente: los años viejos
            tienen menos videos porque se ven menos, no necesariamente porque se vendía menos. Las vistas y los me gusta son los que cada
            video tenía el día que se leyó. De cada video se guardan solo marcas (dice el precio, ofrece envío, anuncia un live…), nunca
            su texto ni su autor.
          </p>
        </details>
      </Panel>

      <div className="workspace">
        <aside className="rail" id="videos-de-vendedores-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">{active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}</span>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} /> Años
            </div>
            <div className="rail-field">
              <select aria-label="Desde el año" value={filters.fromYear} onChange={(event) => setFilters((current) => ({ ...current, fromYear: event.target.value }))}>
                <option value="">Desde el primero</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    Desde {year}
                  </option>
                ))}
              </select>
              <select aria-label="Hasta el año" value={filters.toYear} onChange={(event) => setFilters((current) => ({ ...current, toYear: event.target.value }))}>
                <option value="">Hasta hoy</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    Hasta {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(['kind', 'origin', 'rubro', 'city'] as const).map((dimension) => (
            <div className="rail-sec" key={dimension}>
              <div className="rail-head">
                <Icon name={DIMENSION_LABEL[dimension].icon} size={13} /> {DIMENSION_LABEL[dimension].title} <PickedCount choice={filters[dimension]} />
              </div>
              {dimension === 'rubro' ? <FilterHint /> : null}
              <div className={dimension === 'rubro' ? 'rail-list rail-list-cut' : 'rail-list'}>
                {videoOptions(board, filters, dimension).map((option) => {
                  const on = picked(filters[dimension], option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={on ? 'rail-item rail-item-on' : 'rail-item'}
                      aria-pressed={on}
                      disabled={!on && option.count === 0}
                      onClick={(event) => set(dimension, option.value, additive(event))}
                    >
                      <span className="rail-name">{labelOf(dimension, option.value)}</span>
                      <span className="rail-n">{option.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {active ? (
            <div className="rail-sec">
              <button type="button" className="chip" onClick={() => setFilters(NO_VIDEO_FILTERS)}>
                Limpiar todo
              </button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main">
          <Panel
            id="videos-de-vendedores-dia"
            title="Videos publicados por día, por clase de cuenta (cantidad)"
            lede="Día a día desde el video más antiguo leído. La serie está cargada hacia lo reciente (ver «Cómo leerlo»)."
            source={SOURCE}
          >
            <ViewToggle
              chart={
                <DatedLines
                  data={days.map((row) => ({ date: row.date, venta: row.VENTA, gastronomia: row.GASTRONOMIA, entretenimiento: row.ENTRETENIMIENTO }))}
                  series={[
                    { key: 'venta', label: 'Venta (videos por día)', tone: 'var(--series-1)', emphasis: true },
                    { key: 'gastronomia', label: 'Gastronomía (videos por día)', tone: 'var(--series-2)' },
                    { key: 'entretenimiento', label: 'Entretenimiento (videos por día)', tone: 'var(--series-3)' },
                  ]}
                  unit="videos"
                  decimals={0}
                  yearTicks
                />
              }
              table={
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Venta</th>
                      <th>Gastronomía</th>
                      <th>Entretenimiento</th>
                      <th>Vistas (al día de lectura)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...days].reverse().filter((row) => row.VENTA + row.GASTRONOMIA + row.ENTRETENIMIENTO > 0).map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{count(row.VENTA)}</td>
                        <td>{count(row.GASTRONOMIA)}</td>
                        <td>{count(row.ENTRETENIMIENTO)}</td>
                        <td>{count(row.plays)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            />
          </Panel>

          <Panel
            id="videos-de-vendedores-vistas"
            title="Vistas de los videos publicados cada día (millones de vistas, al día de la lectura)"
            lede="Cuánta atención juntó lo que se publicó cada día. Un video viejo tuvo más tiempo para sumar vistas."
            source={SOURCE}
          >
            <DatedLines
              data={days.map((row) => ({ date: row.date, vistas: Math.round(row.plays / 10_000) / 100 }))}
              series={[{ key: 'vistas', label: 'Vistas de los videos publicados ese día (millones)', tone: 'var(--series-1)' }]}
              unit="millones de vistas"
              decimals={2}
              yearTicks
            />
          </Panel>

          <Panel
            id="videos-de-vendedores-rubros"
            title="Qué se vendía cada año (% de los videos del año por rubro)"
            lede="El rubro sale del producto que nombra cada video o, si no nombra ninguno, del rubro de la cuenta."
            source={SOURCE}
          >
            <YearStackBars
              data={byYear}
              parts={rubrosShown.map(({ rubro }) => ({ key: rubro, label: labelOf('rubro', rubro) }))}
              mode="share"
              unit="% de los videos"
              height={260}
            />
          </Panel>

          <div className="grid-pair">
            <Panel
              id="videos-de-vendedores-tacticas"
              title={tacticView === 'share' ? 'Cómo venden: marcas en el texto del video (% de los videos)' : 'Interacción según la marca (me gusta por cada 1.000 vistas, mediana)'}
              lede="Lo que el vendedor hace en el texto para vender. La interacción se compara con la mediana de todos los videos del recorte."
              source={SOURCE}
            >
              <div className="rail-pills">
                {(
                  [
                    ['share', 'Cuánto se usa'],
                    ['likes', 'Interacción que logra'],
                  ] as const
                ).map(([value, label]) => (
                  <button key={value} type="button" className={tacticView === value ? 'chip chip-on' : 'chip'} aria-pressed={tacticView === value} onClick={() => setTacticView(value)}>
                    {label}
                  </button>
                ))}
              </div>
              <ShareBars
                data={tacticRows.map((row) => ({
                  name: TACTIC_LABEL[row.tactic] ?? row.tactic,
                  value: tacticView === 'share' ? row.share : (row.likesPerThousand ?? 0),
                  parts: [
                    { name: 'Videos', value: row.videos },
                    ...(row.baseline !== null ? [{ name: 'Mediana de todos (me gusta por mil)', value: row.baseline }] : []),
                  ],
                }))}
                unit={tacticView === 'share' ? '%' : 'por mil'}
                height={Math.max(220, tacticRows.length * 30)}
              />
              {barsKey(tacticView === 'share' ? 'Parte de los videos del recorte con esa marca, en %' : 'Me gusta por cada 1.000 vistas, mediana de los videos con esa marca')}
            </Panel>
            <Panel
              id="videos-de-vendedores-formato"
              title="Formato y duración de los videos (% de los videos)"
              lede="Fotos y carruseles frente a videos, por duración."
              source={SOURCE}
            >
              <ShareBars data={formatRows.map((row) => ({ name: row.band, value: row.share, parts: [{ name: 'Videos', value: row.videos }] }))} unit="%" height={240} />
              {barsKey('Parte de los videos del recorte, en %')}
            </Panel>
          </div>

          <Panel
            id="videos-de-vendedores-precios"
            title="Precio mediano por producto en los videos (Bs)"
            lede={`Precios escritos en el texto de los videos, con moneda explícita. Solo productos con ${MIN_PRICES} precios o más.`}
            source={SOURCE}
          >
            {prices.length ? (
              <ViewToggle
                chart={
                  <>
                    <ShareBars
                      data={prices.slice(0, 20).map((row) => ({
                        name: productName(row.product),
                        value: row.median,
                        parts: [
                          { name: 'Cuartil bajo (Bs)', value: row.p25 },
                          { name: 'Cuartil alto (Bs)', value: row.p75 },
                          { name: 'Precios', value: row.n },
                        ],
                      }))}
                      unit="Bs"
                      height={Math.max(200, Math.min(prices.length, 20) * 28)}
                    />
                    {barsKey('Precio mediano del producto, en bolivianos')}
                  </>
                }
                table={
                  <table className="grid-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Rubro</th>
                        <th>Precios</th>
                        <th>Mediana (Bs)</th>
                        <th>Cuartil bajo</th>
                        <th>Cuartil alto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prices.map((row) => (
                        <tr key={row.product}>
                          <td>{productName(row.product)}</td>
                          <td>{labelOf('rubro', row.rubro)}</td>
                          <td>{count(row.n)}</td>
                          <td>{decimal(row.median, 2)}</td>
                          <td>{decimal(row.p25, 2)}</td>
                          <td>{decimal(row.p75, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              />
            ) : (
              <div className="callout">Ningún producto del recorte junta {MIN_PRICES} precios en el texto de los videos.</div>
            )}
          </Panel>

          <Panel
            id="videos-de-vendedores-horas"
            title="Cuándo publican: videos por día y hora (cantidad, hora de La Paz)"
            lede="La hora en que se subió cada video."
            source={SOURCE}
          >
            <HeatGrid
              rows={['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']}
              columns={Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')} h`)}
              cells={publishHeat(videos)}
              unit="videos"
            />
            <ChartLegend items={[{ color: 'var(--official)', label: 'Videos publicados en esa hora y día' }]} />
          </Panel>

          <Panel
            id="videos-de-vendedores-hashtags"
            title="Hashtags más usados (veces que aparecen)"
            lede="Los hashtags de los videos, según el rubro elegido en el filtro."
            source={SOURCE}
          >
            <TermCloud data={cloud.map((word) => ({ ...word, label: `#${readable(word.term)}` }))} limit={60} />
            <ChartLegend items={[{ color: 'var(--official)', label: 'El tamaño del hashtag es cuántas veces aparece' }]} />
          </Panel>
        </div>
      </div>
    </>
  );
}

/** La página de videos, pedida al abrirse: no viaja con el resto de «Empresas». */
export function TiktokVideosSection() {
  const { payload, failed } = useOnOpen<{ board: VideoBoard }>('/api/videos-vendedores');
  if (!payload) return <OnOpenNotice what="los videos de los vendedores" failed={failed} />;
  return <TiktokVideosExplorer board={payload.board} />;
}
