'use client';

import { useMemo } from 'react';
import { DEPARTMENTS, MAP_BOX, projectRoadPoint } from '@/lib/bolivia-map';
import type { RoadSection } from '@/lib/roads';
import { SURFACE_ORDER } from '@/lib/roads-board';

/**
 * La red vial, dibujada sobre el contorno departamental.
 *
 * El contorno es el mismo SVG estático que usa «Ciudades»: nueve `<path>` en
 * el espacio de `MAP_BOX`. La red se proyecta a ese mismo espacio con
 * `projectRoadPoint`, que replica la proyección equirectangular con que se
 * generó el contorno — mismo origen, misma escala — para que un tramo no
 * aparezca corrido respecto al departamento que lo contiene.
 *
 * Sin mosaico de calles debajo, a diferencia del mapa de lugares: ahí la
 * ciudad sin calles no se leía; aquí la propia red es la calle, y un país
 * entero en mosaicos sería miles de peticiones a un servidor ajeno por cada
 * apertura de pestaña.
 */

const SURFACE_COLOR: Record<RoadSection['surface'], string> = {
  PAVIMENTO: 'var(--series-1)',
  EMPEDRADO: 'var(--series-5)',
  RIPIO: 'var(--series-4)',
  TIERRA: 'var(--series-2)',
  SIN_PAVIMENTAR: 'var(--series-6)',
  SIN_DATO: 'var(--series-rest)',
};

const SURFACE_LABEL: Record<RoadSection['surface'], string> = {
  PAVIMENTO: 'Pavimento',
  EMPEDRADO: 'Empedrado',
  RIPIO: 'Ripio',
  TIERRA: 'Tierra',
  SIN_PAVIMENTAR: 'Sin pavimentar (sin detalle)',
  SIN_DATO: 'Sin dato',
};

function pathOf(geometry: readonly (readonly [number, number])[][]): string {
  return geometry
    .map((line) => {
      const points = line.map((point) => projectRoadPoint(point));
      return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`;
    })
    .join(' ');
}

export function RoadsMap({
  sections,
  department,
  route,
}: {
  sections: readonly RoadSection[];
  department: string | null;
  route: string | null;
}) {
  const paths = useMemo(
    () =>
      sections.map((section) => ({
        section,
        d: pathOf(section.geometry),
        matches: (!department || section.department === department) && (!route || section.route === route),
      })),
    [sections, department, route],
  );
  const filtering = Boolean(department || route);

  return (
    <div className="roads-map-wrap">
      <svg
        viewBox={`0 0 ${MAP_BOX.width} ${MAP_BOX.height}`}
        role="img"
        aria-label="Red vial principal de Bolivia por tipo de superficie"
        className="roads-map"
      >
        <g className="roads-map-departments">
          {DEPARTMENTS.map((one) => (
            <path key={one.code} d={one.path} />
          ))}
        </g>
        <g>
          {/* Los tramos que coinciden con el filtro van al final, para quedar encima. */}
          {[...paths].sort((left, right) => Number(left.matches) - Number(right.matches)).map(({ section, d, matches }) => (
            <path
              key={section.sectionId}
              d={d}
              stroke={SURFACE_COLOR[section.surface]}
              strokeWidth={section.network === 'FUNDAMENTAL' ? 2.4 : 1.4}
              strokeDasharray={section.status === 'EN_CONSTRUCCION' ? '5 3' : undefined}
              opacity={filtering && !matches ? 0.12 : 0.92}
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </g>
      </svg>
      <div className="roads-map-legend">
        {SURFACE_ORDER.map((surface) => (
          <span key={surface} className="roads-map-legend-item">
            <i style={{ background: SURFACE_COLOR[surface] }} />
            {SURFACE_LABEL[surface]}
          </span>
        ))}
        <span className="roads-map-legend-item">
          <i className="roads-map-legend-dash" />
          En construcción
        </span>
      </div>
    </div>
  );
}
