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
 *
 * ── LO VENCIDO SE SIRVE Y SE RENUEVA POR DETRÁS (2026-09-23) ──
 *
 * Con sólo el plazo, el primer lector después de cinco minutos sin visitas
 * pagaba las consultas enteras. Medido contra Contabo: la portada en caliente
 * 3,9 s, **en frío 37 s** —la cabecera al segundo 1 y el resumen al 37—, y
 * `/api/readers?serie=1` repartía la culpa: la brecha 28,5 s, el observatorio
 * 9,3 s, los mercados 8,2 s. En un tablero con pocas visitas casi todas son la
 * primera de su ventana de cinco minutos, así que lo que el lector veía era el
 * frío, no el caliente.
 *
 * Ahora una lectura vencida que ya tiene respuesta **se sirve tal cual** y se
 * vuelve a hacer por detrás; el lector siguiente recibe la nueva. Nadie espera
 * a la base salvo la primera vez que el proceso lee algo, y esa la paga el
 * calentamiento del arranque (`src/instrumentation.ts`), no un visitante.
 *
 * Y para que «vencida» no quiera decir «de hace una semana» en un tablero sin
 * visitas, un reloj renueva lo sostenido: cada cinco minutos lo que alguien
 * pidió en la última hora, cada hora lo demás. Una a una y nunca a la vez —el
 * servidor es compartido y la brecha sola son veintiocho segundos de CPU—. La
 * edad máxima de una cifra servida queda así en una hora y pico, contra un
 * recolector que publica cada ocho.
 */
interface Entry {
  /** Cuándo se pidió la versión que se está sirviendo. */
  at: number;
  /** La última vez que alguien la leyó; decide cada cuánto se renueva. */
  readAt: number;
  value: Promise<unknown>;
  /** Si `value` ya resolvió bien: sólo entonces se puede servir vencida. */
  settled: boolean;
  /** Una renovación en curso, para no lanzar dos. */
  renewing: boolean;
  build: () => Promise<unknown>;
}

const HELD = new Map<string, Entry>();

/** Cuánto se sostiene una lectura. El recolector publica tres veces al día. */
export const HOLD_MS = 5 * 60 * 1000;

/** Cada cuánto se renueva lo que nadie ha pedido en la última hora. */
const IDLE_RENEW_MS = 60 * 60 * 1000;

/** Qué cuenta como «pedida hace poco» para renovarla al ritmo del plazo. */
const RECENT_MS = 60 * 60 * 1000;

function store(key: string, build: () => Promise<unknown>, now: number): Entry {
  const entry: Entry = {
    at: now,
    readAt: now,
    settled: false,
    renewing: false,
    build,
    value: Promise.resolve(),
  };
  entry.value = build().then(
    (value) => {
      entry.settled = true;
      return value;
    },
    (error: unknown) => {
      // A failed read must not be remembered as the answer for five minutes.
      if (HELD.get(key) === entry) HELD.delete(key);
      throw error;
    },
  );
  HELD.set(key, entry);
  return entry;
}

/**
 * Rehace una lectura sin quitar la que se está sirviendo.
 *
 * La nueva sólo reemplaza a la vieja cuando llega bien: si la base falla o agota
 * el plazo, se sigue sirviendo la anterior —exacta hasta la última publicación
 * que alcanzó a leer— y se reintenta en la próxima vuelta del reloj.
 */
function renew(key: string, entry: Entry): Promise<void> {
  if (entry.renewing) return Promise.resolve();
  entry.renewing = true;
  const started = Date.now();
  return entry
    .build()
    .then((value) => {
      if (HELD.get(key) !== entry) return;
      entry.value = Promise.resolve(value);
      entry.at = started;
    })
    .catch((error: unknown) => {
      // El codigo va al registro; el mensaje puede llevar el host y el rol.
      const code = (error as { code?: string } | null)?.code ?? 'sin codigo';
      console.warn(`[observatorio] renovacion fallida: ${key} (${code}); se sirve la anterior`);
    })
    .finally(() => {
      entry.renewing = false;
    });
}

export function held<T>(key: string, build: () => Promise<T>): Promise<T> {
  keepFresh();
  const now = Date.now();
  const entry = HELD.get(key);
  if (!entry) return store(key, build, now).value as Promise<T>;

  entry.readAt = now;
  // Vencida y con respuesta: se sirve la que hay y se rehace por detrás. Sin
  // respuesta todavía es la misma consulta en curso, y se la sigue esperando.
  if (now - entry.at >= HOLD_MS && entry.settled) void renew(key, entry);
  return entry.value as Promise<T>;
}

let clock: ReturnType<typeof setInterval> | null = null;
let turning = false;

/**
 * Arranca el reloj que renueva lo sostenido, una sola vez por proceso.
 *
 * Se llama desde `held`, así que existe en cuanto hay algo que renovar, haya o
 * no calentamiento. `unref` para que el reloj no retenga un proceso que ya
 * debería terminar.
 */
function keepFresh(): void {
  if (clock) return;
  clock = setInterval(() => void turn(), HOLD_MS);
  clock.unref?.();
}

async function turn(): Promise<void> {
  if (turning) return;
  turning = true;
  try {
    const now = Date.now();
    for (const [key, entry] of [...HELD.entries()]) {
      if (!entry.settled || entry.renewing) continue;
      const recent = now - entry.readAt < RECENT_MS;
      if (now - entry.at >= (recent ? HOLD_MS : IDLE_RENEW_MS)) {
        // De una en una: el pool es de diez y el servidor, compartido.
        await renew(key, entry);
      }
    }
  } finally {
    turning = false;
  }
}
