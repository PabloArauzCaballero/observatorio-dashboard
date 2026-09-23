/**
 * El calentamiento del arranque: la primera lectura fría la paga el proceso, no
 * un visitante.
 *
 * `src/lib/hold.ts` sirve lo sostenido aunque haya vencido y lo renueva por
 * detrás, así que después de la primera lectura nadie espera a la base. Queda
 * esa primera: tras cada despliegue o reinicio el proceso no tiene nada, y
 * medido contra Contabo el 2026-09-23 la portada tardaba **37 s** en entregar el
 * resumen —la brecha sola son 28 s de consulta—. Sin esto, ese lector era el
 * primero que abría el tablero después de cada push a `dev`.
 *
 * Se calienta pidiendo al propio servidor lo mismo que pide un navegador, y no
 * llamando a los lectores desde aquí: así se calienta exactamente lo que se
 * sirve —la portada con sus dos `Suspense`, cada ruta con sus parámetros—, sin
 * abrir una dirección nueva que un extraño pudiera usar para lanzar consultas.
 *
 * Una petición cada vez y nunca a la vez, por lo mismo que el reloj de `hold`:
 * el servidor es compartido y diez consultas caras juntas son justo lo que el
 * 2026-09-09 lo llevó a carga 95. Si algo falla se registra y se sigue: un
 * calentamiento no puede tumbar un proceso que está sirviendo.
 *
 * Sólo en producción. En `next dev` cada lectura va a una base de Neon con cuota
 * y el servidor recompila en cada petición; ahí calentar no ahorra nada.
 * `DASHBOARD_WARMUP=off` lo apaga en cualquier despliegue.
 */

/** Lo que un lector pide primero, en el orden en que lo pide. */
const WARM_PATHS = [
  '/',
  '/api/medidas',
  '/api/empresas',
  '/api/archivo',
  '/api/temas',
  '/api/familias',
  '/api/fuentes',
  '/api/panel',
  '/api/mundo',
  '/api/energia',
  '/api/recursos',
  '/api/ambiente',
];

/** Cuánto se espera a que el servidor escuche antes de rendirse. */
const LISTEN_DEADLINE_MS = 120_000;

export function register(): void {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.DASHBOARD_WARMUP === 'off') return;
  // `register` corre antes de que el servidor escuche: se deja ir y se espera.
  setTimeout(() => void warm(), 1_000).unref?.();
}

async function warm(): Promise<void> {
  // `localhost` y no `127.0.0.1`: el standalone escucha en `::` salvo que se le
  // fije `HOSTNAME`, y con el nombre Node prueba las dos familias. Es la misma
  // razón por la que el HEALTHCHECK del Dockerfile lo usa.
  const base = `http://localhost:${process.env.PORT ?? '3000'}`;

  const started = Date.now();
  while (!(await answers(`${base}/api/version`))) {
    if (Date.now() - started > LISTEN_DEADLINE_MS) {
      console.warn('[observatorio] calentamiento: el servidor no escucha; se omite');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  for (const path of WARM_PATHS) {
    const at = Date.now();
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { 'user-agent': 'observatorio-calentamiento' },
      });
      // El cuerpo se consume entero: la portada lee dentro de su flujo, y
      // cortarlo en la cabecera dejaría el resumen sin leer.
      await response.arrayBuffer();
      console.log(`[observatorio] calentamiento ${path}: ${response.status} en ${Date.now() - at} ms`);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code ?? 'sin codigo';
      console.warn(`[observatorio] calentamiento ${path}: fallo (${code})`);
    }
  }
}

async function answers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    await response.arrayBuffer();
    return true;
  } catch {
    return false;
  }
}
