import { encodeCursor, parseList } from '@/lib/api-v1/contrato';
import { OPTIONS, serve } from '@/lib/api-v1/responder';
import { readPressPage } from '@/lib/series';

/**
 * Las notas de prensa del archivo, con el mismo predicado que cuenta el panel
 * de Prensa y arma su descarga: la página se elige en la base, por año, tono,
 * tema, región, medio y término, y llega de la más nueva a la más vieja.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

export function GET(request: Request): Promise<Response> {
  return serve(request, 'prensa', async ({ params, offset, pageSize }) => {
    const many = (name: string) => {
      const values = parseList(params.get(name), 50);
      return values.length ? values : undefined;
    };
    const buscar = params.get('buscar')?.trim().slice(0, 120);
    const { articles } = await readPressPage(
      {
        year: many('anio'),
        tone: many('tono'),
        topic: many('tema'),
        region: many('region'),
        outlet: many('medio'),
        term: many('termino'),
        search: buscar || undefined,
      },
      pageSize,
      offset,
    );
    // La lectura no cuenta el total (contarlo cuesta segundos en la vista):
    // una página llena es señal de que puede haber otra; la que sigue vacía
    // llega con «siguiente» en null.
    const end = offset + articles.length;
    return {
      data: articles.map((article) => ({
        fecha: article.eventDate,
        medio: article.outlet,
        seccion: article.section,
        tema: article.topic,
        tono: article.tone,
        region: article.region,
        titular: article.headline,
        entradilla: article.summary,
        enlace: article.url,
        obtencion: article.retrievalMethod,
        evidencia_sha256: article.evidenceSha256,
      })),
      siguiente: articles.length === pageSize ? encodeCursor({ o: end }) : null,
      fuente: 'DatosBolivia.com: archivo de prensa (el enlace a la nota va en cada fila)',
      actualizado: articles[0]?.publishedAt ?? null,
    };
  });
}
