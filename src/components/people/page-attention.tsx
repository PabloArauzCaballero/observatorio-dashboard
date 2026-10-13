'use client';

import { useMemo } from 'react';
import { ChartLegend, ShareBars, type ShareSlice } from '@/components/charts';
import { Panel } from '@/components/ui/panel';
import { toggle } from '@/lib/choice';
import type { SectorKey } from '@/lib/people-types';
import { FilterBar } from './filter-bar';
import { usePeople } from './people-context';
import {
  COMPONENT_LABEL,
  applyFilters,
  contributions,
  dec,
  isFiltered,
  num,
  sectorLabel,
  sectorStats,
  sinDatoMotivo,
} from './people-model';
import { IndexHistogram, PeopleScatter } from './people-charts';
import { COMPONENT_TONE } from './page-perceived';
import { Empty } from './people-ui';
import { RankList, type RankItem } from './rank-list';
import s from './people.module.css';

const SOURCE =
  'Observatorio Económico de Bolivia con Wikipedia, cuentas verificadas y Merco Líderes 2025/26';

/**
 * «Atención medible»: el explorador. Los filtros recortan todos los paneles de la página y la
 * lista de «Fichas»; el lector decide qué población compara.
 */
export function AttentionPage() {
  const {
    summary,
    rows,
    byIndex,
    filters,
    setFilters,
    clearFilters,
    selectedSlug,
    bySlug,
    openProfile,
    updated,
  } = usePeople();
  const weights = summary.method.weights;
  const selected = selectedSlug ? bySlug.get(selectedSlug) : undefined;
  const filtered = isFiltered(filters);

  const top = byIndex.filter((row) => row.measured).slice(0, 10);
  const items: RankItem[] = top.map((row, index) => ({
    slug: row.slug,
    name: row.name,
    sub: `${sectorLabel(row.sector)} · ${row.sectorRank}.º del sector`,
    place: index + 1,
    shown: dec(row.score),
    raw: row.score,
    segments: contributions(row, weights).map((part) => ({
      key: part.key,
      width: part.points,
      color: COMPONENT_TONE[part.key],
      label: `${COMPONENT_LABEL[part.key]}: ${dec(part.points)} puntos`,
    })),
  }));

  // Los sectores se cuentan sin el filtro de sector, para poder saltar de uno a otro desde la barra.
  const stats = useMemo(
    () => sectorStats(applyFilters(rows, { ...filters, sectors: [] })),
    [rows, filters],
  );
  const sectorBars: ShareSlice[] = stats.map((stat) => ({
    name: `${stat.label}${stat.median === null ? ' · sin datos' : ` · mediana ${dec(stat.median, 0)}`}`,
    value: stat.n,
    pick: stat.key,
    emphasis: filters.sectors.includes(stat.key),
    parts: [
      { name: 'Personas', value: stat.n },
      { name: 'Con atención medible', value: stat.measured },
    ],
  }));

  const sectorsPresent = new Set(byIndex.map((row) => row.sector));
  const mixes =
    sectorsPresent.size > 1 && (sectorsPresent.has('BUSINESS') || sectorsPresent.has('SCIENCE'));
  const unmeasured = byIndex.filter((row) => !row.measured);

  const missing = {
    views: byIndex.filter((row) => row.measured && row.components.wikipediaViews12m === null)
      .length,
    social: byIndex.filter((row) => row.measured && row.components.verifiedFollowers === null)
      .length,
  };

  return (
    <>
      <FilterBar />
      {mixes ? (
        <p className={s.warn}>
          Las empresas puntúan solo por Merco y Ciencia no tiene datos medibles: el orden entre
          sectores no compara lo mismo. Elige un sector arriba para comparar dentro de él.
        </p>
      ) : null}

      <div className="grid-pair">
        <div className={s.col}>
          <Panel
            id="personalidades-top10"
            title="Las diez primeras según el filtro (índice de 0 a 100)"
            lede="Cada tramo de la barra es una fuente: así se ve por qué una persona está arriba."
            meta={filtered ? `${num(byIndex.length)} personas con el filtro` : undefined}
            source={SOURCE}
            updated={updated}
          >
            {items.length ? (
              <>
                <RankList
                  items={items}
                  onPick={openProfile}
                  selectedSlug={selectedSlug}
                  label="Las diez personas con mayor índice entre las que pasan el filtro"
                  unit="índice de 0 a 100"
                  valueHeader="Índice de atención (0–100)"
                  tall
                />
                <ChartLegend
                  items={(['views', 'social', 'merco'] as const).map((key) => ({
                    color: COMPONENT_TONE[key],
                    label: `${COMPONENT_LABEL[key]} (${Math.round(weights[key] * 100)} % del índice)`,
                  }))}
                />
              </>
            ) : (
              <Empty
                title={
                  byIndex.length
                    ? 'Nadie con este filtro tiene datos medibles'
                    : 'Nadie coincide con estos filtros'
                }
                action={
                  <button type="button" className="chip" onClick={clearFilters}>
                    Quitar filtros
                  </button>
                }
              >
                {byIndex.length
                  ? `Las ${num(byIndex.length)} fichas que quedan no tienen artículo en Wikipedia, cuenta verificada ni puesto en Merco.`
                  : 'Prueba con menos filtros o con otro sector.'}
              </Empty>
            )}
          </Panel>

          <Panel
            id="personalidades-distribucion"
            title="Cómo se reparte el índice (cantidad de personas por tramo de 10 puntos)"
            lede="Pocas personas concentran casi toda la atención; la mayoría está en los tramos bajos."
            source={SOURCE}
            updated={updated}
          >
            <IndexHistogram rows={byIndex} selected={selected} />
            <ChartLegend
              items={[
                { color: 'var(--series-1)', label: 'Personas por tramo del índice' },
                ...(selected?.measured
                  ? [
                      {
                        color: 'var(--series-rest)',
                        label: 'Otros tramos, con la persona elegida resaltada',
                      },
                    ]
                  : []),
              ]}
            />
          </Panel>
        </div>
        <div className={s.col}>
          <Panel
            id="personalidades-sectores"
            title="Personas y mediana del índice por sector (cantidad de personas)"
            lede="Toca una barra para filtrar por ese sector; Ctrl o ⌘ suma otro."
            source={SOURCE}
            updated={updated}
          >
            <ShareBars
              data={sectorBars}
              unit="personas"
              decimals={0}
              height={Math.max(220, sectorBars.length * 38)}
              onPick={(value, additive) =>
                setFilters({
                  sectors: [...toggle(new Set(filters.sectors), value, additive)] as SectorKey[],
                })
              }
            />
            <ChartLegend
              items={[
                {
                  color: 'var(--official)',
                  label: 'Personas del sector con los demás filtros puestos',
                },
              ]}
            />
          </Panel>

          <Panel
            id="personalidades-dispersion"
            title="Visitas a Wikipedia frente a audiencia verificada (visitas en 12 meses y seguidores)"
            lede="Quien está arriba a la derecha concentra las dos atenciones. Los puntos pálidos son el resto; el azul, la persona elegida."
            source="Wikipedia (es y en) y cuentas con identidad respaldada"
            updated={updated}
          >
            <PeopleScatter rows={byIndex} selectedSlug={selectedSlug} onPick={openProfile} />
            <ChartLegend
              items={[
                { color: 'var(--series-rest)', label: 'Una persona con las dos cifras' },
                { color: 'var(--series-1)', label: 'Persona elegida' },
              ]}
            />
            <p className={s.footnote}>
              No aparecen en la nube {num(missing.views)} personas sin artículo en Wikipedia y{' '}
              {num(missing.social)} sin cuenta verificada: ausente no es cero.
            </p>
          </Panel>
        </div>
      </div>

      {unmeasured.length > 0 ? (
        <details className={s.details}>
          <summary>Sin datos medibles ({num(unmeasured.length)})</summary>
          <p>
            Están en el padrón pero ninguna de las tres fuentes del índice las registra, así que no
            tienen puesto.
          </p>
          <ul className={s.sources}>
            {unmeasured.map((row) => (
              <li key={row.slug}>
                <a
                  href={`?persona=${row.slug}`}
                  title={sinDatoMotivo(row)}
                  onClick={(event) => {
                    event.preventDefault();
                    openProfile(row.slug);
                  }}
                >
                  {row.name} · {sectorLabel(row.sector)}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
