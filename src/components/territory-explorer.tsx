'use client';

import { useMemo } from 'react';
import { HeatGrid, ShareBars } from './charts';
import type { HeatCell, ShareSlice } from './charts';
import { Icon } from './icons';
import { FORM_LABEL, TERRITORY_LABEL, tradeFigure } from './trade-vocabulary';
import type { TradeReading } from '@/lib/series';

/**
 * The same trade, measured in different places.
 *
 * Informal commerce in El Alto is not informal commerce in Santa Cruz: the
 * census puts own-account work above 56% in Oruro and Potosí and at 43.9% in
 * Santa Cruz, and a national average hides both. This section exists so a
 * reader can see which figure was measured where — and, in the grid, where
 * nobody has measured anything at all.
 *
 * The grid is a matrix and not a map. A choropleth of Bolivia would suggest the
 * register covers every department, when what it holds is a handful of readings
 * concentrated in the cities somebody surveys.
 */

/**
 * The fair's own name, which the panel heading already carries.
 *
 * Every one of its readings is labelled «... de la feria 16 de Julio de El
 * Alto», and repeating that inside four stat labels under a heading that says
 * it once pushes the actual quantity off the tile. Only the name is removed:
 * what qualifies the figure — «en cuatro horas», «cada semana» — stays.
 */
const FAIR_NAME = /\s*(?:de\s+|en\s+)?la\s+feria\s+16\s+de\s+julio\s+de\s+el\s+alto/iu;

/** Territories in the order a Bolivian reader expects, country first. */
const ORDER = [
  'NACIONAL',
  'URBANO',
  'EL_ALTO',
  'LA_PAZ',
  'COCHABAMBA',
  'SANTA_CRUZ',
  'ORURO',
  'POTOSI',
  'TARIJA',
  'CHUQUISACA',
  'RURAL',
];

export function TerritoryExplorer({ readings }: { readings: TradeReading[] }) {
  const places = useMemo(() => {
    const held = new Set(readings.map((reading) => reading.territory));
    return ORDER.filter((place) => held.has(place));
  }, [readings]);

  const forms = useMemo(() => {
    const counts = new Map<string, number>();
    for (const reading of readings) {
      if (reading.businessForm === 'NINGUNA') continue;
      counts.set(reading.businessForm, (counts.get(reading.businessForm) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([form]) => form);
  }, [readings]);

  const cells: HeatCell[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const reading of readings) {
      if (reading.businessForm === 'NINGUNA') continue;
      const key = `${reading.businessForm}|${reading.territory}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([key, value]) => {
      const [form = '', place = ''] = key.split('|');
      return {
        row: FORM_LABEL[form] ?? form,
        column: TERRITORY_LABEL[place] ?? place,
        value,
      };
    });
  }, [readings]);

  /** Own-account work, national figure first so the departments read against it. */
  const ownAccount: ShareSlice[] = useMemo(() => {
    const rows = readings.filter((reading) =>
      reading.metric.startsWith('OWN_ACCOUNT_WORKERS_SHARE'),
    );
    const national = rows.find((reading) => reading.territory === 'NACIONAL')?.value ?? 0;
    return rows.map((reading) => ({
      name:
        reading.territory === 'NACIONAL'
          ? 'País'
          : (TERRITORY_LABEL[reading.territory] ?? reading.territory),
      value: reading.value,
      ...(reading.territory !== 'NACIONAL' && reading.value > national ? { emphasis: true } : {}),
    }));
  }, [readings]);

  const fair = useMemo(
    () => readings.filter((reading) => reading.metric.startsWith('FAIR_')),
    [readings],
  );

  const local = readings.filter((reading) => reading.territory !== 'NACIONAL').length;

  if (!readings.length) {
    return (
      <div className="callout">
        Todavía no hay lecturas de comercio cargadas, así que no hay nada que abrir por territorio.
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>El mismo comercio en lugares distintos</h2>
        </div>
        <p className="panel-sub">
          Cada lectura declara dónde se midió. {local} de {readings.length} lecturas de comercio
          describen algo más estrecho que el país: una ciudad, un departamento, el conjunto de las
          ciudades encuestadas. El resto son cifras nacionales, y decirlo importa: una feria de El
          Alto y un panel de hogares del país no se promedian.
        </p>
      </div>

      <div className="panel">
        <div className="tile-head">
          <Icon name="capas" size={17} />
          <h2>Qué se midió, dónde</h2>
          <span className="tile-hint">lecturas por forma y lugar</span>
        </div>
        <HeatGrid
          rows={forms.map((form) => FORM_LABEL[form] ?? form)}
          columns={places.map((place) => TERRITORY_LABEL[place] ?? place)}
          cells={cells}
        />
        <p className="panel-sub" style={{ marginTop: 'var(--s2)' }}>
          Cuanto más oscura la celda, más lecturas sostienen esa combinación. Las celdas vacías se
          dejan vacías a propósito: no son ceros medidos, son preguntas que nadie publicó. La
          concentración en la columna del país es el verdadero estado de la cobertura territorial
          del comercio informal boliviano.
        </p>
      </div>

      {ownAccount.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="personas" size={17} />
            <h2>Quién trabaja por cuenta propia</h2>
            <span className="tile-hint">Censo 2024</span>
          </div>
          <ShareBars data={ownAccount} height={170} />
          <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
            En rojo, los departamentos por encima del promedio nacional. Trabajar por cuenta propia
            no es lo mismo que ser informal, pero es la categoría donde vive el comercio minorista
            que sostiene ferias y mercados: donde más pesa, más de la mitad de los ocupados vende
            algo por su cuenta.
          </p>
        </div>
      ) : null}

      {fair.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="tienda" size={17} />
            <h2>La feria 16 de Julio, El Alto</h2>
            <span className="tile-hint">
              {fair[0]?.referencePeriod} · {fair[0]?.publisher}
            </span>
          </div>
          <div className="stat-strip">
            {fair.map((reading) => (
              <div className="stat" key={reading.metric}>
                <span className="stat-label">{reading.label.replace(FAIR_NAME, '')}</span>
                <span className="stat-value">{tradeFigure(reading.value, reading.unit)}</span>
                <span className="stat-hint">{reading.referencePeriod}</span>
              </div>
            ))}
          </div>
          <p className="panel-sub" style={{ marginTop: 'var(--s2)' }}>
            El mercado informal más grande del país es también el peor medido: estas cifras son una
            estimación de la Cámara de Industria de El Alto y entran con grado de evidencia bajo. Se
            registran igual, con su año a la vista, porque la alternativa es no poder decir nada de
            la forma de comercio donde más bolivianos compran.
          </p>
        </div>
      ) : null}
    </>
  );
}
