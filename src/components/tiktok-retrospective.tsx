'use client';

import { useMemo, useState } from 'react';
import { ChartLegend, HeatGrid, ShareBars, YearStackBars } from './charts';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import { Panel } from '@/components/ui/panel';
import { ViewToggle } from '@/components/ui/view-toggle';
import { additive, picked, toggle, type Choice } from '@/lib/choice';
import { productName, readable } from '@/lib/live-words';
import {
  NO_RETRO_FILTERS,
  filterMonths,
  heatCells,
  monthOptions,
  newTagsByMonth,
  priceByYear,
  productChoices,
  rubroOptions,
  sampleSplit,
  yearsInRange,
  type RetroFilters,
} from '@/lib/tiktok-retrospective';
import { TACTIC_LABEL, type VideoBoard } from '@/lib/tiktok-videos-board';

/**
 * «Empresas › Videos de vendedores › Retrospectiva»: qué videos comerciales fueron trend mes a mes, por rubro
 * (ADR 0031 del núcleo). El umbral de trend es el 5 % superior de vistas DENTRO de su mes y su rubro: las vistas
 * se inflan con la antigüedad y un umbral global solo premiaría a 2021. Un mes con pocos videos se cuenta y no
 * se pinta. Los años viejos son un piso: la cobertura por año dice cuánto se alcanzó a leer.
 */

const SOURCE =
  'Perfiles públicos de TikTok de vendedores bolivianos, leídos por el Observatorio sin iniciar sesión (cifras al día de la lectura); dólar paralelo del Observatorio';
const TABLE_ROWS = 300;

const count = (value: number): string => value.toLocaleString('es-BO');
const decimal = (value: number | null, digits = 1): string =>
  value === null ? '—' : value.toLocaleString('es-BO', { maximumFractionDigits: digits });
const monthLabel = (month: string): string => {
  const [year, number] = month.split('-');
  const names = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${names[Number(number) - 1] ?? number}-${year}`;
};

export function TiktokRetrospective({ board }: { board: VideoBoard }) {
  const trends = board.trends;
  const [filters, setFilters] = useState<RetroFilters>(NO_RETRO_FILTERS);
  const [productPick, setProductPick] = useState('');

  const labelOf = (rubro: string): string => board.rubros[rubro] ?? (rubro === 'SIN_IDENTIFICAR' ? 'Sin rubro identificado' : rubro);

  const months = useMemo(() => (trends ? filterMonths(trends, filters) : []), [trends, filters]);
  const options = useMemo(() => (trends ? rubroOptions(trends, filters) : []), [trends, filters]);
  const monthList = useMemo(() => (trends ? monthOptions(trends, filters) : []), [trends, filters]);
  const heat = useMemo(() => heatCells(months, labelOf), [months, board.rubros]); // eslint-disable-line react-hooks/exhaustive-deps
  const tagMonths = useMemo(() => newTagsByMonth(months), [months]);
  const choices = useMemo(() => (trends ? productChoices(trends.products, filters) : []), [trends, filters]);
  const activeProduct = choices.some((row) => row.product === productPick) ? productPick : (choices[0]?.product ?? '');
  const priceRows = useMemo(
    () => (trends && activeProduct ? priceByYear(trends.products, activeProduct, filters, board.dollar) : []),
    [trends, activeProduct, filters, board.dollar],
  );

  const coverage = board.coverage;
  const perYear = coverage?.por_anio ?? null;

  if (!trends || !trends.months.length) {
    return (
      <Panel id="videos-retro-vacio" title="Retrospectiva de videos comerciales (videos por mes y rubro)" source={SOURCE}>
        <div className="callout">
          Todavía no hay una retrospectiva publicada: el núcleo la agrega a la lectura de videos con la migración 0106 y el siguiente análisis.
        </div>
      </Panel>
    );
  }

  const split = sampleSplit(months, trends.minN);
  const videos = months.reduce((sum, row) => sum + row.n, 0);
  const trendVideos = months.reduce((sum, row) => sum + (row.trendN ?? 0), 0);
  const coverageYears = perYear ? yearsInRange(filters, Object.keys(perYear).sort()) : [];
  const active = (filters.rubro.size ? 1 : 0) + (filters.from ? 1 : 0) + (filters.to ? 1 : 0);
  const setRubro = (value: string, add: boolean): void =>
    setFilters((current) => ({ ...current, rubro: toggle(current.rubro as Choice, value, add) }));
  const tableMonths = [...months]
    .sort((a, b) => b.month.localeCompare(a.month) || b.n - a.n)
    .slice(0, TABLE_ROWS);

  return (
    <>
      <Panel
        id="videos-retro-resumen"
        title="Videos comerciales leídos por mes y rubro (cantidad de videos)"
        lede={`Qué fue trend en cada rubro, mes a mes. Un video es trend si está en el ${decimal(100 * trends.trendShare, 0)} % superior de vistas de su propio mes y su propio rubro, no de todos los años mezclados.`}
        source={SOURCE}
        {...(board.analyzedAt ? { updated: board.analyzedAt.slice(0, 10) } : {})}
      >
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Videos en el recorte</span>
            <span className="stat-value">{count(videos)}</span>
            <span className="stat-hint">de cuentas de venta y gastronomía</span>
          </div>
          <div className="stat">
            <span className="stat-label">Meses con estadística</span>
            <span className="stat-value">{count(split.withStat)}</span>
            <span className="stat-hint">rubro y mes con {trends.minN} videos o más</span>
          </div>
          <div className="stat">
            <span className="stat-label">Meses solo con cantidad</span>
            <span className="stat-value">{count(split.countOnly)}</span>
            <span className="stat-hint">{count(split.videosCountOnly)} videos, menos de {trends.minN} por mes: no se calcula percentil</span>
          </div>
          <div className="stat">
            <span className="stat-label">Videos trend</span>
            <span className="stat-value">{count(trendVideos)}</span>
            <span className="stat-hint">en el 5 % superior de su mes y rubro</span>
          </div>
        </div>
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            Sin iniciar sesión, TikTok muestra de cada perfil solo sus videos más recientes, y la lectura histórica llega hasta donde el
            servicio deja paginar. Los años viejos son por eso un piso: tienen menos videos porque se alcanzan menos, no porque se vendiera
            menos, y las cuentas borradas no aparecen. Las vistas son las del día de la lectura. Un rubro y mes con menos de {trends.minN} videos
            se publica con su cantidad y sin mediana, percentil ni razón. De cada video se guardan solo marcas, nunca su texto ni su autor.
          </p>
        </details>
      </Panel>

      <div className="workspace">
        <aside className="rail" id="videos-retro-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">{active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}</span>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} /> Rango de meses
            </div>
            <div className="rail-field">
              <select aria-label="Desde el mes" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}>
                <option value="">Desde el primero</option>
                {monthList.map((month) => (
                  <option key={month} value={month}>
                    Desde {monthLabel(month)}
                  </option>
                ))}
              </select>
              <select aria-label="Hasta el mes" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}>
                <option value="">Hasta el último</option>
                {monthList.map((month) => (
                  <option key={month} value={month}>
                    Hasta {monthLabel(month)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="capas" size={13} /> Rubro <PickedCount choice={filters.rubro} />
            </div>
            <FilterHint />
            <div className="rail-list rail-list-cut">
              {options.map((option) => {
                const on = picked(filters.rubro, option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={on ? 'rail-item rail-item-on' : 'rail-item'}
                    aria-pressed={on}
                    disabled={!on && option.count === 0}
                    onClick={(event) => setRubro(option.value, additive(event))}
                  >
                    <span className="rail-name">{labelOf(option.value)}</span>
                    <span className="rail-n">{option.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {active ? (
            <div className="rail-sec">
              <button type="button" className="chip" onClick={() => setFilters(NO_RETRO_FILTERS)}>
                Limpiar todo
              </button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main">
          <Panel
            id="videos-retro-cobertura"
            title="Cobertura de la lectura por año (cuentas con el año leído)"
            lede="Cuántas cuentas tienen el año entero leído, a medias o fuera de alcance. Es el piso de cada año: lo que se ve es lo que se alcanzó a leer."
            source={SOURCE}
          >
            {perYear && coverageYears.length ? (
              <>
                <ViewToggle
                  chart={
                    <YearStackBars
                      data={coverageYears.map((year) => ({
                        year,
                        completo: perYear[year]?.accountsFull ?? 0,
                        parcial: perYear[year]?.accountsPartial ?? 0,
                        fuera: perYear[year]?.accountsNone ?? 0,
                      }))}
                      parts={[
                        { key: 'completo', label: 'Año entero leído (cuentas)' },
                        { key: 'parcial', label: 'Año leído a medias (cuentas)' },
                        { key: 'fuera', label: 'Fuera de alcance (cuentas)' },
                      ]}
                      mode="count"
                      unit="cuentas"
                      height={240}
                    />
                  }
                  table={
                    <table className="grid-table">
                      <thead>
                        <tr>
                          <th>Año</th>
                          <th>Videos leídos</th>
                          <th>Cuentas con videos</th>
                          <th>Año entero</th>
                          <th>A medias</th>
                          <th>Fuera de alcance</th>
                          <th>Por qué</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverageYears.map((year) => (
                          <tr key={year}>
                            <td>{year}</td>
                            <td>{count(perYear[year]?.videos ?? 0)}</td>
                            <td>{count(perYear[year]?.accountsWithVideos ?? 0)}</td>
                            <td>{count(perYear[year]?.accountsFull ?? 0)}</td>
                            <td>{count(perYear[year]?.accountsPartial ?? 0)}</td>
                            <td>{count(perYear[year]?.accountsNone ?? 0)}</td>
                            <td>{perYear[year]?.why}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                />
                <ul className="social-coverage" aria-label="Videos leídos por año">
                  {coverageYears.map((year) => (
                    <li key={year}>
                      <b>{year}</b> {count(perYear[year]?.videos ?? 0)} videos · {perYear[year]?.cause === 'COMPLETO' ? 'cobertura completa' : 'piso, no total'}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="callout">La cobertura por año todavía no está publicada.</div>
            )}
          </Panel>

          <Panel
            id="videos-retro-calor"
            title="Vistas del percentil 95 por rubro y mes (vistas por video)"
            lede="El percentil 95 es el umbral de trend: arriba de él está el 5 % más visto de ese rubro en ese mes. Más oscuro, más vistas. Las celdas vacías son meses con menos videos que el mínimo."
            source={SOURCE}
          >
            {heat.cells.length ? (
              <ViewToggle
                chart={
                  <>
                    <HeatGrid rows={heat.rows} columns={heat.columns} cells={heat.cells} unit="vistas" />
                    <ChartLegend items={[{ color: 'var(--official)', label: 'Vistas del percentil 95 del rubro en ese mes' }]} />
                  </>
                }
                table={
                  <>
                    <table className="grid-table">
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th>Rubro</th>
                          <th>Videos</th>
                          <th>Cuentas</th>
                          <th>Mediana (vistas)</th>
                          <th>Percentil 95 (vistas)</th>
                          <th>Trend</th>
                          <th>Compartidos por vista</th>
                          <th>Precio mediano (Bs)</th>
                          <th>Dólar paralelo del mes (Bs)</th>
                          <th>Marcas de venta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableMonths.map((row) => (
                          <tr key={`${row.month}|${row.rubro}`}>
                            <td>{monthLabel(row.month)}</td>
                            <td>{labelOf(row.rubro)}</td>
                            <td>{count(row.n)}</td>
                            <td>{count(row.accounts)}</td>
                            <td>{row.median === null ? 'sin estadística' : count(row.median)}</td>
                            <td>{row.p95 === null ? 'sin estadística' : count(row.p95)}</td>
                            <td>{row.trendN === null ? '—' : count(row.trendN)}</td>
                            <td>{row.shareRatio === null ? '—' : decimal(100 * row.shareRatio, 2) + ' %'}</td>
                            <td>{decimal(row.priceMedian, 2)}</td>
                            <td>{decimal(board.dollar[row.month] ?? null, 2)}</td>
                            <td>{row.tactics.map((tactic) => `${TACTIC_LABEL[tactic.tactic] ?? tactic.tactic} (${decimal(tactic.share, 0)} %)`).join(' · ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {months.length > TABLE_ROWS ? <p className="panel-note">Se muestran los {TABLE_ROWS} meses-rubro más recientes de {count(months.length)}; el filtro recorta el resto.</p> : null}
                  </>
                }
              />
            ) : (
              <div className="callout">Ningún rubro del recorte tiene {trends.minN} videos o más en un mismo mes: solo hay cantidades, sin percentil.</div>
            )}
          </Panel>

          <Panel
            id="videos-retro-hashtags"
            title="Hashtags nuevos por mes (cantidad de hashtags que aparecen por primera vez)"
            lede="Un hashtag es nuevo el mes en que aparece en un rubro y no había aparecido antes, en al menos dos cuentas. El primer mes leído de cada rubro no cuenta: no tiene «antes»."
            source={SOURCE}
          >
            {tagMonths.length ? (
              <ViewToggle
                chart={
                  <>
                    <ShareBars
                      data={tagMonths.slice(-24).map((row) => ({
                        name: monthLabel(row.month),
                        value: row.count,
                        parts: row.tags.slice(0, 6).map((tag) => ({ name: `#${readable(tag.tag)} (${labelOf(tag.rubro)})`, value: tag.n })),
                      }))}
                      unit="hashtags"
                      decimals={0}
                      height={Math.max(220, Math.min(tagMonths.length, 24) * 26)}
                    />
                    <ChartLegend items={[{ color: 'var(--official)', label: 'Hashtags que aparecen por primera vez ese mes (con los más usados al pasar el cursor)' }]} />
                  </>
                }
                table={
                  <table className="grid-table">
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th>Rubro</th>
                        <th>Hashtag nuevo</th>
                        <th>Videos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...tagMonths].reverse().flatMap((row) =>
                        row.tags.map((tag) => (
                          <tr key={`${row.month}|${tag.rubro}|${tag.tag}`}>
                            <td>{monthLabel(row.month)}</td>
                            <td>{labelOf(tag.rubro)}</td>
                            <td>#{readable(tag.tag)}</td>
                            <td>{count(tag.n)}</td>
                          </tr>
                        )),
                      ).slice(0, TABLE_ROWS)}
                    </tbody>
                  </table>
                }
              />
            ) : (
              <div className="callout">Ningún hashtag del recorte aparece por primera vez en dos cuentas distintas en un mismo mes.</div>
            )}
          </Panel>

          <Panel
            id="videos-retro-precios"
            title="Precio mediano dicho en los videos, por año (Bs por producto)"
            lede="Los precios escritos en el texto de los videos, con moneda explícita, y el dólar paralelo promedio del año al lado para separar lo que subió el producto de lo que subió el dólar."
            source={SOURCE}
          >
            {choices.length ? (
              <>
                <div className="rail-field">
                  <select aria-label="Producto" value={activeProduct} onChange={(event) => setProductPick(event.target.value)}>
                    {choices.map((choice) => (
                      <option key={choice.product} value={choice.product}>
                        {productName(choice.product)} ({choice.prices} precios)
                      </option>
                    ))}
                  </select>
                </div>
                <ViewToggle
                  chart={
                    <>
                      <ShareBars
                        data={priceRows
                          .filter((row) => row.median !== null)
                          .map((row) => ({
                            name: row.year,
                            value: row.median ?? 0,
                            parts: [
                              ...(row.p25 !== null ? [{ name: 'Cuartil bajo (Bs)', value: row.p25 }] : []),
                              ...(row.p75 !== null ? [{ name: 'Cuartil alto (Bs)', value: row.p75 }] : []),
                              { name: 'Precios', value: row.prices },
                              ...(row.dollar !== null ? [{ name: 'Dólar paralelo promedio del año (Bs)', value: row.dollar }] : []),
                            ],
                          }))}
                        unit="Bs"
                        height={Math.max(180, priceRows.length * 34)}
                      />
                      <ChartLegend items={[{ color: 'var(--official)', label: `Precio mediano de ${productName(activeProduct)}, en bolivianos` }]} />
                    </>
                  }
                  table={
                    <table className="grid-table">
                      <thead>
                        <tr>
                          <th>Año</th>
                          <th>Videos</th>
                          <th>Precios</th>
                          <th>Cuartil bajo (Bs)</th>
                          <th>Mediana (Bs)</th>
                          <th>Cuartil alto (Bs)</th>
                          <th>Dólar paralelo promedio (Bs)</th>
                          <th>Mediana en dólares (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceRows.map((row) => (
                          <tr key={row.year}>
                            <td>{row.year}</td>
                            <td>{count(row.videos)}</td>
                            <td>{count(row.prices)}</td>
                            <td>{decimal(row.p25, 2)}</td>
                            <td>{decimal(row.median, 2)}</td>
                            <td>{decimal(row.p75, 2)}</td>
                            <td>{decimal(row.dollar, 2)}</td>
                            <td>{decimal(row.medianUsd, 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                />
                <p className="panel-note">Un año sin mediana tiene menos de 3 precios dichos para ese producto: se cuenta y no se resume.</p>
              </>
            ) : (
              <div className="callout">Ningún producto del recorte junta precios dichos en los videos.</div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
