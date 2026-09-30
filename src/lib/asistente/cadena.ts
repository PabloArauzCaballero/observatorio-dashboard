/**
 * Por qué proveedores pasa una pregunta, y cuáles saltear por un rato.
 *
 * El asistente se quedaba mudo cuando la única cuenta se quedaba sin crédito.
 * Ahora cada pedido recorre una cadena: el modelo pagado de OpenRouter, Gemini
 * directo de Google (con su capa gratuita) y, si se configura, un modelo
 * gratuito de OpenRouter. Los tres hablan el formato de chat de OpenAI, así que
 * el pedido es el mismo y solo cambian la dirección, la clave y el modelo.
 *
 * Puro —sin red ni `process`— para probarlo con `node --test`: recibe las
 * variables de entorno como objeto.
 */

export interface Eslabon {
  /** Cómo se lo nombra en los registros y en el estado público: nunca la clave. */
  nombre: string;
  url: string;
  clave: string;
  modelo: string;
  /** Campos propios del proveedor que se suman al pedido. */
  extra: Record<string, unknown>;
}

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** La compatibilidad con OpenAI de la API de Gemini: mismo pedido, otra dirección. */
export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const MODELO_POR_DEFECTO = 'google/gemini-3.1-flash-lite-preview';

type Entorno = Readonly<Record<string, string | undefined>>;

const valor = (env: Entorno, nombre: string): string => env[nombre]?.trim() ?? '';

/** Gemini con el mínimo de razonamiento: la respuesta es redacción sobre datos, no un problema. */
const extraGemini = (modelo: string): Record<string, unknown> =>
  /gemini/i.test(modelo) ? { reasoning_effort: 'minimal' } : {};

/**
 * La cadena, en orden, con solo los eslabones que tienen clave.
 *
 * - `OPENROUTER_API_KEY` + `ASISTENTE_MODELO`: el principal.
 * - `GEMINI_API_KEY` + `ASISTENTE_MODELO_GEMINI` (por defecto, el mismo modelo
 *   sin el prefijo `google/`): el respaldo con capa gratuita de Google.
 * - `ASISTENTE_MODELO_GRATIS`: uno o varios modelos gratuitos de OpenRouter,
 *   separados por coma, que no gastan crédito pero tienen cupo diario y a
 *   veces están saturados (429). Cada uno es su propio eslabón, así uno
 *   saturado se saltea y se prueba el siguiente. Sin valor por defecto: cuáles
 *   hay cambia; `GET https://openrouter.ai/api/v1/models` los lista.
 */
export function armarCadena(env: Entorno): Eslabon[] {
  const cadena: Eslabon[] = [];
  const openrouter = valor(env, 'OPENROUTER_API_KEY');
  const principal = valor(env, 'ASISTENTE_MODELO') || MODELO_POR_DEFECTO;
  if (openrouter) {
    cadena.push({ nombre: 'openrouter', url: OPENROUTER_URL, clave: openrouter, modelo: principal, extra: extraGemini(principal) });
  }
  const gemini = valor(env, 'GEMINI_API_KEY');
  if (gemini) {
    const modelo = valor(env, 'ASISTENTE_MODELO_GEMINI') || principal.replace(/^google\//, '');
    cadena.push({ nombre: 'gemini', url: GEMINI_URL, clave: gemini, modelo, extra: extraGemini(modelo) });
  }
  const gratis = valor(env, 'ASISTENTE_MODELO_GRATIS').split(',').map((m) => m.trim()).filter(Boolean);
  if (openrouter) {
    gratis.forEach((modelo, i) => {
      cadena.push({ nombre: i === 0 ? 'openrouter-gratis' : `openrouter-gratis-${i + 1}`, url: OPENROUTER_URL, clave: openrouter, modelo, extra: {} });
    });
  }
  return cadena;
}

/**
 * Cuánto se saltea un eslabón según cómo falló.
 *
 * Sin crédito o con la clave rechazada no se arregla solo en segundos: probarlo
 * en cada pregunta le suma a cada usuario la espera de un pedido perdido. Un
 * límite de uso (429) se levanta rápido. Un error suelto o un plazo vencido no
 * castiga: el siguiente pedido lo vuelve a intentar.
 */
export function pausaPorFallo(status: number | null): number {
  if (status === 402 || status === 401 || status === 403) return 10 * 60_000;
  if (status === 429) return 60_000;
  return 0;
}

/** Hasta cuándo se saltea cada eslabón, por nombre. Vive en la memoria del proceso. */
export class Interruptor {
  private readonly hasta = new Map<string, number>();

  saltear(nombre: string, ahora: number): boolean {
    return (this.hasta.get(nombre) ?? 0) > ahora;
  }

  fallo(nombre: string, status: number | null, ahora: number): void {
    const pausa = pausaPorFallo(status);
    if (pausa > 0) this.hasta.set(nombre, ahora + pausa);
  }

  exito(nombre: string): void {
    this.hasta.delete(nombre);
  }

  /** Los eslabones a probar ahora. Si todos están en pausa, se prueban igual: mejor un intento que ninguno. */
  aProbar(cadena: readonly Eslabon[], ahora: number): Eslabon[] {
    const vivos = cadena.filter((e) => !this.saltear(e.nombre, ahora));
    return vivos.length > 0 ? vivos : [...cadena];
  }
}

export type EstadoSaldo = 'ok' | 'bajo' | 'agotado' | 'desconocido' | 'sin-clave';

/** El crédito que queda, dicho como estado: sin montos, porque el estado es público. */
export function clasificarSaldo(restante: number | null, umbral: number): EstadoSaldo {
  if (restante === null || !Number.isFinite(restante)) return 'desconocido';
  if (restante <= 0) return 'agotado';
  return restante < umbral ? 'bajo' : 'ok';
}
