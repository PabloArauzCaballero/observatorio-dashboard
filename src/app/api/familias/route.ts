import { readPlaceFamilies } from '@/lib/places';
import { isUnaffordableRead } from '@/lib/series';

/**
 * El catálogo de familias de lugares, pedido al abrir «Ciudades».
 *
 * Los lugares ya se pedían aparte —`/api/lugares`, cuando el lector elige una
 * ciudad y una familia— pero el catálogo que le permite elegir viajaba en la
 * portada: mil filas y **937 KB** del documento, medidos el 2026-09-22. Es la
 * mitad de lo que pesa todo el resto de la primera página.
 *
 * Las dos mitades se piden ahora igual, que además es lo coherente: el corpus de
 * lugares no tiene ninguna presencia en la portada, así que nada suyo tiene por
 * qué estar en ella.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    return Response.json(
      { families: await readPlaceFamilies() },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] familias de lugares ilegibles', error);
    return Response.json(
      { error: 'No se pudo leer el catálogo de lugares' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}
