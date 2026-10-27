import 'server-only';

/**
 * Cuántas veces puede pedir algo una misma dirección en una ventana de tiempo.
 *
 * Vive en la memoria del proceso, como el límite del asistente: cada servidor
 * corre un solo proceso, así que alcanza. Lo que no hace es sobrevivir a un
 * despliegue —el contador vuelve a cero— ni distinguir a dos personas detrás de
 * la misma dirección (una oficina, una universidad). Es un freno a la copia con
 * scripts, no una cuenta exacta; la cuenta exacta es la de los planes.
 */

const ventanas = new Map<string, Map<string, number[]>>();

/** La dirección del lector detrás del proxy de Coolify. */
export function clientIp(request: Request): string {
  const reenviada = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return reenviada || request.headers.get('x-real-ip')?.trim() || 'sin-ip';
}

export interface Admission {
  ok: boolean;
  /** Segundos hasta que se libere un lugar, cuando no hay. */
  retryAfter: number;
}

/**
 * Admite un pedido de `ip` en el cupo `nombre` si en los últimos `ventanaMs`
 * hubo menos de `maximo`. Un pedido rechazado no cuenta: quien insiste no
 * alarga su propia espera.
 */
export function admit(nombre: string, ip: string, maximo: number, ventanaMs: number): Admission {
  const ahora = Date.now();
  let cupo = ventanas.get(nombre);
  if (!cupo) {
    cupo = new Map();
    ventanas.set(nombre, cupo);
  }
  const recientes = (cupo.get(ip) ?? []).filter((t) => ahora - t < ventanaMs);
  if (recientes.length >= maximo) {
    cupo.set(ip, recientes);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((ventanaMs - (ahora - (recientes[0] ?? ahora))) / 1000)) };
  }
  recientes.push(ahora);
  cupo.set(ip, recientes);
  if (cupo.size > 10_000) {
    for (const [clave, tiempos] of cupo) if (tiempos.every((t) => ahora - t >= ventanaMs)) cupo.delete(clave);
  }
  return { ok: true, retryAfter: 0 };
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
