import { encodeCursor, parseListParam, parseTextParam } from '@/lib/api-v1/contrato';
import { OPTIONS, accept, serve } from '@/lib/api-v1/responder';
import { readPressPage } from '@/lib/series';

/**
 * Las notas de prensa del archivo, con el mismo predicado que cuenta el panel
 * de Prensa y arma su descarga: la página se elige en la base, por año, tono,
 * tema, región, medio y término, y llega de la más nueva a la más vieja.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { OPTIONS };

/** Valores por filtro: los mismos cincuenta que admite la descarga del panel. */
const MAX_VALUES = 50;

/** La nota más reciente del archivo entero: la frescura de la fuente, no de la página. */
async function newestInArchive(): Promise<string | null> {
  // Es la primera página sin filtro, la misma de la portada: la sostiene `readPressPage`.
  const { articles } = await readPressPage({}, 1, 0);
  const newest = articles[0];
  return newest ? (newest.publishedAt ?? newest.eventDate) : null;
}

export function GET(request: Request): Promise<Response> {
  return serve(request, 'prensa', async ({ params, offset, pageSize }) => {
    const many = (name: string, pattern?: RegExp, what?: string): string[] | undefined => {
      const values = accept(
        parseListParam(name, params.get(name), {
          limit: MAX_VALUES,
          ...(pattern ? { pattern } : {}),
          ...(what ? { what } : {}),
        }),
      );
      return values.length ? values : undefined;
    };
    const query = {
      year: many('anio', /^\d{4}$/u, 'un año de cuatro cifras'),
      tone: many('tono'),
      topic: many('tema'),
      region: many('region'),
      outlet: many('medio'),
      term: many('termino'),
      search: accept(parseTextParam('buscar', params.get('buscar'))) || undefined,
    };
    const [{ articles }, actualizado] = await Promise.all([
      readPressPage(query, pageSize, offset),
      newestInArchive(),
    ]);
    // La lectura no cuenta el total (contarlo cuesta segundos en la vista):
    // una página llena es señal de que puede haber otra; la que sigue vacía
    // llega con «siguiente» en null.
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
      siguiente: articles.length === pageSize ? encodeCursor({ o: offset + articles.length }) : null,
      fuente: 'DatosBolivia.com: archivo de prensa (el enlace a la nota va en cada fila)',
      actualizado,
    };
  });
}
