'use client';

import { useMemo, useState } from 'react';
import { DEPARTMENTS, MAP_BOX, PLACE_POINTS } from '@/lib/bolivia-map';
import { Icon } from './icons';
import {
  FORM_LABEL,
  GOODS_LABEL,
  REGIME_LABEL,
  TERRITORY_LABEL,
  tradeFigure,
} from './trade-vocabulary';
import type { ChannelMix, RegionCount, TradeGap, TradeReading } from '@/lib/series';

/**
 * Every place the register names, on the country it names them in.
 *
 * The rest of the report files a reading under a code — `SANTA_CRUZ`, `EL_ALTO`
 * — and a reader who does not already carry Bolivia in their head cannot tell
 * from a table that two of those codes are neighbours and one is nine hundred
 * kilometres away. This section is that one fact, and only that one: where.
 *
 * It draws marks and not a shaded country on purpose. A choropleth fills all
 * nine departments whatever it was told, so a department nobody surveyed comes
 * out the pale end of a scale and reads as «little», when the truth is «not
 * measured». A mark exists or it does not, and the empty land is the finding:
 * the register is a handful of readings concentrated in the cities somebody
 * bothered to survey, plus a press archive that follows the conflict.
 *
 * The mark's size counts records and nothing else — press notes and readings
 * are added together because the question the size answers is «how much of
 * this archive is about here», not «how large is the economy here».
 */

/** The registers a place can appear in, in the order the panel reports them. */
type Register = 'prensa' | 'lecturas' | 'canales' | 'brechas';

interface Place {
  code: string;
  label: string;
  /** Absent for `NACIONAL`, `URBANO` and `RURAL`, which name no point. */
  x: number | null;
  y: number | null;
  kind: 'departamento' | 'municipio' | 'sin punto';
  articles: number;
  readings: TradeReading[];
  mix: ChannelMix[];
  gaps: TradeGap[];
  records: number;
}

const POINT = new Map(PLACE_POINTS.map((point) => [point.code, point]));

/** What a scope code means when it is not a place: read it, do not map it. */
const SCOPE_NOTE: Record<string, string> = {
  NACIONAL: 'La cifra es del país entero, no de un lugar dentro de él.',
  URBANO: 'El conjunto de ciudades que la encuesta cubre, sin separarlas.',
  RURAL: 'Lo que queda fuera de esas ciudades, también sin separarlo.',
};

function label(code: string): string {
  return TERRITORY_LABEL[code] ?? POINT.get(code)?.name ?? code;
}

/** The smallest and largest a mark gets, in map units. Small, as marks go. */
const MIN_RADIUS = 4;
const MAX_RADIUS = 13;

/**
 * Area, not radius, carries the count.
 *
 * A mark twice as wide is four times the ink, so scaling the radius by the
 * count would make the busiest place look four times busier than it is. The
 * square root puts the count in the area, which is what an eye reads.
 */
function radiusFor(records: number, busiest: number): number {
  if (busiest <= 0) return MIN_RADIUS;
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(records / busiest);
}

function count(value: number): string {
  return value.toLocaleString('es-BO');
}

/** «3 lecturas», «1 lectura» — a count that reads as a sentence. */
function tally(value: number, one: string, many: string): string {
  return `${count(value)} ${value === 1 ? one : many}`;
}

export function PlacesExplorer({
  regions,
  readings,
  mix,
  gaps,
}: {
  regions: RegionCount[];
  readings: TradeReading[];
  mix: ChannelMix[];
  gaps: TradeGap[];
}) {
  const places = useMemo<Place[]>(() => {
    const held = new Map<string, Place>();

    const of = (code: string): Place => {
      const existing = held.get(code);
      if (existing) return existing;
      const point = POINT.get(code);
      const place: Place = {
        code,
        label: label(code),
        x: point?.x ?? null,
        y: point?.y ?? null,
        kind: point?.kind ?? 'sin punto',
        articles: 0,
        readings: [],
        mix: [],
        gaps: [],
        records: 0,
      };
      held.set(code, place);
      return place;
    };

    for (const region of regions) of(region.region).articles += region.articles;
    for (const reading of readings) of(reading.territory).readings.push(reading);
    for (const row of mix) of(row.territory).mix.push(row);
    for (const gap of gaps) of(gap.territory).gaps.push(gap);

    for (const place of held.values()) {
      place.records = place.articles + place.readings.length + place.mix.length + place.gaps.length;
    }

    return [...held.values()].sort((left, right) => right.records - left.records);
  }, [regions, readings, mix, gaps]);

  const mapped = useMemo(() => places.filter((place) => place.x !== null), [places]);
  const unmapped = useMemo(() => places.filter((place) => place.x === null), [places]);
  const busiest = mapped.reduce((most, place) => Math.max(most, place.records), 0);

  // The first selection is the busiest place, so the detail panel below the map
  // is never an empty box waiting to be told what to say.
  const [selected, setSelected] = useState<string>(() => places[0]?.code ?? '');
  const [hovered, setHovered] = useState<string | null>(null);

  const shown = places.find((place) => place.code === (hovered ?? selected)) ?? places[0];
  const detail = places.find((place) => place.code === selected) ?? places[0];

  if (!places.length) {
    return (
      <div className="callout">
        Todavía no hay registros con lugar declarado, así que no hay nada que poner en el mapa.
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Dónde ocurre lo que este informe registra</h2>
        </div>
        <p className="panel-sub">
          {tally(mapped.length, 'lugar aparece', 'lugares aparecen')} en el registro, sobre{' '}
          {count(places.reduce((total, place) => total + place.records, 0))} anotaciones entre
          prensa, lecturas de comercio, canales y brechas. Cada punto es un lugar que alguien
          nombró; su tamaño cuenta cuántas anotaciones lo nombran. El territorio en blanco no está
          en cero: nadie lo midió.
        </p>
      </div>

      <div className="panel">
        <div className="tile-head">
          <Icon name="mapa" size={17} />
          <h2>El registro sobre el mapa</h2>
          <span className="tile-hint">pasa el cursor por un punto</span>
        </div>

        <div className="map-layout">
          <div
            className="map-frame"
            style={{ aspectRatio: `${MAP_BOX.width} / ${MAP_BOX.height}` }}
            onMouseLeave={() => setHovered(null)}
          >
            <svg
              viewBox={`0 0 ${MAP_BOX.width} ${MAP_BOX.height}`}
              className="map-svg"
              role="img"
              aria-label="Mapa de Bolivia con un punto por cada lugar que el registro nombra"
            >
              <g className="map-land">
                {DEPARTMENTS.map((department) => (
                  <path key={department.code} d={department.path} />
                ))}
              </g>
              <g>
                {mapped.map((place) => {
                  const active = (hovered ?? selected) === place.code;
                  return (
                    <g
                      key={place.code}
                      className={active ? 'map-mark map-mark-on' : 'map-mark'}
                      tabIndex={0}
                      role="button"
                      aria-label={`${place.label}: ${tally(place.records, 'anotación', 'anotaciones')}`}
                      onMouseEnter={() => setHovered(place.code)}
                      onFocus={() => setHovered(place.code)}
                      onBlur={() => setHovered(null)}
                      onClick={() => setSelected(place.code)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelected(place.code);
                        }
                      }}
                    >
                      {/* A four-pixel dot is hard to hit; this is the target. */}
                      <circle className="map-hit" cx={place.x ?? 0} cy={place.y ?? 0} r={20} />
                      <circle
                        className="map-dot"
                        cx={place.x ?? 0}
                        cy={place.y ?? 0}
                        r={radiusFor(place.records, busiest)}
                      />
                    </g>
                  );
                })}
              </g>
            </svg>

            {shown && shown.x !== null && shown.y !== null ? (
              <div
                className="map-tip"
                style={{
                  left: `${((shown.x ?? 0) / MAP_BOX.width) * 100}%`,
                  top: `${((shown.y ?? 0) / MAP_BOX.height) * 100}%`,
                  // Near the right edge the card would fall off the frame, so it
                  // swaps to the other side of its own mark instead.
                  transform:
                    (shown.x ?? 0) > MAP_BOX.width * 0.58
                      ? 'translate(calc(-100% - 14px), -50%)'
                      : 'translate(14px, -50%)',
                }}
              >
                <PlaceCard place={shown} />
              </div>
            ) : null}
          </div>

          <div className="map-side">
            <h3 className="map-side-head">Por número de anotaciones</h3>
            <ul className="map-list">
              {mapped.map((place) => (
                <li key={place.code}>
                  <button
                    type="button"
                    className={place.code === selected ? 'map-row map-row-on' : 'map-row'}
                    onMouseEnter={() => setHovered(place.code)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected(place.code)}
                  >
                    <span className="map-row-name">{place.label}</span>
                    <span className="map-row-kind">{place.kind}</span>
                    <span className="map-row-count">{count(place.records)}</span>
                  </button>
                </li>
              ))}
            </ul>

            {unmapped.length ? (
              <>
                <h3 className="map-side-head">Sin lugar en el mapa</h3>
                <ul className="map-list">
                  {unmapped.map((place) => (
                    <li key={place.code}>
                      <button
                        type="button"
                        className={place.code === selected ? 'map-row map-row-on' : 'map-row'}
                        onClick={() => setSelected(place.code)}
                      >
                        <span className="map-row-name">{place.label}</span>
                        <span className="map-row-kind">alcance</span>
                        <span className="map-row-count">{count(place.records)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="map-note">
                  Un alcance no es un lugar. Una cifra nacional no se puede poner en un punto sin
                  fingir que se midió allí, así que se queda fuera del mapa y se lee aparte.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {detail ? <PlaceDetail place={detail} /> : null}
    </>
  );
}

/** The hover card: everything the register holds for a place, in brief. */
function PlaceCard({ place }: { place: Place }) {
  const lines: Array<[Register, string]> = [];
  if (place.articles) lines.push(['prensa', tally(place.articles, 'nota', 'notas')]);
  if (place.readings.length)
    lines.push(['lecturas', tally(place.readings.length, 'lectura', 'lecturas')]);
  if (place.mix.length) lines.push(['canales', tally(place.mix.length, 'mezcla', 'mezclas')]);
  if (place.gaps.length) lines.push(['brechas', tally(place.gaps.length, 'brecha', 'brechas')]);

  return (
    <div className="tooltip map-card">
      <div className="t-date">
        {place.kind === 'sin punto' ? 'alcance' : place.kind} · {place.code}
      </div>
      <strong className="map-card-name">{place.label}</strong>
      {lines.map(([register, text]) => (
        <div className="t-row" key={register}>
          <span>{register}</span>
          <span>{text}</span>
        </div>
      ))}
      {place.readings.length ? (
        <ul className="map-card-list">
          {place.readings.slice(0, 6).map((reading) => (
            <li key={`${reading.metric}-${reading.referencePeriod}`}>
              <span>{reading.label}</span>
              <em>{tradeFigure(reading.value, reading.unit)}</em>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="t-note">
        {SCOPE_NOTE[place.code] ?? 'Clic para abrir todo lo que el registro dice de aquí.'}
      </div>
    </div>
  );
}

/** The pinned place, with nothing left out. */
function PlaceDetail({ place }: { place: Place }) {
  return (
    <div className="panel">
      <div className="tile-head">
        <Icon name="capas" size={17} />
        <h2>{place.label}</h2>
        <span className="tile-hint">
          {place.kind === 'sin punto' ? 'alcance declarado' : place.kind} ·{' '}
          {tally(place.records, 'anotación', 'anotaciones')}
        </span>
      </div>

      <div className="stat-strip">
        <div className="stat">
          <span className="stat-label">Notas de prensa</span>
          <span className="stat-value">{count(place.articles)}</span>
          <span className="stat-hint">artículos que nombran el lugar</span>
        </div>
        <div className="stat">
          <span className="stat-label">Lecturas de comercio</span>
          <span className="stat-value">{count(place.readings.length)}</span>
          <span className="stat-hint">cifras medidas aquí</span>
        </div>
        <div className="stat">
          <span className="stat-label">Mezclas de canal</span>
          <span className="stat-value">{count(place.mix.length)}</span>
          <span className="stat-hint">por clase de bien y periodo</span>
        </div>
        <div className="stat">
          <span className="stat-label">Brechas</span>
          <span className="stat-value">{count(place.gaps.length)}</span>
          <span className="stat-hint">lo declarado contra lo medido</span>
        </div>
      </div>

      {place.readings.length ? (
        <div className="table-wrap" style={{ marginTop: 'var(--s3)' }}>
          <table className="grid-table">
            <thead>
              <tr>
                <th>Lectura</th>
                <th>Cifra</th>
                <th>Periodo</th>
                <th>Forma</th>
                <th>Régimen</th>
                <th>Bien</th>
                <th>Compilador</th>
                <th>Evidencia</th>
              </tr>
            </thead>
            <tbody>
              {place.readings.map((reading) => (
                <tr key={`${reading.metric}-${reading.referencePeriod}-${reading.platform}`}>
                  <td>
                    {reading.url ? (
                      <a href={reading.url} target="_blank" rel="noreferrer noopener">
                        {reading.label}
                      </a>
                    ) : (
                      reading.label
                    )}
                  </td>
                  <td>{tradeFigure(reading.value, reading.unit)}</td>
                  <td>{reading.referencePeriod}</td>
                  <td>{FORM_LABEL[reading.businessForm] ?? reading.businessForm}</td>
                  <td>{REGIME_LABEL[reading.marketRegime] ?? reading.marketRegime}</td>
                  <td>{GOODS_LABEL[reading.goodsClass] ?? reading.goodsClass}</td>
                  <td>{reading.publisher}</td>
                  <td>{reading.evidenceGrade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {place.gaps.length ? (
        <div className="table-wrap" style={{ marginTop: 'var(--s3)' }}>
          <table className="grid-table">
            <thead>
              <tr>
                <th>Brecha</th>
                <th>Declarado</th>
                <th>Medido</th>
                <th>Distancia</th>
                <th>Periodo</th>
                <th>Quién lo declaró</th>
              </tr>
            </thead>
            <tbody>
              {place.gaps.map((gap) => (
                <tr key={`${gap.indicatorCode}-${gap.referencePeriod}-${gap.socialPublisher}`}>
                  <td>{gap.label}</td>
                  <td>{gap.socialValue.toLocaleString('es-BO', { maximumFractionDigits: 1 })}</td>
                  <td>
                    {gap.measuredValue === null
                      ? 'sin medición'
                      : gap.measuredValue.toLocaleString('es-BO', { maximumFractionDigits: 1 })}
                  </td>
                  <td>
                    {gap.distancePoints === null
                      ? '—'
                      : `${gap.distancePoints.toLocaleString('es-BO', { maximumFractionDigits: 1 })} pp`}
                  </td>
                  <td>{gap.referencePeriod}</td>
                  <td>{gap.socialPublisher}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {place.mix.length ? (
        <div className="table-wrap" style={{ marginTop: 'var(--s3)' }}>
          <table className="grid-table">
            <thead>
              <tr>
                <th>Bien</th>
                <th>Periodo</th>
                <th>Lecturas</th>
                <th>Formas leídas</th>
                <th>Canales por hogar</th>
                <th>Penetración informal</th>
              </tr>
            </thead>
            <tbody>
              {place.mix.map((row) => (
                <tr key={`${row.goodsClass}-${row.referencePeriod}`}>
                  <td>{GOODS_LABEL[row.goodsClass] ?? row.goodsClass}</td>
                  <td>{row.referencePeriod}</td>
                  <td>{count(row.readings)}</td>
                  <td>{count(row.formsRead)}</td>
                  <td>
                    {row.channelsPerHousehold === null
                      ? '—'
                      : row.channelsPerHousehold.toLocaleString('es-BO', {
                          maximumFractionDigits: 2,
                        })}
                  </td>
                  <td>
                    {row.informalPenetration === null
                      ? '—'
                      : `${row.informalPenetration.toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="panel-sub" style={{ marginTop: 'var(--s2)' }}>
        {SCOPE_NOTE[place.code] ??
          'Las notas de prensa se cuentan por el departamento que la nota nombra; un artículo que no nombra ninguno se cuenta como nacional y no aparece aquí.'}
      </p>
    </div>
  );
}
