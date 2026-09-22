import 'server-only';

/**
 * Una lectura del corpus, calculada una vez y sostenida unos minutos.
 *
 * Vivía dentro de `series.ts` y servía a cinco lecturas de las veinte que arma
 * la portada. Las otras quince volvían a la base en cada visita, y eso es lo
 * que medía el tablero el 2026-09-22: la portada tardaba **entre 16 y 23 s** en
 * responder, con la conexión **muda desde el segundo 1 hasta el 16** —ni un
 * byte de contenido— y después 1,09 MB comprimidos en dos segundos. No era la
 * red (el mismo servidor entrega `/api/panel` a 500 KB/s) ni el peso del
 * documento: era una veintena de consultas en el camino crítico del primer
 * pintado, la mayoría sin memoria.
 *
 * Ninguna de esas lecturas depende de quién pregunta, y el corpus sólo cambia
 * cuando el recolector publica —tres veces al día—. Unos minutos de retraso no
 * cuestan nada y las cifras siguen siendo exactas.
 *
 * Se guarda **la promesa** y no su resultado, que es lo que de verdad importa
 * aquí: diez lectores simultáneos esperan una consulta en vez de arrancar diez.
 * La portada pide varias veces la misma lectura en el mismo render —el resumen
 * y el capítulo del tipo de cambio leen el mismo observatorio—, y sin esto cada
 * una era una consulta más compitiendo por el mismo pool de diez conexiones en
 * un servidor de seis núcleos compartido con otros cinco proyectos.
 *
 * Un fallo no se recuerda: una caída de treinta segundos no puede convertirse
 * en la respuesta de los cinco minutos siguientes.
 */
const HELD = new Map<string, { at: number; value: Promise<unknown> }>();

/** Cuánto se sostiene una lectura. El recolector publica tres veces al día. */
export const HOLD_MS = 5 * 60 * 1000;

export function held<T>(key: string, build: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = HELD.get(key);
  if (entry && now - entry.at < HOLD_MS) return entry.value as Promise<T>;
  const value = build().catch((error: unknown) => {
    // A failed read must not be remembered as the answer for five minutes.
    HELD.delete(key);
    throw error;
  });
  HELD.set(key, { at: now, value });
  return value;
}
