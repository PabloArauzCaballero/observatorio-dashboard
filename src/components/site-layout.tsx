'use client';

import {
  Children,
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/icons';
import type { IconName } from '@/components/icons';
import {
  EVENTO_ENLACE,
  PARAM_PAGINA,
  PARAM_PESTANA,
  anotar,
  hrefDe,
  leerParametro,
  slug,
} from '@/lib/enlace-tablero';
import { SITE, destinoDe, idDePagina, idDeSeccion } from '@/lib/site-map';
import type { Destino } from '@/lib/site-map';

/**
 * El tablero como una sola página larga, con un índice fijo.
 *
 * Antes eran ocho pestañas y, dentro de ellas, unas veinticinco páginas más: ocho
 * botones arriba y otra fila debajo, y cada tema escondido detrás de un clic. Ahora todo es una
 * lectura que baja, con el índice a un lado para saltar y saber dónde se está.
 *
 * La regla que no se negocia es la de la portada: **nada se lee hasta que se acerca**. Una página que
 * montara las veinticinco a la vez descargaría y dibujaría decenas de megabytes de gráficos antes de
 * que nadie bajara un píxel (el mismo desastre de 16 a 23 s que ya costó la portada cuando las siete
 * pestañas se leían a la vez). Cada bloque queda en un hueco con su nombre hasta que entra en el
 * margen de la pantalla, o hasta que el índice o un enlace lo pide; una vez montado se queda montado.
 */

/** Quién pide que se monte un bloque, sin esperar a que se acerque: el índice y los enlaces. */
const EVENTO_MONTAR = 'observatorio:montar';

/** El rótulo de la sección en que está cada página, para que `SubSections` arme sus anclas. */
const SeccionContexto = createContext<string>('');

const siguienteCuadro = (): Promise<void> =>
  new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver())));

function pedirMontaje(ids: string[]): void {
  window.dispatchEvent(new CustomEvent(EVENTO_MONTAR, { detail: ids }));
}

/** Mientras el lector viaja a un destino la dirección es la del destino, no la de lo que se cruza. */
let viajando = false;
let viaje = 0;
/** Donde terminó el último viaje: una página corta deja a la siguiente bajo la línea de lectura. */
let llegada: { id: string; y: number } | null = null;

const esperar = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Lleva al lector a una sección o a una página: monta lo que haga falta, baja hasta allí y lo anota
 * en la dirección. Primero la sección y después la página, porque la página no existe en el documento
 * hasta que su sección se monta.
 *
 * Los huecos que se montan en el camino cambian de alto, y con ellos el lugar del destino: por eso
 * no basta un solo `scrollIntoView`. Se vuelve a alinear unos segundos, hasta que el lector toque la
 * pantalla —entonces manda él—. Si la dirección trae `#panel`, lo que se alinea es ese panel.
 */
async function irA(destino: Destino, sumarAlHistorial: boolean): Promise<void> {
  const mio = ++viaje;
  viajando = true;
  const hash = window.location.hash;
  const direccion = hrefDe({ pestana: destino.seccion, pagina: destino.pagina });
  if (sumarAlHistorial) window.history.pushState(null, '', direccion);
  else window.history.replaceState(null, '', direccion + hash);

  pedirMontaje([idDeSeccion(destino.seccion)]);
  await siguienteCuadro();
  if (destino.pagina) {
    pedirMontaje([destino.id]);
    await siguienteCuadro();
  }

  const meta = (): HTMLElement | null => {
    const panel =
      !sumarAlHistorial && hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
    return panel ?? document.getElementById(destino.id);
  };
  const alinear = (forzar: boolean) => {
    const elemento = meta();
    if (!elemento) return;
    const margen = Number.parseFloat(getComputedStyle(elemento).scrollMarginTop) || 0;
    if (forzar || Math.abs(elemento.getBoundingClientRect().top - margen) > 4) {
      elemento.scrollIntoView({ block: 'start' });
    }
  };

  let suelto = false;
  const soltar = () => {
    suelto = true;
  };
  const gestos = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  for (const gesto of gestos) window.addEventListener(gesto, soltar, { passive: true, once: true });
  alinear(true);
  const limite = Date.now() + 3500;
  while (!suelto && mio === viaje && Date.now() < limite) {
    await esperar(150);
    alinear(false);
  }
  for (const gesto of gestos) window.removeEventListener(gesto, soltar);
  if (mio === viaje) {
    viajando = false;
    llegada = suelto ? null : { id: destino.id, y: window.scrollY };
  }
}

/**
 * Lo que un bloque no pueda dibujar se queda en el bloque.
 *
 * Cada sección se pide en su propio trozo de JavaScript. Si ese trozo no llega —un 502 pasajero
 * del servidor al desplegar, una conexión que se corta— la excepción subía hasta la raíz y se
 * llevaba la página entera (`Application error`). Ahora cae aquí: el resto del informe sigue y el
 * bloque ofrece recargar.
 */
class BloqueSeguro extends Component<{ label: string; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[observatorio] bloque sin dibujar', this.props.label, error);
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div className="site-wait" role="alert">
        <b>{this.props.label}</b>
        <span>No se pudo cargar esta parte.</span>
        <button type="button" className="menu-btn" onClick={() => window.location.reload()}>
          Recargar la página
        </button>
      </div>
    );
  }
}

/** Un bloque que se monta cuando se acerca a la pantalla y no antes. */
function Bloque({
  id,
  label,
  tipo,
  eager = false,
  children,
}: {
  id: string;
  label: string;
  tipo: 'seccion' | 'pagina';
  eager?: boolean;
  children: ReactNode;
}) {
  const [montado, setMontado] = useState(eager);
  const ref = useRef<HTMLElement>(null);
  /*
   * Un bloque recién montado muestra su aviso de «Cargando», que es mucho más bajo que el hueco
   * que ocupaba: sin retener el alto, el de abajo sube a la pantalla, se monta, y así en cadena
   * hasta que todo el informe pide sus datos a la vez. Se conserva el alto del hueco unos
   * segundos —lo que tarda en llegar lo suyo— y luego cada bloque mide lo que mide.
   */
  const [retener, setRetener] = useState(true);
  useEffect(() => {
    if (!montado) return;
    const hasta = window.setTimeout(() => setRetener(false), 6000);
    return () => window.clearTimeout(hasta);
  }, [montado]);

  useEffect(() => {
    if (montado) return;
    const elemento = ref.current;
    if (!elemento) return;
    const montar = () => {
      setMontado(true);
      cercano.disconnect();
      visible.disconnect();
    };
    // Lo que ya se ve se monta siempre.
    const visible = new IntersectionObserver((entradas) => {
      if (entradas.some((entrada) => entrada.isIntersecting)) montar();
    });
    /*
     * Lo que está por llegar, solo cuando el lector ya se mueve. Al cargar, con la portada aún
     * vacía, todos los huecos de abajo caben en el margen y se montaban a la vez: eso era
     * pedirle al servidor lo de cada sección antes de que nadie bajara un píxel.
     */
    const cercano = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((entrada) => entrada.isIntersecting)) return;
        if (viajando || window.scrollY > 120) montar();
      },
      // Algo más de media pantalla: cuando el lector llega, ya está dibujado.
      { rootMargin: '600px 0px' },
    );
    visible.observe(elemento);
    cercano.observe(elemento);
    const pedido = (evento: Event) => {
      const ids = (evento as CustomEvent<string[]>).detail;
      if (ids.includes(id)) setMontado(true);
    };
    window.addEventListener(EVENTO_MONTAR, pedido);
    return () => {
      cercano.disconnect();
      visible.disconnect();
      window.removeEventListener(EVENTO_MONTAR, pedido);
    };
  }, [montado, id]);

  return (
    <section
      ref={ref}
      id={id}
      className={`site-block site-block-${tipo}`}
      data-site-id={id}
      data-site-kind={tipo}
      data-label={label}
      data-montado={montado ? 'si' : 'no'}
      data-retener={montado && retener ? 'si' : undefined}
      aria-label={label}
    >
      {montado ? (
        <BloqueSeguro label={label}>{children}</BloqueSeguro>
      ) : (
        <div className="site-wait" role="status">
          <b>{label}</b>
          <span>Se carga al llegar aquí.</span>
        </div>
      )}
    </section>
  );
}

/**
 * Las páginas de una sección, una debajo de otra.
 *
 * Sustituye a `SubTabs` donde la barra de páginas era el primer nivel de la pestaña. Cada página
 * lleva su título y su ancla (`macroeconomia--series-de-bolivia`) y se monta al acercarse. La primera
 * se monta junto con su sección: es lo que el lector viene a ver.
 */
export function SubSections({
  labels,
  icons,
  children,
}: {
  labels: string[];
  icons: IconName[];
  children: ReactNode[];
  /** Compatibilidad con `SubTabs`: aquí todas las páginas siguen la dirección. */
  enlace?: boolean;
}) {
  const seccion = useContext(SeccionContexto);
  return (
    <div className="sub-sections">
      {labels.map((label, indice) => (
        <Bloque
          key={label}
          id={idDePagina(seccion, label)}
          label={label}
          tipo="pagina"
          eager={indice === 0}
        >
          <h3 className="sub-title">
            <Icon name={icons[indice] ?? 'cajas'} size={16} />
            {label}
          </h3>
          <div className="stack">{children[indice]}</div>
        </Bloque>
      ))}
    </div>
  );
}

/** Qué bloque está a la altura de la lectura: el último cuyo borde superior ya pasó el 30 % de la pantalla. */
function bloqueActivo(): string | null {
  const limite = window.innerHeight * 0.3;
  let activo: string | null = null;
  for (const bloque of document.querySelectorAll<HTMLElement>('[data-site-id]')) {
    if (bloque.getBoundingClientRect().top <= limite) activo = bloque.dataset.siteId ?? activo;
    else break;
  }
  return activo;
}

function Indice({
  activo,
  abierto,
  cerrar,
}: {
  activo: string | null;
  abierto: boolean;
  cerrar: () => void;
}) {
  const seccionActiva = activo
    ? activo.split('--')[0]
    : SITE[0]
      ? idDeSeccion(SITE[0].label)
      : null;

  const ir = (evento: React.MouseEvent, destino: Destino) => {
    evento.preventDefault();
    cerrar();
    void irA(destino, true);
  };

  return (
    <nav
      className={abierto ? 'site-index site-index-open' : 'site-index'}
      aria-label="Secciones del informe"
    >
      <ul>
        {SITE.map((seccion) => {
          const id = idDeSeccion(seccion.label);
          const esActiva = seccionActiva === id;
          return (
            <li key={id}>
              <a
                href={hrefDe({ pestana: seccion.label })}
                className={esActiva ? 'site-link site-link-on' : 'site-link'}
                aria-current={esActiva && activo === id ? 'location' : undefined}
                onClick={(evento) => ir(evento, { id, seccion: seccion.label })}
              >
                <Icon name={seccion.icon} size={15} />
                {seccion.label}
              </a>
              {esActiva && seccion.pages.length > 0 ? (
                <ul className="site-pages">
                  {seccion.pages.map((pagina) => {
                    const idPagina = idDePagina(seccion.label, pagina.label);
                    return (
                      <li key={idPagina}>
                        <a
                          href={hrefDe({ pestana: seccion.label, pagina: pagina.label })}
                          className={activo === idPagina ? 'site-page site-page-on' : 'site-page'}
                          aria-current={activo === idPagina ? 'location' : undefined}
                          onClick={(evento) =>
                            ir(evento, {
                              id: idPagina,
                              seccion: seccion.label,
                              pagina: pagina.label,
                            })
                          }
                        >
                          {pagina.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * La página: el índice a un lado y, una debajo de otra, las secciones.
 *
 * `children` trae un elemento por sección, en el orden de `SITE`. Nombre de la dirección: sigue
 * funcionando `/?pestana=…&pagina=…` —el asistente, los enlaces copiados— y se mantiene al día con
 * lo que el lector está leyendo, de modo que «Copiar enlace al panel» lleve a donde está.
 */
export function SiteLayout({ children }: { children: ReactNode[] }) {
  const [activo, setActivo] = useState<string | null>(null);
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  const secciones = Children.toArray(children);

  // Ir a lo que dice la dirección al llegar, y cuando el asistente o «atrás» la cambian.
  useEffect(() => {
    const seguir = (sumar: boolean) => {
      const destino = destinoDe(leerParametro(PARAM_PESTANA), leerParametro(PARAM_PAGINA));
      if (destino) void irA(destino, sumar);
    };
    // Al llegar: sin esperar, para que la lectura no borre de la dirección lo que viene a buscar.
    seguir(false);
    const alEnlazar = () => seguir(false);
    window.addEventListener(EVENTO_ENLACE, alEnlazar);
    window.addEventListener('popstate', alEnlazar);
    return () => {
      window.removeEventListener(EVENTO_ENLACE, alEnlazar);
      window.removeEventListener('popstate', alEnlazar);
    };
  }, []);

  // El índice y la dirección siguen a la lectura.
  useEffect(() => {
    let pendiente = false;
    let anotado = '';
    const medir = () => {
      pendiente = false;
      const id = llegada && Math.abs(window.scrollY - llegada.y) < 8 ? llegada.id : bloqueActivo();
      setActivo(id);
      if (viajando || !id || id === anotado) return;
      anotado = id;
      const [seccion, pagina] = id.split('--');
      const rotuloSeccion = SITE.find((s) => idDeSeccion(s.label) === seccion);
      if (!rotuloSeccion) return;
      // En la primera sección la dirección queda limpia: es donde se llega sin pedir nada.
      const esLaPrimera = seccion === idDeSeccion(SITE[0]?.label ?? '') && !pagina;
      anotar({
        [PARAM_PESTANA]: esLaPrimera ? null : slug(rotuloSeccion.label),
        [PARAM_PAGINA]: pagina ?? null,
      });
    };
    const alDesplazar = () => {
      if (pendiente) return;
      pendiente = true;
      window.requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar);
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
    };
  }, []);

  const cerrar = useCallback(() => setIndiceAbierto(false), []);
  const lugar = activo
    ? (() => {
        const [seccion] = activo.split('--');
        const s = SITE.find((x) => idDeSeccion(x.label) === seccion);
        const p = s?.pages.find((x) => idDePagina(s.label, x.label) === activo);
        return p && s ? `${s.label} · ${p.label}` : (s?.label ?? '');
      })()
    : (SITE[0]?.label ?? '');

  return (
    <div className="site">
      <div className="site-bar">
        <button
          type="button"
          className="site-bar-btn"
          aria-expanded={indiceAbierto}
          onClick={() => setIndiceAbierto(!indiceAbierto)}
        >
          <Icon name="capas" size={15} />
          <span>Secciones</span>
        </button>
        <span className="site-bar-here">{lugar}</span>
      </div>
      <Indice activo={activo} abierto={indiceAbierto} cerrar={cerrar} />
      {indiceAbierto ? <div className="site-scrim" onClick={cerrar} aria-hidden="true" /> : null}
      <div className="site-content">
        {SITE.map((seccion, indice) => (
          <Bloque
            key={seccion.label}
            id={idDeSeccion(seccion.label)}
            label={seccion.label}
            tipo="seccion"
            eager={indice === 0}
          >
            <SeccionContexto.Provider value={seccion.label}>
              {secciones[indice]}
            </SeccionContexto.Provider>
          </Bloque>
        ))}
      </div>
    </div>
  );
}
