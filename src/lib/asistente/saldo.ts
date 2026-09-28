import 'server-only';

/**
 * Cuánto crédito le queda a la cuenta de OpenRouter, dicho como un estado.
 *
 * El asistente se quedó mudo el 27-sep-2026 porque la cuenta nunca había tenido
 * crédito y nadie lo supo hasta que un usuario vio el error. Este estado es lo
 * que mira el workflow diario `saldo-ia.yml` para abrir un aviso antes de que
 * pase. Es público a propósito, así el workflow no necesita la clave: por eso
 * dice solo «ok», «bajo» o «agotado», nunca el monto ni nada de la cuenta.
 */

import { clasificarSaldo, type EstadoSaldo } from './cadena';

export type { EstadoSaldo };

const VIGENCIA_MS = 10 * 60_000;
let guardado: { estado: EstadoSaldo; en: number } | null = null;

function minimo(): number {
  const valor = Number(process.env.ASISTENTE_SALDO_MINIMO);
  return Number.isFinite(valor) && valor > 0 ? valor : 2;
}

/**
 * Lo que queda es el crédito cargado menos lo gastado. Si la clave tiene un
 * tope propio (`limit`), manda lo que le quede a la clave, que puede ser menos
 * que lo de la cuenta.
 */
async function consultar(clave: string): Promise<number | null> {
  const pedir = async (ruta: string): Promise<Record<string, unknown> | null> => {
    const r = await fetch(`https://openrouter.ai/api/v1/${ruta}`, {
      headers: { authorization: `Bearer ${clave}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return null;
    const cuerpo = (await r.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
    return cuerpo?.data ?? null;
  };
  const [creditos, llave] = await Promise.all([pedir('credits').catch(() => null), pedir('key').catch(() => null)]);
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const cuenta =
    creditos && num(creditos.total_credits) !== null && num(creditos.total_usage) !== null
      ? (num(creditos.total_credits) as number) - (num(creditos.total_usage) as number)
      : null;
  const deLaClave = llave ? num(llave.limit_remaining) : null;
  if (cuenta === null) return deLaClave;
  return deLaClave === null ? cuenta : Math.min(cuenta, deLaClave);
}

export async function estadoDelSaldo(): Promise<EstadoSaldo> {
  const clave = process.env.OPENROUTER_API_KEY?.trim();
  if (!clave) return 'sin-clave';
  if (guardado && Date.now() - guardado.en < VIGENCIA_MS) return guardado.estado;
  const estado = clasificarSaldo(await consultar(clave).catch(() => null), minimo());
  guardado = { estado, en: Date.now() };
  return estado;
}
