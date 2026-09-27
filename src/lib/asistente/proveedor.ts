import 'server-only';

/**
 * Una sola llamada a OpenRouter, igual que la de Atlas AI.
 *
 * La clave vive solo en el servidor (`OPENROUTER_API_KEY`) y nunca viaja al
 * navegador. El modelo por defecto es el mismo que usa Atlas; se cambia con
 * `ASISTENTE_MODELO` sin tocar código.
 */

export const MODELO_POR_DEFECTO = 'google/gemini-3.1-flash-lite-preview';

export interface Uso {
  entrada: number;
  salida: number;
}

export interface Resultado {
  contenido: string;
  modelo: string;
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

export function modelo(): string {
  return process.env.ASISTENTE_MODELO?.trim() || MODELO_POR_DEFECTO;
}

export function configurado(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

interface RespuestaProveedor {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
}

export async function pedir(
  mensajes: Mensaje[],
  maxTokens: number,
  temperatura: number,
  plazoMs: number,
): Promise<Resultado> {
  const clave = process.env.OPENROUTER_API_KEY?.trim();
  if (!clave) throw new ProveedorError('Proveedor de IA no configurado', 503);
  const elegido = modelo();
  const inicio = performance.now();
  let respuesta: Response;
  try {
    respuesta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${clave}`,
        'content-type': 'application/json',
        'x-title': 'Observatorio Economico de Bolivia',
      },
      body: JSON.stringify({
        model: elegido,
        messages: mensajes,
        max_tokens: maxTokens,
        temperature: temperatura,
        ...(elegido.startsWith('google/gemini') ? { reasoning_effort: 'minimal' } : {}),
      }),
      signal: AbortSignal.timeout(plazoMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ProveedorError('El modelo excedió el tiempo de espera', 504);
    }
    throw new ProveedorError('El proveedor de IA no respondió', 502);
  }
  if (!respuesta.ok) {
    /*
     * El cuerpo puede traer detalles de la cuenta y no se publica; el código
     * sí, porque es lo único que separa un límite de uso (429), una cuenta sin
     * crédito (402) o una clave inválida (401/403) de un modelo caído, y sin él
     * el diagnóstico exige los registros del contenedor, que no están a mano.
     */
    const status = respuesta.status;
    const detalle = await respuesta.text().catch(() => '');
    console.warn(`[asistente] el proveedor respondió ${status}: ${detalle.slice(0, 200)}`);
    if (status === 429) {
      throw new ProveedorError(`El proveedor de IA está limitando las consultas (HTTP 429). Probá en un minuto.`, 503);
    }
    if (status === 402) {
      throw new ProveedorError('La cuenta del proveedor de IA se quedó sin crédito (HTTP 402).', 503);
    }
    if (status === 401 || status === 403) {
      throw new ProveedorError(`La clave del proveedor de IA fue rechazada (HTTP ${status}).`, 503);
    }
    throw new ProveedorError(`El proveedor de IA rechazó la solicitud (HTTP ${status}).`, 502);
  }
  let datos: RespuestaProveedor;
  try {
    datos = (await respuesta.json()) as RespuestaProveedor;
  } catch {
    throw new ProveedorError('El proveedor de IA devolvió una respuesta inválida', 502);
  }
  const contenido = datos.choices?.[0]?.message?.content;
  if (typeof contenido !== 'string' || !contenido.trim()) {
    throw new ProveedorError('El proveedor de IA devolvió una respuesta vacía', 502);
  }
  return {
    contenido: contenido.trim(),
    modelo: typeof datos.model === 'string' ? datos.model : elegido,
    latenciaMs: Math.round(performance.now() - inicio),
    uso: {
      entrada: typeof datos.usage?.prompt_tokens === 'number' ? datos.usage.prompt_tokens : 0,
      salida: typeof datos.usage?.completion_tokens === 'number' ? datos.usage.completion_tokens : 0,
    },
  };
}
