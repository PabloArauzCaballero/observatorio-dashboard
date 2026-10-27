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

/**
 * La dirección del lector detrás del proxy de Coolify.
 *
 * No la primera de `X-Forwarded-For`: esa la escribe quien pide, y bastaba
 * cambiarla en cada pedido para saltarse todos los topes. Cada proxy agrega la
 * dirección de quien le habló al final de la lista, así que la confiable es la
 * que agregó el último proxy propio. `PROXY_SALTOS` dice cuántos hay delante
 * del tablero (uno en Coolify).
 */
export function clientIp(request: Request): string {
  const saltos = Math.max(1, Number.parseInt(process.env.PROXY_SALTOS ?? '1', 10) || 1);
  const cadena = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);
  const reenviada = cadena.length >= saltos ? cadena[cadena.length - saltos] : undefined;
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

const gastos = new Map<string, Map<string, Array<{ t: number; n: number }>>>();

/**
 * Lo que le queda a `ip` de un presupuesto de `maximo` unidades en `ventanaMs`.
 * Para los cupos que se miden en filas servidas y no en pedidos: cuántos
 * pedidos hace alguien importa menos que cuánto se lleva.
 */
export function remaining(nombre: string, ip: string, maximo: number, ventanaMs: number): number {
  const ahora = Date.now();
  const cupo = gastos.get(nombre);
  const recientes = (cupo?.get(ip) ?? []).filter((g) => ahora - g.t < ventanaMs);
  cupo?.set(ip, recientes);
  return Math.max(0, maximo - recientes.reduce((suma, g) => suma + g.n, 0));
}

/**
 * Reserva `cantidad` unidades del presupuesto `nombre` para `ip` y devuelve
 * cómo saldarla. Se reserva antes de esperar la base, en el mismo paso que se
 * consulta el saldo, para que pedidos simultáneos no vean todos el presupuesto
 * entero; al terminar, `saldar(usadas)` deja anotado solo lo servido.
 */
export function reserve(
  nombre: string,
  ip: string,
  cantidad: number,
  ventanaMs: number,
): { saldar: (usadas: number) => void } {
  const ahora = Date.now();
  let cupo = gastos.get(nombre);
  if (!cupo) {
    cupo = new Map();
    gastos.set(nombre, cupo);
  }
  const gasto = { t: ahora, n: Math.max(0, cantidad) };
  cupo.set(ip, [...(cupo.get(ip) ?? []), gasto]);
  if (cupo.size > 10_000) {
    for (const [clave, lista] of cupo) if (lista.every((g) => ahora - g.t >= ventanaMs)) cupo.delete(clave);
  }
  return {
    saldar: (usadas) => {
      gasto.n = Math.min(gasto.n, Math.max(0, usadas));
    },
  };
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
