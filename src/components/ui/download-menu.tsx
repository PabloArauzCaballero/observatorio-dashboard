'use client';

import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Icon } from '@/components/icons';
import { afichePng, componerAfiche, puedeComponerImagen } from '@/lib/export/afiche';
import { aCsv, nombreDeArchivo, type Dataset } from '@/lib/export/datos';
import { entregar, fechaLarga, hoyEnLaPaz, TIPO } from '@/lib/export/entrega';
import { aXlsx } from '@/lib/export/xlsx';

/** Lo que un panel pone a disposición de quien baja sus datos. */
export type DatosDePanel = Pick<Dataset, 'columnas' | 'filas' | 'unidad' | 'nota'>;

interface Props {
  panel: RefObject<HTMLElement | null>;
  id: string;
  titulo: string;
  entradilla?: string | undefined;
  fuente: string;
  /** Las cifras que el panel muestra, con los filtros puestos. Se piden al bajarlas. */
  datos?: (() => DatosDePanel | undefined) | undefined;
}

type Accion = 'png' | 'svg' | 'csv' | 'xlsx' | 'enlace';

/**
 * «Descargar» de un panel: imagen, datos y enlace.
 *
 * La imagen sale de lo que hay dibujado y los datos de lo que el panel declara,
 * así que una y otros cuentan lo mismo. Cada opción aparece solo si se puede
 * cumplir: un panel sin gráfico no ofrece imagen, y uno sin tabla no ofrece datos.
 */
export function DownloadMenu({ panel, id, titulo, entradilla, fuente, datos }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<Accion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conImagen, setConImagen] = useState(false);
  const [conDatos, setConDatos] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const cerrar = useCallback((devolverFoco: boolean) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }, []);

  // Lo que se ofrece se mira al abrir, no al montar: el gráfico puede dibujarse después.
  const alternar = () => {
    if (!abierto) {
      setConImagen(panel.current ? puedeComponerImagen(panel.current) : false);
      setConDatos(Boolean(datos?.()));
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

  const ejecutar = async (accion: Accion) => {
    const hoy = hoyEnLaPaz();
    setAviso(null);
    try {
      if (accion === 'enlace') {
        const direccion = `${location.origin}${location.pathname}${location.search}#${id}`;
        await navigator.clipboard.writeText(direccion);
        setAviso('Enlace copiado');
        return;
      }
      setOcupado(accion);
      if (accion === 'png' || accion === 'svg') {
        const host = panel.current;
        if (!host) return;
        const afiche = await componerAfiche({
          panel: host,
          titulo,
          entradilla,
          fuente,
          fecha: fechaLarga(),
        });
        if (accion === 'svg') {
          entregar(
            new Blob([afiche.svg], { type: TIPO.svg }),
            nombreDeArchivo(id, hoy, 'svg'),
            'panel-svg',
          );
        } else {
          entregar(await afichePng(afiche), nombreDeArchivo(id, hoy, 'png'), 'panel-png');
        }
      } else {
        const filas = datos?.();
        if (!filas) return;
        const dataset: Dataset = { id, titulo, fuente, ...filas };
        if (accion === 'csv') {
          entregar(
            new Blob([aCsv(dataset, hoy)], { type: TIPO.csv }),
            nombreDeArchivo(id, hoy, 'csv'),
            'panel-csv',
          );
        } else {
          const bytes = aXlsx(dataset, { consultado: hoy });
          entregar(
            new Blob([bytes as BlobPart], { type: TIPO.xlsx }),
            nombreDeArchivo(id, hoy, 'xlsx'),
            'panel-xlsx',
          );
        }
      }
      cerrar(true);
    } catch (error) {
      console.error('Descarga del panel', id, error);
      setAviso(
        accion === 'png' || accion === 'svg'
          ? 'No se pudo preparar la imagen. Los datos sí se pueden bajar.'
          : accion === 'enlace'
            ? 'No se pudo copiar el enlace.'
            : 'No se pudieron preparar los datos.',
      );
    } finally {
      setOcupado(null);
    }
  };

  const item = (accion: Accion, etiqueta: string, nota: string) => (
    <button
      type="button"
      role="menuitem"
      className="menu-item"
      disabled={ocupado !== null}
      onClick={() => void ejecutar(accion)}
    >
      <span>{ocupado === accion ? 'Preparando…' : etiqueta}</span>
      <span className="menu-item-note">{nota}</span>
    </button>
  );

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
              {item('png', 'Imagen', 'PNG')}
              {item('svg', 'Imagen vectorial', 'SVG')}
            </>
          ) : null}
          {conDatos ? (
            <>
              {item('csv', 'Datos', 'CSV')}
              {item('xlsx', 'Datos para Excel', 'XLSX')}
            </>
          ) : null}
          {item('enlace', 'Copiar enlace al panel', '')}
          <p className="menu-aviso" role="status">
            {aviso ?? ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
