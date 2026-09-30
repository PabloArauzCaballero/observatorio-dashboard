'use client';

import { useMemo, useState } from 'react';
import { count, percent, plural } from '@/components/admin/format';
import { DataTable } from '@/components/admin/data-table';
import { EmptyState } from '@/components/admin/states';
import { StatStrip } from '@/components/admin/stat';
import { BarList } from '@/components/admin/viz/share-bar';
import { TimeSeries } from '@/components/admin/viz/time-series';
import {
  DEVICE_LABEL,
  NO_FILTERS,
  REFERRER_LABEL,
  byBucket,
  group,
  matches,
  sum,
  type Filters,
  type TrafficBucket,
} from '@/lib/admin/traffic-model';

function Chips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (next: string) => void;
}) {
  return (
    <div className="pg-filter">
      <span>{label}</span>
      <div className="pg-seg" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value || 'todos'}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * El tráfico, con filtros que se cruzan.
 *
 * Elegir «Móvil» recorta las dos series, las cifras y las dos listas a la vez, y
 * elegir una ruta recorta además las opciones que siguen teniendo sentido. Un
 * panel con varias dimensiones que solo mostrara las series que decidió el
 * desarrollador obligaría a pedir en otra pantalla lo que aquí se responde con
 * un clic.
 */
export function TrafficExplorer({
  buckets,
  granularity,
  truncated,
}: {
  buckets: readonly TrafficBucket[];
  granularity: 'day' | 'hour';
  truncated: boolean;
}) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const set = (patch: Partial<Filters>): void =>
    setFilters((current) => ({ ...current, ...patch }));

  const view = useMemo(() => {
    const all = buckets.filter((bucket) => matches(bucket, filters));
    // Las opciones de cada control se calculan con los OTROS filtros puestos:
    // así no se ofrece una ruta que, con el dispositivo elegido, no tiene filas.
    const routeOptions = group(
      buckets.filter((bucket) => matches(bucket, { ...filters, route: '' })),
      'PAGE_VIEW',
      (bucket) => bucket.route,
    ).slice(0, 12);
    const withoutDevice = buckets.filter((bucket) => matches(bucket, { ...filters, device: '' }));
    const devices = group(withoutDevice, 'PAGE_VIEW', (bucket) => bucket.device);
    const mobile = devices.find((entry) => entry.key === 'MOBILE')?.views ?? 0;
    const totalViews = devices.reduce((total, entry) => total + entry.views, 0);
    return {
      all,
      views: sum(all, 'PAGE_VIEW'),
      intents: sum(all, 'DOWNLOAD_INTENT'),
      viewsByBucket: byBucket(all, 'PAGE_VIEW'),
      intentsByBucket: byBucket(all, 'DOWNLOAD_INTENT'),
      byDevice: group(all, 'PAGE_VIEW', (bucket) => bucket.device),
      byReferrer: group(all, 'PAGE_VIEW', (bucket) => bucket.referrer),
      byRoute: group(all, 'PAGE_VIEW', (bucket) => bucket.route),
      routeOptions,
      mobileShare: totalViews > 0 ? percent(mobile, totalViews) : null,
    };
  }, [buckets, filters]);

  const active = filters.device !== '' || filters.referrer !== '' || filters.route !== '';
  const windowLabel = granularity === 'day' ? 'en la ventana elegida' : 'en las horas mostradas';

  return (
    <>
      <StatStrip
        label="Cifras del tráfico filtrado"
        stats={[
          { label: 'Vistas de página', value: count(view.views), detail: windowLabel },
          {
            label: 'Intenciones de descarga',
            value: count(view.intents),
            detail: 'clics que piden un archivo, no archivos entregados',
          },
          {
            label: 'Desde móvil',
            value: view.mobileShare,
            detail: 'de las vistas, con los demás filtros puestos',
          },
          {
            label: 'Ruta más vista',
            value: view.byRoute[0]?.key ?? null,
            detail: view.byRoute[0] ? `${count(view.byRoute[0].views)} vistas` : undefined,
          },
        ]}
      />

      <section className="admin-panel" aria-label="Series de tráfico">
        <div className="pg-filters">
          <Chips
            label="Dispositivo"
            value={filters.device}
            onChange={(device) => set({ device })}
            options={[
              { value: '', label: 'Todos' },
              { value: 'DESKTOP', label: 'Escritorio' },
              { value: 'MOBILE', label: 'Móvil' },
              { value: 'TABLET', label: 'Tableta' },
            ]}
          />
          <Chips
            label="Origen"
            value={filters.referrer}
            onChange={(referrer) => set({ referrer })}
            options={[
              { value: '', label: 'Todos' },
              { value: 'DIRECT', label: 'Directo' },
              { value: 'SEARCH', label: 'Buscador' },
              { value: 'SOCIAL', label: 'Redes' },
              { value: 'EXTERNAL', label: 'Otro sitio' },
            ]}
          />
          <div className="admin-field pg-route">
            <label htmlFor="route-filter">Ruta</label>
            <select
              id="route-filter"
              value={filters.route}
              onChange={(event) => set({ route: event.target.value })}
            >
              <option value="">Todas</option>
              {view.routeOptions.map((route) => (
                <option key={route.key} value={route.key}>
                  {route.key}
                </option>
              ))}
            </select>
          </div>
          {active ? (
            <button
              type="button"
              className="admin-button admin-button-ghost"
              onClick={() => setFilters(NO_FILTERS)}
            >
              Quitar filtros
            </button>
          ) : null}
        </div>

        {view.all.length === 0 ? (
          <EmptyState
            title="Ningún evento con esos filtros"
            detail="La combinación elegida no tiene vistas en la ventana. Quita un filtro para ampliarla."
          />
        ) : (
          <div className="admin-pair">
            <TimeSeries
              title="Vistas de página"
              description={
                granularity === 'day' ? 'Por día, hora de La Paz' : 'Por hora, hora de La Paz'
              }
              kind="line"
              unit="vistas"
              granularity={granularity}
              series={[
                {
                  key: 'views',
                  label: 'Vistas',
                  color: 'var(--series-1)',
                  points: view.viewsByBucket,
                },
              ]}
            />
            <TimeSeries
              title="Intenciones de descarga"
              description="Clics que piden un archivo; el archivo lo cuenta Descargas"
              kind="line"
              unit="intenciones"
              granularity={granularity}
              series={[
                {
                  key: 'intents',
                  label: 'Intenciones',
                  color: 'var(--series-2)',
                  points: view.intentsByBucket,
                },
              ]}
            />
          </div>
        )}
      </section>

      {view.all.length > 0 ? (
        <div className="admin-pair admin-pair-wide">
          <section className="admin-panel">
            <header>
              <div>
                <h2>Vistas por ruta</h2>
                <p>
                  Rutas normalizadas: un identificador en la ruta se sustituye antes de guardarse.
                </p>
              </div>
            </header>
            {view.byRoute.length === 0 ? (
              <EmptyState
                title="Sin vistas"
                detail="Con estos filtros solo hay intenciones de descarga."
              />
            ) : (
              <DataTable
                caption={`${plural(view.byRoute.length, 'ruta', 'rutas')}; sesiones estimadas según la definición del núcleo`}
                rows={view.byRoute}
                rowKey={(row) => row.key}
                columns={[
                  { header: 'Ruta', cell: (row) => row.key, mono: true },
                  { header: 'Vistas', cell: (row) => count(row.views), align: 'num' },
                  {
                    header: 'Sesiones estimadas',
                    cell: (row) => count(row.sessions),
                    align: 'num',
                  },
                ]}
              />
            )}
          </section>
          <section className="admin-panel">
            <header>
              <div>
                <h2>Quién mira</h2>
                <p>Vistas de página, con los filtros puestos.</p>
              </div>
            </header>
            <div className="admin-panel-body" style={{ display: 'grid', gap: 'var(--s3)' }}>
              <div>
                <p className="pg-chart-title">Dispositivo</p>
                <BarList
                  unit="vistas"
                  rows={view.byDevice.map((entry) => ({
                    label: DEVICE_LABEL[entry.key] ?? entry.key,
                    value: entry.views,
                  }))}
                />
              </div>
              <div>
                <p className="pg-chart-title">Origen</p>
                <BarList
                  unit="vistas"
                  color="var(--series-3)"
                  rows={view.byReferrer.map((entry) => ({
                    label: REFERRER_LABEL[entry.key] ?? entry.key,
                    value: entry.views,
                  }))}
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {truncated ? (
        <p className="pg-chart-sub" role="status">
          El núcleo devuelve como máximo 2.000 combinaciones de balde: si la ventana es larga, lo
          más antiguo puede faltar. Acorta la ventana para ver todo.
        </p>
      ) : null}
    </>
  );
}
