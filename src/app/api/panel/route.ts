import { readBoliviaPanel } from '@/lib/series';
import { packMacro } from '@/lib/macro-transport';

/**
 * El catálogo del Banco Mundial para Bolivia, pedido al abrir su pestaña.
 *
 * No viaja con la portada, y esta vez la razón no es solo que la mayoría de los
 * visitantes nunca abre la pestaña. Son mil quinientas series y treinta mil
 * lecturas: puestas en el HTML de la primera página serían más peso que todo lo
 * demás junto, para un capítulo que es de consulta. Sale empaquetado —catálogo
 * aparte, lecturas como tuplas— por lo mismo que el panel macro, que es que el
 * nombre de una serie del Banco Mundial pasa de los cien caracteres y repetirlo
 * una vez por año es casi todo el archivo.
 *
 * La fuente publica una vez al año y revisa un puñado de veces más, así que un
 * navegador que sale de la pestaña y vuelve puede quedarse diez minutos con lo
 * que ya tiene en vez de volver a preguntar: las subpestañas se vuelven a
 * montar en cada cambio, y cada montaje sería si no una lectura nueva.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    return Response.json(
      { bundle: packMacro(await readBoliviaPanel()) },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto. Va al
    // registro, no a una respuesta servida al público.
    console.error('[observatorio] catalogo del Banco Mundial ilegible', error);
    return Response.json({ error: 'No se pudo leer el catálogo del Banco Mundial' }, { status: 500 });
  }
}
