import 'server-only';

import { armarCadena, Interruptor, MODELO_POR_DEFECTO, type Eslabon } from './cadena';

/**
 * El pedido al modelo, con respaldo.
 *
 * Recorre la cadena de `cadena.ts`: si el principal no tiene crédito, limita o
 * no contesta, prueba el siguiente sin que el usuario lo note. Las claves viven
 * solo en el servidor y nunca viajan al navegador ni a los registros.
 */

export { MODELO_POR_DEFECTO };

export interface Uso {
  entrada: number;
  salida: number;
}

export interface Resultado {
  contenido: string;
  modelo: string;
  /** Qué eslabón contestó: `openrouter`, `gemini`, `openrouter-gratis`. */
  proveedor: string;
  latenciaMs: number;
  uso: Uso;
}

export interface Mensaje {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class ProveedorError extends Error {
  constructor(
    message: string,
    readonly status: 502 | 503 | 504,
  ) {
    super(message);
  }
}

const interruptor = new Interruptor();

const cadena = (): Eslabon[] => armarCadena(process.env);

export function modelo(): string {
  return cadena()[0]?.modelo ?? (process.env.ASISTENTE_MODELO?.trim() || MODELO_POR_DEFECTO);
}

/** Si hay al menos un proveedor con clave. Sin ninguno, el asistente contesta sin IA. */
export function configurado(): boolean {
  return cadena().length > 0;
}

/** Los proveedores configurados, por nombre y modelo, para el estado público. */
export function proveedores(): Array<{ nombre: string; modelo: string; enPausa: boolean }> {
  const ahora = Date.now();
  return cadena().map((e) => ({ nombre: e.nombre, modelo: e.modelo, enPausa: interruptor.saltear(e.nombre, ahora) }));
}

interface RespuestaProveedor {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
}

/** Un intento contra un eslabón. `status` es el HTTP del proveedor, o `null` si ni contestó. */
class Fallo extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly publico: ProveedorError,
  ) {
    super(message);
  }
}

async function intentar(e: Eslabon, mensajes: Mensaje[], maxTokens: number, temperatura: number, plazoMs: number): Promise<Resultado> {
  const inicio = performance.now();
  let respuesta: Response;
  try {
    respuesta = await fetch(e.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${e.clave}`,
        'content-type': 'application/json',
        'x-title': 'Observatorio Economico de Bolivia',
      },
      body: JSON.stringify({ model: e.modelo, messages: mensajes, max_tokens: maxTokens, temperature: temperatura, ...e.extra }),
      signal: AbortSignal.timeout(plazoMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Fallo('plazo vencido', null, new ProveedorError('El modelo excedió el tiempo de espera', 504));
    }
    throw new Fallo('sin respuesta', null, new ProveedorError('El proveedor de IA no respondió', 502));
  }
  if (!respuesta.ok) {
    /*
     * El cuerpo puede traer detalles de la cuenta y no se publica; el código
     * sí, porque es lo único que separa un límite de uso (429), una cuenta sin
     * crédito (402) o una clave inválida (401/403) de un modelo caído.
     */
    const status = respuesta.status;
    const detalle = await respuesta.text().catch(() => '');
    const publico =
      status === 429
        ? new ProveedorError('El proveedor de IA está limitando las consultas (HTTP 429). Probá en un minuto.', 503)
        : status === 402
          ? new ProveedorError('La cuenta del proveedor de IA se quedó sin crédito (HTTP 402).', 503)
          : status === 401 || status === 403
            ? new ProveedorError(`La clave del proveedor de IA fue rechazada (HTTP ${status}).`, 503)
            : new ProveedorError(`El proveedor de IA rechazó la solicitud (HTTP ${status}).`, 502);
    throw new Fallo(`HTTP ${status}: ${detalle.slice(0, 200)}`, status, publico);
  }
  let datos: RespuestaProveedor;
  try {
    datos = (await respuesta.json()) as RespuestaProveedor;
  } catch {
    throw new Fallo('JSON inválido', null, new ProveedorError('El proveedor de IA devolvió una respuesta inválida', 502));
  }
  const contenido = datos.choices?.[0]?.message?.content;
  if (typeof contenido !== 'string' || !contenido.trim()) {
    throw new Fallo('respuesta vacía', null, new ProveedorError('El proveedor de IA devolvió una respuesta vacía', 502));
  }
  return {
    contenido: contenido.trim(),
    modelo: typeof datos.model === 'string' ? datos.model : e.modelo,
    proveedor: e.nombre,
    latenciaMs: Math.round(performance.now() - inicio),
    uso: {
      entrada: typeof datos.usage?.prompt_tokens === 'number' ? datos.usage.prompt_tokens : 0,
      salida: typeof datos.usage?.completion_tokens === 'number' ? datos.usage.completion_tokens : 0,
    },
  };
}

/**
 * Pide la respuesta al primer eslabón que conteste.
 *
 * Cada intento tiene el plazo entero, pero la cadena no puede pasar de una vez
 * y media ese plazo en total: tres proveedores lentos no pueden tener al
 * usuario esperando un minuto. Si ninguno contesta, sale el error del último,
 * que `asistente.ts` convierte en una respuesta sin IA.
 */
export async function pedir(mensajes: Mensaje[], maxTokens: number, temperatura: number, plazoMs: number): Promise<Resultado> {
  const todos = cadena();
  if (todos.length === 0) throw new ProveedorError('Proveedor de IA no configurado', 503);
  const limite = Date.now() + plazoMs * 1.5;
  let ultimo = new ProveedorError('El proveedor de IA no respondió', 502);
  for (const e of interruptor.aProbar(todos, Date.now())) {
    const resta = limite - Date.now();
    if (resta < 1_500) break;
    try {
      const r = await intentar(e, mensajes, maxTokens, temperatura, Math.min(plazoMs, resta));
      interruptor.exito(e.nombre);
      return r;
    } catch (error) {
      if (!(error instanceof Fallo)) throw error;
      interruptor.fallo(e.nombre, error.status, Date.now());
      console.warn(`[asistente] ${e.nombre} (${e.modelo}) falló: ${error.message}`);
      ultimo = error.publico;
    }
  }
  throw ultimo;
}
