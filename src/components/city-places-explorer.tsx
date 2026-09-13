'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons';
import { Pager } from './pager';
import { PlacesMap, mapsHref } from './places-map';
import type { Place, PlaceFamily } from '@/lib/places';

/*
 * El grupo de los que no estan en ninguna poblacion. Va al final de la lista:
 * no es una ciudad y no debe competir por el sitio con las que si lo son.
 */
const WITHOUT_LOCALITY = 'Sin localidad declarada';

/**
 * What is in the country's towns, and where.
 *
 * Every other chapter answers «how much, and when». This one answers «what is
 * there», which is a different question and needs a different control: not a
 * period and a series, but a city and a kind of place.
 *
 * The counts travel with the page and the places do not. A reader arrives
 * wanting to choose, and cannot choose without the list; the twenty-six
 * thousand places behind it are fetched for the city and family actually
 * picked. The same reason the world panel ships its catalogue and asks for the
 * numbers.
 */

/*
 * Las tres que el corpus municipal cartografio, y que encabezan la lista por
 * ser las unicas delimitadas por un poligono. El resto ya no se escribe aqui:
 * sale del propio dato, porque el informe dejo de leer tres ciudades y pasó a
 * leer el pais — y una constante de tres nombres dejaba Sucre, Tarija, Oruro,
 * Potosi, Trinidad y Cobija cargadas en la base y fuera de toda pantalla.
 */
const MAPPED_CITIES = ['Santa Cruz de la Sierra', 'La Paz', 'Cochabamba'];

const NUMBER = new Intl.NumberFormat('es-BO');
/** Enough to see the shape of a chapter's rail without scrolling past it. */
const SHOWN = 16;
/** Rows of the register on screen at once, as the rest of the report pages. */
const PAGE_SIZE = 25;

/** A family name as the catalogue writes it, in the case a sentence wants. */
function label(family: string): string {
  const words = family.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function CityPlacesExplorer({ families }: { families: PlaceFamily[] }) {
  /*
   * Las ciudades que hay, ordenadas por cuantos lugares guarda cada una, con
   * las tres cartografiadas delante. Sale del dato para que una entrega nueva
   * aparezca sin tocar este archivo.
   */
  const cities = useMemo(() => {
    const held = new Map<string, number>();
    for (const row of families) held.set(row.city, (held.get(row.city) ?? 0) + row.places);
    const rest = [...held.keys()]
      .filter((name) => !MAPPED_CITIES.includes(name) && name !== WITHOUT_LOCALITY)
      .sort((one, other) => (held.get(other) ?? 0) - (held.get(one) ?? 0));
    const residual = held.has(WITHOUT_LOCALITY) ? [WITHOUT_LOCALITY] : [];
    return [...MAPPED_CITIES.filter((name) => held.has(name)), ...rest, ...residual];
  }, [families]);

  const [city, setCity] = useState<string>(MAPPED_CITIES[0] as string);
  const [family, setFamily] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  /* Cuando el lector pide ver el recorte entero, y no los cuatro mil. */
  const [showAll, setShowAll] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  /**
   * The families this city actually holds, one row each, largest first.
   *
   * The read model files a row per group *and* family, and several groups own
   * the catalogue's catch-all: health, retail and the rest each have an «otra
   * entidad». Listed raw, the rail printed «Otra entidad» a dozen times over
   * with a dozen different counts, and clicking the one that said 413 drew the
   * 1.837 of every group at once — because the only thing the reader can
   * filter by, here and in the file, is the family. Summed, the number beside
   * a row is the number the map then draws.
   */
  const inCity = useMemo(() => {
    const held = new Map<string, PlaceFamily>();
    for (const row of families) {
      if (row.city !== city) continue;
      const already = held.get(row.entityFamily);
      if (!already) {
        held.set(row.entityFamily, { ...row });
        continue;
      }
      already.places += row.places;
      already.regulated += row.regulated;
      already.locatedInZone += row.locatedInZone;
      // The group stops being one group the moment two of them are added up.
      if (already.entityGroup !== row.entityGroup) already.entityGroup = 'VARIOS';
    }
    return [...held.values()].sort((left, right) => right.places - left.places);
  }, [families, city]);

  const matches = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('es');
    if (!needle) return inCity.slice(0, SHOWN);
    return inCity
      .filter((row) => row.entityFamily.toLocaleLowerCase('es').includes(needle))
      .slice(0, SHOWN);
  }, [inCity, search]);

  /**
   * How many places each city holds, so the chooser carries its own weight.
   *
   * A rail item without a number beside it is the only one on the page, and a
   * reader comparing three cities should not have to click each to find out
   * which is the large one.
   */
  const perCity = useMemo(() => {
    const held = new Map<string, number>();
    for (const row of families) held.set(row.city, (held.get(row.city) ?? 0) + row.places);
    return held;
  }, [families]);
  const placesIn = (name: string): number => perCity.get(name) ?? 0;

  const cityTotals = useMemo(() => {
    const places_ = inCity.reduce((sum, row) => sum + row.places, 0);
    const regulated = inCity.reduce((sum, row) => sum + row.regulated, 0);
    const inZone = inCity.reduce((sum, row) => sum + row.locatedInZone, 0);
    return { places: places_, regulated, inZone, families: inCity.length };
  }, [inCity]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const query = new URLSearchParams({ ciudad: city });
    if (family) query.set('familia', family);
    if (showAll) query.set('todos', '1');
    fetch(`/api/lugares?${query.toString()}`)
      .then((response) => (response.ok ? response.json() : { places: [], total: 0 }))
      .then((body: { places?: Place[]; total?: number }) => {
        if (!live) return;
        setPlaces(body.places ?? []);
        setTotal(body.total ?? 0);
      })
      .catch(() => {
        if (live) {
          setPlaces([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [city, family, showAll]);

  if (families.length === 0) {
    return <div className="callout">Todavía no hay lugares cargados.</div>;
  }

  const chosen = family ? inCity.find((row) => row.entityFamily === family) : undefined;

  /**
   * The file follows the selection, and carries the whole of it.
   *
   * The map stops at four thousand premises because past that it is a blot; the
   * file does not, so the note under it says which of the two the reader has.
   */
  const fileQuery = new URLSearchParams({ dataset: 'lugares', ciudad: city });
  if (family) fileQuery.set('familia', family);
  const slug = `lugares-${city
    .toLocaleLowerCase('es')
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')}${family ? `-${family.toLocaleLowerCase('es')}` : ''}`;
  // El lector tiene que poder distinguir «esto es la ciudad entera» de «esto es
  // lo que cabe en el mapa». Un mapa recortado sin decirlo es un mapa que miente.
  const truncated = total > places.length;

  return (
    <>
      <div className="card-grid">
        <Figure
          label="Lugares"
          value={NUMBER.format(cityTotals.places)}
          note={city === WITHOUT_LOCALITY ? 'sin poblacion publicada' : 'en el municipio'}
        />
        <Figure
          label="De actividad regulada"
          value={NUMBER.format(cityTotals.regulated)}
          note="por verificar con su regulador"
        />
        <Figure
          label="Familias"
          value={NUMBER.format(cityTotals.families)}
          note="de 201 del catálogo"
        />
        <Figure
          label="Con barrio resuelto"
          value={NUMBER.format(cityTotals.inZone)}
          note="el resto no tiene polígono publicado"
        />
      </div>

      <div className="workspace">
        <aside className="rail">
          {/*
            The city is a filter, so it lives where every other filter in this
            report lives: at the top of the rail, above the thing it narrows.
            It used to be a row of pills over the whole width, which read as a
            heading rather than as a control and left the reader looking for
            the chooser in the one place it was not.
          */}
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="mapa" size={13} />
              Ciudad
            </div>
            {/*
              Cuarenta municipios en una lista que no termina.

              El capitulo leia tres ciudades y ahora lee el pais, asi que esta
              lista sola mide varias pantallas: sin un tope propio empuja el
              buscador de familias fuera del encuadre y hay que recorrerla
              entera para llegar al control que se venia a usar. Con el tope se
              mueve por dentro y las dos secciones caben a la vez.
            */}
            <div className={cities.length > 9 ? 'rail-list rail-list-cut' : 'rail-list'}>
              {cities.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={city === name ? 'rail-item rail-item-on' : 'rail-item'}
                  onClick={() => {
                    setCity(name);
                    setFamily(null);
                    setShowAll(false);
                  }}
                >
                  <Icon name="mapa" size={16} />
                  <span className="rail-name">{name}</span>
                  <span className="rail-n">{NUMBER.format(placesIn(name))}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="buscar" size={13} />
              Familia
            </div>
            <div className="rail-field">
              <input
                type="search"
                aria-label="Buscar una familia de entidad"
                placeholder="farmacia, colegio, ferretería…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="rail-sec">
            {/*
              El pie —«tantas familias mas: buscalas por nombre»— queda fuera
              del area que se desplaza. Dentro de ella habria que llegar al
              final de la lista para enterarse de que la lista no es todo, que
              es justo al reves de para lo que esta escrito.
            */}
            <div className={matches.length > 8 ? 'rail-list rail-list-cut' : 'rail-list'}>
              <button
                type="button"
                className={family === null ? 'rail-item rail-item-on' : 'rail-item'}
                onClick={() => setFamily(null)}
              >
                <Icon name="cajas" size={16} />
                <span className="rail-name">Todas las familias</span>
                <span className="rail-n">{NUMBER.format(cityTotals.places)}</span>
              </button>
              {matches.map((row) => (
                <button
                  key={row.entityFamily}
                  type="button"
                  className={family === row.entityFamily ? 'rail-item rail-item-on' : 'rail-item'}
                  onClick={() => setFamily(family === row.entityFamily ? null : row.entityFamily)}
                >
                  <Icon name={row.regulated > 0 ? 'escudo' : 'tienda'} size={16} />
                  <span className="rail-name">{label(row.entityFamily)}</span>
                  <span className="rail-n">{NUMBER.format(row.places)}</span>
                </button>
              ))}
            </div>
            {inCity.length > matches.length ? (
              <div className="rail-foot">
                {NUMBER.format(inCity.length - matches.length)} familias más: búscalas por nombre.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="workspace-main stack">
          {loading ? (
            // El mismo anillo que la portada mientras arma el tablero: un
            // aviso de texto solo no distingue «esperando» de «no hay nada».
            <div className="loading-note" role="status" aria-live="polite">
              <span className="loading-spin" aria-hidden="true" />
              <div>
                <b>Leyendo los lugares…</b>
                <span>Se dibujan en el mapa en cuanto lleguen.</span>
              </div>
            </div>
          ) : (
            <PlacesMap
              places={places}
              csvHref={`/api/export?${fileQuery.toString()}&format=csv`}
              jsonHref={`/api/export?${fileQuery.toString()}&format=json`}
              fileName={slug}
            />
          )}
          {/*
            Lo que hay debajo del mapa, en una caja y no en tres.

            Eran dos parrafos sueltos con el mismo borde azul de una nota
            destacada, uno de ellos en monoespaciada diminuta, cada uno en su
            propio recuadro: tres cajas apiladas del mismo peso visual diciendo
            tres cosas de importancia muy distinta. Y `.card-note` esta escrita
            para envolver parrafos —el tamano de letra vive en `.card-note p`—
            asi que puesta sobre el parrafo mismo no se aplicaba y la frase
            salia con el cuerpo de un titulo.
          */}
          <div className="card-note">
            <p>
              {chosen ? (
                <>
                  <b>{label(chosen.entityFamily)}</b> en {city}: {NUMBER.format(chosen.places)}{' '}
                  lugares, {NUMBER.format(chosen.regulated)} de actividad regulada.
                </>
              ) : (
                <>
                  <b>Todas las familias</b> de {city}: {NUMBER.format(cityTotals.places)} lugares,{' '}
                  {NUMBER.format(cityTotals.regulated)} de actividad regulada.
                </>
              )}{' '}
              {truncated ? (
                <>
                  El mapa dibuja {NUMBER.format(places.length)} de {NUMBER.format(total)}, los de
                  mayor confianza: dibujarlos todos deja una mancha, no un mapa. Elegí una familia
                  para verla completa, descargá el CSV, que trae los {NUMBER.format(total)}, o{' '}
                  <button type="button" className="callout-link" onClick={() => setShowAll(true)}>
                    dibujá los {NUMBER.format(total)} de una vez
                  </button>
                  .
                </>
              ) : (
                <>Se dibujan los {NUMBER.format(places.length)}, y la tabla los lista enteros.</>
              )}
            </p>
            <p className="card-note-source">
              Overture Maps Foundation, entrega 2026-08-19.0, filtrada a confianza ≥ 0,60 y acotada
              a los polígonos municipales que la propia fuente publica. La marca de actividad
              regulada señala qué debe verificarse con su regulador boliviano; no es una
              verificación.
            </p>
          </div>

          {/*
            El registro, fila a fila, debajo del dibujo.

            Un mapa dice donde y no dice que: cuatro mil puntos del mismo color
            no se leen uno por uno, y la ficha del puntero ensena uno cada vez.
            La tabla es la misma seleccion en la otra forma —la que se copia y
            se compara— y es la unica de las dos donde el enlace al lugar se
            puede pulsar, porque la ficha flotante no recibe puntero.

            Se remonta con la seleccion, para que un lector que estaba en la
            pagina once de las farmacias no aterrice en la pagina once de los
            restaurantes.
          */}
          <PlacesTable
            key={`${city}:${family ?? ''}:${showAll ? 'todos' : 'recorte'}`}
            places={places}
            total={total}
          />
        </div>
      </div>
    </>
  );
}

/**
 * The whole of every record the map is drawing, one row each.
 *
 * The columns are the fields the corpus actually holds, and the last of them is
 * the coordinate turned into the only thing a reader can do with it: a pin on
 * Google Maps. Nothing is stored for it — the link IS the latitude and the
 * longitude, written as an address.
 *
 * It scrolls sideways inside its own box, as every other table in the report
 * does, so a phone never drags the page off its right edge.
 */
function PlacesTable({ places, total }: { places: Place[]; total: number }) {
  const [offset, setOffset] = useState(0);

  const pages = Math.max(1, Math.ceil(places.length / PAGE_SIZE));
  const page = Math.min(pages, Math.floor(offset / PAGE_SIZE) + 1);
  const shown = places.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const first = places.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = (page - 1) * PAGE_SIZE + shown.length;

  if (places.length === 0) return null;

  return (
    <section className="places-table">
      <div className="tile-head">
        <Icon name="cajas" size={14} />
        <h3 className="tile-title">Detalle de los lugares</h3>
        <span className="places-table-count">
          {NUMBER.format(places.length)}
          {total > places.length ? <> de {NUMBER.format(total)}</> : null} registros
        </span>
      </div>

      <Pager
        page={page}
        pages={pages}
        first={first}
        last={last}
        total={places.length}
        onGo={setOffset}
        pageSize={PAGE_SIZE}
        where="arriba"
        noun="lugares"
      />

      <div className="table-wrap">
        <table className="grid-table grid-table-places">
          <thead>
            <tr>
              <th>Lugar</th>
              <th>Familia</th>
              <th>Marca</th>
              <th>Dirección</th>
              <th>Zona</th>
              <th>Ciudad</th>
              <th className="num">Confianza</th>
              <th>Actividad regulada</th>
              <th>Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((place) => (
              <tr key={place.placeId}>
                <td>
                  <span className="cell-name">{place.name}</span>
                  <code className="cell-code">{place.placeId}</code>
                </td>
                <td>
                  <span className="cell-name">{label(place.entityFamily)}</span>
                  {place.entityGroup !== place.entityFamily ? (
                    <span className="cell-code">{label(place.entityGroup)}</span>
                  ) : null}
                </td>
                <td>{place.brand ?? '—'}</td>
                <td>{place.address ?? '—'}</td>
                <td>{place.zone ?? '—'}</td>
                <td>{place.city}</td>
                <td className="num">
                  {place.confidence === null ? '—' : `${(place.confidence * 100).toFixed(0)}%`}
                  {place.qualityGrade ? (
                    <span className="cell-code">{place.qualityGrade}</span>
                  ) : null}
                </td>
                <td>
                  {place.isRegulated ? (
                    <>
                      <span className="places-map-flag">sí</span>
                      {place.officialValidationSource ? (
                        <span className="cell-code">{place.officialValidationSource}</span>
                      ) : null}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {/*
                    La coordenada, y no la coordenada escrita. «-17,78362,
                    -63,18201» es el unico campo del registro que nadie puede
                    usar sin copiarlo a mano en otro sitio; el mismo par de
                    numeros como enlace es el lugar, con su calle y su manera de
                    llegar. Queda en el `title` para quien queria los numeros.
                  */}
                  <a
                    className="places-map-link"
                    href={mapsHref(place)}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={`${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}
                  >
                    Google Maps
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager
        page={page}
        pages={pages}
        first={first}
        last={last}
        total={places.length}
        onGo={setOffset}
        pageSize={PAGE_SIZE}
        where="abajo"
        noun="lugares"
      />
    </section>
  );
}

/** One count, stated with what it counts. */
function Figure({ label: name, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-sector">{name}</span>
      </div>
      <div className="card-figure">
        <span className="card-value">{value}</span>
      </div>
      <div className="card-meta">{note}</div>
    </div>
  );
}
