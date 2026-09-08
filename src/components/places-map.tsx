'use client';

import { useMemo, useState } from 'react';
import type { Place } from '@/lib/places';

/**
 * The places of one city, drawn where they are.
 *
 * There is no basemap under them, and that is a decision rather than an
 * omission. Tiles would mean calling a third party on every pan, handing that
 * third party the reader's address and this page a dependency it cannot serve
 * from its own container. Several thousand shops, clinics and schools already
 * draw the shape of a city on their own — the avenues appear as lines of dots
 * because that is where the premises are.
 *
 * The frame is the extent of what is being shown, recomputed per selection: a
 * fixed frame around the whole municipality would put twenty pharmacies in one
 * corner of an empty rectangle.
 */

const BOX = { width: 1000, height: 720 } as const;
const PAD = 26;

export function PlacesMap({ places }: { places: Place[] }) {
  /**
   * Which place the pointer is over, held here rather than lifted to the
   * chapter above. Nothing outside this figure reacts to a hover, and a
   * callback crossing the boundary would make every move of the mouse
   * re-render the rail of families beside it.
   */
  const [hovered, setHovered] = useState<string | null>(null);

  /**
   * Longitude is compressed by the cosine of the latitude before anything is
   * scaled. Without it a city seventeen degrees south comes out stretched
   * sideways by about a twentieth, which is enough to bend a straight avenue.
   */
  const projected = useMemo(() => {
    if (places.length === 0) return [];
    const middle = places.reduce((sum, place) => sum + place.latitude, 0) / places.length;
    const squeeze = Math.cos((middle * Math.PI) / 180);
    const points = places.map((place) => ({
      place,
      east: place.longitude * squeeze,
      north: place.latitude,
    }));

    const easts = points.map((point) => point.east);
    const norths = points.map((point) => point.north);
    const west = Math.min(...easts);
    const span = Math.max(Math.max(...easts) - west, 1e-6);
    const south = Math.min(...norths);
    const rise = Math.max(Math.max(...norths) - south, 1e-6);
    // One scale for both axes, so the city keeps its proportions instead of
    // being stretched to fill the frame.
    const scale = Math.min((BOX.width - PAD * 2) / span, (BOX.height - PAD * 2) / rise);
    const offsetX = (BOX.width - span * scale) / 2;
    const offsetY = (BOX.height - rise * scale) / 2;

    return points.map(({ place, east, north }) => ({
      place,
      x: offsetX + (east - west) * scale,
      // North is up on the page and down in SVG coordinates.
      y: BOX.height - offsetY - (north - south) * scale,
    }));
  }, [places]);

  if (projected.length === 0) {
    return <div className="callout">No hay lugares que dibujar con esta selección.</div>;
  }

  const found = projected.find((point) => point.place.placeId === hovered);

  return (
    <figure className="places-map">
      <svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        role="img"
        aria-label={`Mapa de ${projected.length.toLocaleString('es-BO')} lugares`}
        onMouseLeave={() => setHovered(null)}
      >
        {projected.map(({ place, x, y }) => (
          <circle
            key={place.placeId}
            cx={x}
            cy={y}
            r={place.placeId === hovered ? 6 : 3}
            className={place.isRegulated ? 'poi poi-regulated' : 'poi'}
            onMouseEnter={() => setHovered(place.placeId)}
          >
            <title>{`${place.name} — ${place.entityFamily}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="places-map-foot">
        {found ? (
          <>
            <b>{found.place.name}</b> · {found.place.entityFamily}
            {found.place.zone ? ` · ${found.place.zone}` : ''}
            {found.place.isRegulated ? ' · actividad regulada' : ''}
          </>
        ) : (
          <>
            Cada punto es un lugar en su posición real. Los marcados son de actividad regulada:
            deben verificarse con su regulador, no están verificados.
          </>
        )}
      </figcaption>
    </figure>
  );
}
