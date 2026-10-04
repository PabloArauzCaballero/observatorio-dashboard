'use client';

import { CityPlacesExplorer } from './city-places-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import { TabHeader } from '@/components/ui/tab-header';
import type { PlaceFamily } from '@/lib/places';

/**
 * El catálogo de lugares, pedido al abrir la pestaña de Ciudades.
 *
 * Los lugares ya se pedían aparte —`/api/lugares`, cuando el lector elige una
 * ciudad y una familia—; el catálogo que le permite elegir no, y eran 937 KB de
 * la portada. Ahora las dos mitades del corpus llegan igual, que es lo coherente:
 * este capítulo no tiene ninguna presencia en la primera pantalla.
 */
export function CitiesSection() {
  const { payload, failed } = useOnOpen<{ families: PlaceFamily[] }>('/api/familias');

  return (
    <>
      <TabHeader
        id="ciudades"
        title="Ciudades"
        lede="Qué hay en las ciudades de Bolivia y dónde está: comercios, servicios y otros sitios sobre el mapa, con la fuente y la confianza de cada registro."
      />
      {payload ? (
        <CityPlacesExplorer families={payload.families} />
      ) : (
        <OnOpenNotice what="el catálogo de lugares" failed={failed} />
      )}
    </>
  );
}
