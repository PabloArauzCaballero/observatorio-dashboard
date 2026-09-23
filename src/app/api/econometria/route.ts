import { readEconometricsReport } from '@/lib/fx-econometrics-reader';

/**
 * Las pruebas econométricas del tipo de cambio, como PDF para descargar.
 *
 * El documento se arma en `fx-econometrics-report.ts` y se sostiene cinco
 * minutos en el servidor (`hold.ts`); el navegador lo guarda diez más, así que
 * el segundo clic de un mismo lector ni siquiera llega aquí. `private` porque
 * no hay motivo para que un intermediario lo sirva a otros con la fecha de
 * otro día: el tablero entero se niega a quedar en cachés compartidas.
 */

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const document = await readEconometricsReport();
    if (!document) {
      return new Response('Todavía no hay jornadas suficientes del paralelo para las pruebas.\n', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return new Response(document.bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.fileName}"`,
        'Content-Length': String(document.bytes.byteLength),
        'Cache-Control': 'private, max-age=600',
      },
    });
  } catch (error) {
    // El detalle va al registro: un mensaje de conexión puede llevar el host.
    console.error('[observatorio] informe econométrico fallido', error);
    return new Response('No fue posible armar el informe.\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
