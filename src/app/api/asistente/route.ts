import { AsistenteError, estado, responder, type Turno } from '@/lib/asistente/asistente';

/**
 * El asistente del Observatorio.
 *
 * `POST` recibe `{ pregunta, historial? }` y devuelve la respuesta armada con
 * los datos del tablero. `GET` dice si está activo, con qué proveedores y en
 * qué estado está el saldo (sin montos), sin gastar nada: es lo que prueba que
 * un despliegue ya trae el asistente y lo que mira el aviso diario de saldo.
 *
 * El historial lo guarda el navegador, no el servidor —la base es de solo
 * lectura y una conversación de un visitante no tiene por qué quedar en ella—,
 * así que llega en cada pregunta, recortado y validado.
 */

export const dynamic = 'force-dynamic';

const MAX_PREGUNTA = 1_000;
const MAX_TURNOS = 6;

export async function GET(): Promise<Response> {
  return Response.json(await estado(), { headers: { 'Cache-Control': 'no-store' } });
}

function ipDe(request: Request): string {
  const reenviada = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return reenviada || request.headers.get('x-real-ip')?.trim() || 'sin-ip';
}

function leerHistorial(valor: unknown): Turno[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter(
      (t): t is Turno =>
        !!t &&
        typeof t === 'object' &&
        ((t as Turno).rol === 'usuario' || (t as Turno).rol === 'asistente') &&
        typeof (t as Turno).texto === 'string',
    )
    .slice(-MAX_TURNOS)
    .map((t) => ({ rol: t.rol, texto: t.texto.slice(0, 2_000) }));
}

export async function POST(request: Request): Promise<Response> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: 'La consulta no es JSON válido.' }, { status: 400 });
  }
  const pregunta = (cuerpo as { pregunta?: unknown } | null)?.pregunta;
  if (typeof pregunta !== 'string' || !pregunta.trim()) {
    return Response.json({ error: 'Escribí una pregunta.' }, { status: 400 });
  }
  if (pregunta.length > MAX_PREGUNTA) {
    return Response.json({ error: `La pregunta puede tener hasta ${MAX_PREGUNTA} caracteres.` }, { status: 400 });
  }

  try {
    const respuesta = await responder(
      pregunta,
      leerHistorial((cuerpo as { historial?: unknown }).historial),
      ipDe(request),
    );
    return Response.json(respuesta, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AsistenteError) {
      return Response.json(
        { error: error.message },
        {
          status: error.status,
          headers: error.reintentarEn ? { 'Retry-After': String(error.reintentarEn) } : {},
        },
      );
    }
    // El mensaje puede llevar el servidor, el usuario y el puerto.
    console.error('[asistente] respuesta fallida', error);
    return Response.json({ error: 'No se pudo armar la respuesta. Probá de nuevo.' }, { status: 500 });
  }
}
