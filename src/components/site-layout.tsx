'use client';

import {
  Children,
  Component,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import type { IconName } from '@/components/icons';
import { PARAM_PAGINA, PARAM_PESTANA, hrefDe } from '@/lib/enlace-tablero';
import { SITE, destinoDe, idDePagina, idDeSeccion } from '@/lib/site-map';

/**
 * El tablero con un índice fijo a un lado y una sola cosa a la vez en pantalla.
 *
 * Primero fueron ocho pestañas con otra fila de páginas debajo; después, una página larga que
 * bajaba sin fin. Esto es lo que quedó: el índice lateral lista las secciones y, de la sección
 * abierta, sus páginas; elegir una muestra **solo esa**, desde arriba. Nada se apila: lo que no
 * se está leyendo no se dibuja ni pide sus datos.
 *
 * El lugar vive en la dirección (`/?pestana=macroeconomia&pagina=variables-exogenas`), de modo que
 * un enlace copiado, una respuesta del asistente o el botón «atrás» llevan al mismo sitio. Se lee
 * con `useSearchParams` —el servidor ya sabe cuál es— y se cambia con `history.pushState`, que
 * Next sincroniza sin pedir la página otra vez al servidor.
 */

interface Lugar {
  /** El rótulo de la sección abierta. */
  seccion: string;
  /** El rótulo de la página abierta; ninguno si la sección es de una sola pieza. */
  pagina: string | null;
}

const LugarContexto = createContext<Lugar>({ seccion: SITE[0]?.label ?? '', pagina: null });

/** El lugar que nombra la dirección; si no nombra ninguno válido, el primero. */
function lugarDe(pestana: string | null, pagina: string | null): Lugar {
  const destino = destinoDe(pestana, pagina);
  const seccion = SITE.find((s) => s.label === (destino?.seccion ?? SITE[0]?.label));
  if (!seccion) return { seccion: SITE[0]?.label ?? '', pagina: null };
  const abierta = destino?.pagina ?? seccion.pages[0]?.label ?? null;
  return { seccion: seccion.label, pagina: abierta };
}

function irA(seccion: string, pagina: string | null): void {
  window.history.pushState(null, '', hrefDe({ pestana: seccion, pagina: pagina ?? undefined }));
}

/**
 * Lo que un bloque no pueda dibujar se queda en el bloque.
 *
 * Cada sección se pide en su propio trozo de JavaScript. Si ese trozo no llega —un 502 pasajero
 * del servidor al desplegar, una conexión que se corta— la excepción subía hasta la raíz y se
 * llevaba la página entera (`Application error`). Ahora cae aquí: el índice sigue y el bloque
 * ofrece recargar.
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

/**
 * Las páginas de una sección: se dibuja solo la abierta.
 *
 * Sustituye a `SubTabs` donde la barra de páginas era el primer nivel de la sección. La
 * elección está en el índice lateral, no aquí: este componente solo sabe cuál toca.
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
  const { seccion, pagina } = useContext(LugarContexto);
  const hallada = pagina ? labels.indexOf(pagina) : -1;
  const indice = hallada >= 0 ? hallada : 0;
  const label = labels[indice] ?? '';
  return (
    <div className="sub-sections">
      <section
        id={idDePagina(seccion, label)}
        className="site-block site-block-pagina"
        data-site-id={idDePagina(seccion, label)}
        data-site-kind="pagina"
        data-label={label}
        data-montado="si"
        aria-label={label}
      >
        <BloqueSeguro label={label}>
          <h3 className="sub-title">
            <Icon name={icons[indice] ?? 'cajas'} size={16} />
            {label}
          </h3>
          <div className="stack">{children[indice]}</div>
        </BloqueSeguro>
      </section>
    </div>
  );
}

function Indice({
  lugar,
  abierto,
  cerrar,
}: {
  lugar: Lugar;
  abierto: boolean;
  cerrar: () => void;
}) {
  const ir = (evento: React.MouseEvent, seccion: string, pagina: string | null) => {
    // Ctrl/⌘/Mayús+clic y clic central abren el enlace en otra ventana, como cualquier <a>.
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
    evento.preventDefault();
    cerrar();
    irA(seccion, pagina);
  };

  return (
    <nav
      className={abierto ? 'site-index site-index-open' : 'site-index'}
      aria-label="Secciones del informe"
    >
      <ul>
        {SITE.map((seccion) => {
          const esActiva = lugar.seccion === seccion.label;
          const primera = seccion.pages[0]?.label ?? null;
          return (
            <li key={seccion.label}>
              <a
                href={hrefDe({ pestana: seccion.label })}
                className={esActiva ? 'site-link site-link-on' : 'site-link'}
                aria-current={esActiva && seccion.pages.length === 0 ? 'page' : undefined}
                onClick={(evento) => ir(evento, seccion.label, primera)}
              >
                <Icon name={seccion.icon} size={15} />
                {seccion.label}
              </a>
              {esActiva && seccion.pages.length > 0 ? (
                <ul className="site-pages">
                  {seccion.pages.map((pagina) => (
                    <li key={pagina.label}>
                      <a
                        href={hrefDe({ pestana: seccion.label, pagina: pagina.label })}
                        className={
                          lugar.pagina === pagina.label ? 'site-page site-page-on' : 'site-page'
                        }
                        aria-current={lugar.pagina === pagina.label ? 'page' : undefined}
                        onClick={(evento) => ir(evento, seccion.label, pagina.label)}
                      >
                        {pagina.label}
                      </a>
                    </li>
                  ))}
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
 * La página: el índice a un lado y, a su lado, la sección abierta.
 *
 * `children` trae un elemento por sección, en el orden de `SITE`; aquí se dibuja solo el de la
 * sección abierta (las demás no se montan: no leen ni pintan nada).
 */
export function SiteLayout({ children }: { children: ReactNode[] }) {
  const parametros = useSearchParams();
  const lugar = lugarDe(parametros.get(PARAM_PESTANA), parametros.get(PARAM_PAGINA));
  const [indiceAbierto, setIndiceAbierto] = useState(false);
  const secciones = Children.toArray(children);
  const indice = Math.max(
    0,
    SITE.findIndex((s) => s.label === lugar.seccion),
  );
  const seccion = SITE[indice];

  // Al cambiar de lugar se vuelve arriba (o al panel que nombra `#…`); al llegar, no se toca.
  const clave = `${lugar.seccion}|${lugar.pagina ?? ''}`;
  const anterior = useRef(clave);
  useEffect(() => {
    if (anterior.current === clave) return;
    anterior.current = clave;
    const ancla = window.location.hash.length > 1 ? window.location.hash.slice(1) : '';
    const objetivo = ancla ? document.getElementById(decodeURIComponent(ancla)) : null;
    if (objetivo) objetivo.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
  }, [clave]);

  const donde = lugar.pagina ? `${lugar.seccion} · ${lugar.pagina}` : lugar.seccion;

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
        <span className="site-bar-here">{donde}</span>
      </div>
      <Indice lugar={lugar} abierto={indiceAbierto} cerrar={() => setIndiceAbierto(false)} />
      {indiceAbierto ? (
        <div className="site-scrim" onClick={() => setIndiceAbierto(false)} aria-hidden="true" />
      ) : null}
      <div className="site-content">
        {seccion ? (
          <section
            key={seccion.label}
            id={idDeSeccion(seccion.label)}
            className="site-block site-block-seccion"
            data-site-id={idDeSeccion(seccion.label)}
            data-site-kind="seccion"
            data-label={seccion.label}
            data-montado="si"
            aria-label={seccion.label}
          >
            <BloqueSeguro label={seccion.label}>
              <LugarContexto.Provider value={lugar}>{secciones[indice]}</LugarContexto.Provider>
            </BloqueSeguro>
          </section>
        ) : null}
      </div>
    </div>
  );
}
