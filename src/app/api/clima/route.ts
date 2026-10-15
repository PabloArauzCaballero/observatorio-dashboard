import aire from '@/data/clima-aire.json';
import capitales from '@/data/clima-capitales.json';
import departamentos from '@/data/clima-departamentos.json';
import fuegoBosque from '@/data/clima-fuego-bosque.json';
import oni from '@/data/clima-oni.json';
import type { ClimateBundle } from '@/lib/climate-board';

/**
 * «Clima y ambiente»: los cinco archivos que arma `scripts/clima/collect-climate.mjs`.
 *
 * Son estáticos —se regeneran a mano con el recolector y se publican con el
 * código—, así que la respuesta es la misma para todos y puede guardarse una
 * hora. Viajan por esta ruta y no importados en el componente para no cargar
 * casi un megabyte de series en el paquete de quien nunca abre la página.
 */
export const dynamic = 'force-static';

const bundle = {
  capitales,
  departamentos,
  aire,
  fuegoBosque,
  oni,
} as unknown as ClimateBundle;

export function GET(): Response {
  return Response.json(bundle, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
