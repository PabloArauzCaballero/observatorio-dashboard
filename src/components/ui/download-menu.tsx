'use client';

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Icon } from '@/components/icons';
import type { DatosDeFigura, ProveedorDeImagen } from '@/components/ui/panel-data';
import { afichePng, componerAfiche, puedeComponerImagen } from '@/lib/export/afiche';
import { aCsv, nombreDeArchivo, type Dataset } from '@/lib/export/datos';
import { entregar, fechaLarga, hoyEnLaPaz, TIPO } from '@/lib/export/entrega';
import { leerTablas } from '@/lib/export/tablas';
import { aXlsx } from '@/lib/export/xlsx';

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

  useEffect(() => {
    if (!abierto) return;
    raiz.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fuera = (evento: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);

  const alTeclear = (evento: React.KeyboardEvent) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      cerrar(true);
      return;
    }
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
    const items = [...(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (items.length === 0) return;
    evento.preventDefault();
    const actual = items.indexOf(document.activeElement as HTMLElement);
    const siguiente =
      evento.key === 'ArrowDown'
        ? (actual + 1) % items.length
        : (actual - 1 + items.length) % items.length;
    items[siguiente]?.focus();
  };

  const comoDataset = (figura: DatosDeFigura): Dataset => ({
    id,
    titulo: figura.etiqueta ? `${titulo} · ${figura.etiqueta}` : titulo,
    fuente,
    columnas: figura.columnas,
    filas: figura.filas,
    unidad: figura.unidad,
    nota: figura.nota,
    hoja: figura.etiqueta,
  });

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
      {abierto ? (
        <div className="menu-list" role="menu" id={menuId} aria-label={`Descargar «${titulo}»`}>
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
        </div>
      ) : null}
    </div>
  );
}
