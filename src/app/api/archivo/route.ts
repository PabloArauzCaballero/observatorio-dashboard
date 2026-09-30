import { isUnaffordableRead, readPressCube, readPressPage, readPressPulse } from '@/lib/series';
import { jsonResponse } from '@/lib/respond';

/**
 * La primera pantalla del archivo de prensa, pedida al abrir la pestaña.
 *
 * Tres cosas que el explorador necesita a la vez para dibujar algo: la
 * tabulación cruzada —que es la que responde «cuántas» sin volver a preguntar—,
 * la primera página de notas y la extensión del archivo. Juntas eran **898 KB**
 * de la portada, medidos el 2026-09-22.
 *
 * `/api/prensa` ya servía las páginas siguientes y las selecciones del lector.
 * Lo que faltaba era la primera, y mientras faltó viajaba en el documento de
 * todas las visitas, abriera nadie la pestaña o no.
 *
 * El recorte inicial deja fuera `OTROS` a propósito: es la pestaña de prensa
 * económica, y ese tema es el residuo. El cuadro de mando de «Hoy» hace la
 * lectura contraria —sin filtrar— porque un bloqueo de caminos entra por ahí, y
 * ésa sí sigue en el servidor porque el resumen la necesita para existir.
 */

export const dynamic = 'force-dynamic';

/** Cuántas notas trae una página del registro; `/api/prensa` usa la misma. */
const PAGE_SIZE = 60;

export async function GET(request: Request): Promise<Response> {
  try {
    /*
     * En serie y no en paralelo, como el capítulo del tipo de cambio y por la
     * misma razón: las tres lecturas se sostienen cinco minutos, y el cubo es la
     * más cara de las tres. Pedido primero deja resueltas las de abajo desde
     * memoria; lanzadas a la vez, la primera visita tras vencer el plazo dispara
     * dos recorridos del archivo al mismo tiempo, y en el servidor chico eso
     * basta para que alguna no entre en su plazo.
     */
    const cube = await readPressCube();
    const [page, pulse] = await Promise.all([
      readPressPage({ topic: ['ECONOMICOS'] }, PAGE_SIZE),
      readPressPulse(),
    ]);

    return jsonResponse(
      request,
      {
        cube,
        articles: page.articles,
        span: {
          total: pulse.total,
          outlets: pulse.outlets,
          firstDay: pulse.firstDay,
          lastDay: pulse.lastDay,
          unmarked: pulse.unmarked,
        },
      },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[observatorio] archivo de prensa ilegible', error);
    return Response.json(
      { error: 'No se pudo leer el archivo de prensa' },
      { status: isUnaffordableRead(error) ? 503 : 500 },
    );
  }
}
