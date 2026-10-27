'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons';
import type { DatosDeFigura, ProveedorDeImagen } from '@/components/ui/panel-data';
import { afichePng, componerAfiche, puedeComponerImagen } from '@/lib/export/afiche';
import { aCsv, nombreDeArchivo, type Dataset } from '@/lib/export/datos';
import { entregar, fechaLarga, hoyEnLaPaz, TIPO } from '@/lib/export/entrega';
import { leerTablas } from '@/lib/export/tablas';
import { aXlsx } from '@/lib/export/xlsx';
import { cutOrder, freeCut, freeCutNote } from '@/lib/plans';

/** Lo que un panel pone a disposición de quien baja sus datos. */
export type DatosDePanel = DatosDeFigura;

interface Props {
  panel: RefObject<HTMLElement | null>;
  id: string;
  titulo: string;
  entradilla?: string | undefined;
  fuente: string;
  /** Las cifras que el panel muestra, con los filtros puestos. Se piden al abrir el menú. */
  datos?: (() => DatosDeFigura[]) | undefined;
  /** La imagen que una figura sabe componer por su cuenta, si alguna (un mapa con teselas). */
  imagenPropia?: (() => ProveedorDeImagen | undefined) | undefined;
  /** Descargas que ya existen en otro sitio (el archivo completo del servidor, por ejemplo). */
  extra?: ReadonlyArray<{ etiqueta: string; nota?: string; href: string }> | undefined;
}

type Accion = { tipo: 'png' | 'svg' | 'xlsx' | 'enlace' } | { tipo: 'csv'; indice: number };

const clave = (accion: Accion): string =>
  accion.tipo === 'csv' ? `csv-${accion.indice}` : accion.tipo;

/** Aire entre la lista y el borde de la pantalla, y entre la lista y el botón (px). */
const MARGEN = 8;
const SEPARACION = 6;

/**
 * Dónde va la lista, en coordenadas de pantalla. Prefiere caer bajo el botón y alineada a su
 * borde derecho; si por la izquierda no cabe (el botón quedó a la izquierda en un móvil), se
 * alinea a su borde izquierdo, y en todo caso se encierra dentro de la pantalla. Si abajo no
 * cabe y arriba hay más sitio, se abre hacia arriba. Exportada para probarla sin navegador.
 */
export function colocarLista(
  boton: { top: number; bottom: number; left: number; right: number },
  lista: { ancho: number; alto: number },
  pantalla: { ancho: number; alto: number },
): { top: number; left: number; maxHeight: number } {
  let left = boton.right - lista.ancho;
  if (left < MARGEN) left = boton.left;
  left = Math.max(MARGEN, Math.min(left, pantalla.ancho - lista.ancho - MARGEN));
  const abajo = pantalla.alto - boton.bottom - SEPARACION - MARGEN;
  const arriba = boton.top - SEPARACION - MARGEN;
  if (lista.alto > abajo && arriba > abajo) {
    const alto = Math.min(lista.alto, arriba);
    return { top: boton.top - SEPARACION - alto, left, maxHeight: arriba };
  }
  return { top: boton.bottom + SEPARACION, left, maxHeight: Math.max(abajo, 160) };
}

/**
 * «Descargar» de un panel: imagen, datos y enlace.
 *
 * La imagen sale de lo que hay dibujado y los datos de lo que las figuras del
 * panel declaran (o, si no declararon nada, de la tabla que se ve), así que una
 * y otros cuentan lo mismo. Cada opción aparece solo si se puede cumplir: un panel
 * sin gráfico no ofrece imagen, y uno sin cifras no ofrece datos.
 */
export function DownloadMenu({
  panel,
  id,
  titulo,
  entradilla,
  fuente,
  datos,
  imagenPropia,
  extra,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conImagen, setConImagen] = useState(false);
  const [conImagenPropia, setConImagenPropia] = useState(false);
  const [conjuntos, setConjuntos] = useState<DatosDeFigura[]>([]);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = useState<CSSProperties | null>(null);
  const menuId = useId();

  const cerrar = useCallback((devolverFoco: boolean) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }, []);

  /** Lo que el panel declaró; si nada, la tabla que se ve. */
  const reunir = (): DatosDeFigura[] => {
    const declarados = (datos?.() ?? []).filter((d) => d.filas.length > 0);
    if (declarados.length > 0 || !panel.current) return declarados;
    return leerTablas(panel.current).filter((t) => t.filas.length > 0);
  };

  // Lo que se ofrece se mira al abrir, no al montar: el gráfico puede dibujarse después.
  const alternar = () => {
    if (!abierto) {
      const propia = Boolean(imagenPropia?.());
      setConImagenPropia(propia);
      setConImagen(propia || (panel.current ? puedeComponerImagen(panel.current) : false));
      setConjuntos(reunir());
      setAviso(null);
    }
    setAbierto(!abierto);
  };

  // La lista se dibuja en el <body> (ningún `overflow` de la página la recorta) y se coloca
  // contra el botón: dentro de la pantalla siempre, y de nuevo al desplazar o redimensionar.
  const colocar = useCallback(() => {
    const b = boton.current?.getBoundingClientRect();
    const l = lista.current;
    if (!b || !l) return;
    const { top, left, maxHeight } = colocarLista(
      b,
      { ancho: l.offsetWidth, alto: l.scrollHeight },
      { ancho: document.documentElement.clientWidth, alto: window.innerHeight },
    );
    setLugar({ top, left, maxHeight });
  }, []);

  // El foco va a la primera opción cuando la lista ya está colocada (oculta no lo acepta).
  useEffect(() => {
    if (!abierto || !lugar || lista.current?.contains(document.activeElement)) return;
    lista.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [abierto, lugar]);

  useLayoutEffect(() => {
    if (!abierto) {
      setLugar(null);
      return;
    }
    colocar();
  }, [abierto, colocar, conjuntos, aviso]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (evento: PointerEvent) => {
      const objetivo = evento.target as Node;
      if (raiz.current?.contains(objetivo) || lista.current?.contains(objetivo)) return;
      setAbierto(false);
    };
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('scroll', colocar, true);
    window.addEventListener('resize', colocar);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      window.removeEventListener('scroll', colocar, true);
      window.removeEventListener('resize', colocar);
    };
  }, [abierto, colocar]);

  const alTeclear = (evento: React.KeyboardEvent) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      cerrar(true);
      return;
    }
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
    const items = [...(lista.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (items.length === 0) return;
    evento.preventDefault();
    const actual = items.indexOf(document.activeElement as HTMLElement);
    const siguiente =
      evento.key === 'ArrowDown'
        ? (actual + 1) % items.length
        : (actual - 1 + items.length) % items.length;
    items[siguiente]?.focus();
  };

  /*
   * Sin un plan, quinientas filas por figura. El aviso viaja en la columna de
   * la fuente del CSV y en la nota del Excel: el archivo se explica solo.
   */
  const comoDataset = (figura: DatosDeFigura): Dataset => {
    const corte = freeCut(figura.filas, cutOrder(figura.filas));
    const aviso = corte.recortado ? freeCutNote(corte.total) : null;
    return {
      id,
      titulo: figura.etiqueta ? `${titulo} · ${figura.etiqueta}` : titulo,
      fuente: aviso ? `${fuente}. ${aviso}` : fuente,
      columnas: figura.columnas,
      filas: corte.filas,
      unidad: figura.unidad,
      nota: aviso ? [aviso, figura.nota].filter(Boolean).join(' ') : figura.nota,
      hoja: figura.etiqueta,
    };
  };

  const ejecutar = async (accion: Accion) => {
    const hoy = hoyEnLaPaz();
    setAviso(null);
    try {
      if (accion.tipo === 'enlace') {
        const direccion = `${location.origin}${location.pathname}${location.search}#${id}`;
        await navigator.clipboard.writeText(direccion);
        setAviso('Enlace copiado');
        return;
      }
      setOcupado(clave(accion));
      if (accion.tipo === 'png' && imagenPropia?.()) {
        // La figura compone su propia imagen (un mapa con teselas): el afiche no podría.
        const blob = await imagenPropia()?.();
        if (!blob) throw new Error('La figura no devolvió imagen.');
        entregar(blob, nombreDeArchivo(id, hoy, 'png'), 'panel-png');
      } else if (accion.tipo === 'png' || accion.tipo === 'svg') {
        const host = panel.current;
        if (!host) return;
        const afiche = await componerAfiche({
          panel: host,
          titulo,
          entradilla,
          fuente,
          fecha: fechaLarga(),
        });
        if (accion.tipo === 'svg') {
          entregar(
            new Blob([afiche.svg], { type: TIPO.svg }),
            nombreDeArchivo(id, hoy, 'svg'),
            'panel-svg',
          );
        } else {
          entregar(await afichePng(afiche), nombreDeArchivo(id, hoy, 'png'), 'panel-png');
        }
      } else if (accion.tipo === 'csv') {
        const figura = conjuntos[accion.indice];
        if (!figura) return;
        const nombre = figura.etiqueta ? `${id}-${figura.etiqueta}` : id;
        entregar(
          new Blob([aCsv(comoDataset(figura), hoy)], { type: TIPO.csv }),
          nombreDeArchivo(nombre, hoy, 'csv'),
          'panel-csv',
        );
      } else {
        const bytes = aXlsx(conjuntos.map(comoDataset), { consultado: hoy });
        entregar(
          new Blob([bytes as BlobPart], { type: TIPO.xlsx }),
          nombreDeArchivo(id, hoy, 'xlsx'),
          'panel-xlsx',
        );
      }
      cerrar(true);
    } catch (error) {
      console.error('Descarga del panel', id, error);
      setAviso(
        accion.tipo === 'png' || accion.tipo === 'svg'
          ? 'No se pudo preparar la imagen. Los datos sí se pueden bajar.'
          : accion.tipo === 'enlace'
            ? 'No se pudo copiar el enlace.'
            : 'No se pudieron preparar los datos.',
      );
    } finally {
      setOcupado(null);
    }
  };

  const item = (accion: Accion, etiqueta: string, nota: string) => (
    <button
      key={clave(accion)}
      type="button"
      role="menuitem"
      className="menu-item"
      disabled={ocupado !== null}
      onClick={() => void ejecutar(accion)}
    >
      <span>{ocupado === clave(accion) ? 'Preparando…' : etiqueta}</span>
      <span className="menu-item-note">{nota}</span>
    </button>
  );

  const varias = conjuntos.length > 1;

  return (
    <div className="menu" ref={raiz} onKeyDown={alTeclear}>
      <button
        ref={boton}
        type="button"
        className="menu-btn"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? menuId : undefined}
        aria-label={`Descargar «${titulo}»`}
        onClick={alternar}
      >
        <Icon name="descargar" size={15} />
        <span>Descargar</span>
        <Icon name="desplegar" size={14} />
      </button>
      {abierto && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={lista}
              className="menu-list menu-list-flotante"
              role="menu"
              id={menuId}
              aria-label={`Descargar «${titulo}»`}
              style={lugar ?? { visibility: 'hidden' }}
            >
              {conImagen ? (
                <>
                  {item({ tipo: 'png' }, 'Imagen', 'PNG')}
                  {conImagenPropia ? null : item({ tipo: 'svg' }, 'Imagen vectorial', 'SVG')}
                </>
              ) : null}
              {conjuntos.length > 0 ? (
                <>
                  {item(
                    { tipo: 'xlsx' },
                    varias ? `Datos para Excel (${conjuntos.length} hojas)` : 'Datos para Excel',
                    'XLSX',
                  )}
                  {varias
                    ? conjuntos.map((figura, indice) =>
                        item(
                          { tipo: 'csv', indice },
                          `Datos · ${figura.etiqueta ?? `figura ${indice + 1}`}`,
                          'CSV',
                        ),
                      )
                    : item({ tipo: 'csv', indice: 0 }, 'Datos', 'CSV')}
                </>
              ) : null}
              {(extra ?? []).map((descarga) => (
                <a
                  key={descarga.href}
                  role="menuitem"
                  className="menu-item"
                  href={descarga.href}
                  download
                  onClick={() => cerrar(false)}
                >
                  <span>{descarga.etiqueta}</span>
                  <span className="menu-item-note">{descarga.nota ?? ''}</span>
                </a>
              ))}
              {item({ tipo: 'enlace' }, 'Copiar enlace al panel', '')}
              <p className="menu-aviso" role="status">
                {aviso ?? ''}
              </p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
