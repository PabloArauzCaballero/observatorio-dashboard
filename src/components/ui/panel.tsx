'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { DownloadMenu } from '@/components/ui/download-menu';
import { registrarPanel } from '@/lib/export/registro';
import {
  ProveedorDePanel,
  useAlmacenDePanel,
  type DatosDeFigura,
} from '@/components/ui/panel-data';

export type DatosDePanel = DatosDeFigura;

export interface PanelProps {
  /**
   * Clave estable del panel: es el ancla del enlace, el nombre de los archivos y
   * lo que lo identifica en el informe de la pestaña. No cambia con el idioma.
   */
  id: string;
  /** La magnitud y la unidad: «Dólar paralelo (Bs por USD)». Nunca una frase evocadora. */
  title: string;
  /** Una línea con lo que dicen los datos; aquí va la frase que antes hacía de título. */
  lede?: ReactNode;
  /** El texto de la entradilla para la imagen, cuando `lede` no es una cadena. */
  ledeText?: string;
  /** Lo que se lee a la derecha del título: «804 días con ambas cotizaciones». */
  meta?: ReactNode;
  /** Quién publica las cifras. Va en el pie y dentro de cada archivo que se baja. */
  source: string;
  /** Cuándo se actualizó, «3-oct-2026». */
  updated?: string;
  /**
   * Cifras que el panel muestra y que ninguna figura declara por sí misma (una
   * tarjeta, una lista). Un objeto cuando el panel lo arma un componente de
   * servidor (una función no cruza esa frontera); una función cuando depende de
   * filtros del navegador. Los gráficos de `charts.tsx` no lo necesitan: declaran
   * sus propias cifras al panel que los envuelve.
   */
  data?: DatosDePanel | (() => DatosDePanel | undefined);
  /** Para un panel que no se baja (una cabecera, un aviso): sin menú. */
  downloadable?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * La unidad de composición del tablero: un panel con su anatomía fija.
 *
 *   título (magnitud y unidad)                         [Descargar ▾]
 *   entradilla
 *   ────────────────────────────────────────────────────────────────
 *   filtros → figura → leyenda      (los pone quien lo usa, en `children`)
 *   Fuente: … · actualizado …
 *
 * Existe para que ninguna pestaña invente su cabecera, su pie o su descarga: eran
 * tres patrones de cabecera, cinco maneras de escribir «Fuente» y un solo botón
 * de descarga cada tanto. Aquí se escriben una vez.
 */
export function Panel({
  id,
  title,
  lede,
  ledeText,
  meta,
  source,
  updated,
  data,
  downloadable = true,
  children,
  className,
}: PanelProps) {
  const raiz = useRef<HTMLElement>(null);
  const almacen = useAlmacenDePanel();

  // Un enlace a un panel (`#id`) lo lleva a la vista cuando la pestaña ya lo montó.
  useEffect(() => {
    if (location.hash === `#${id}`) raiz.current?.scrollIntoView({ block: 'start' });
  }, [id]);

  const entradilla = ledeText ?? (typeof lede === 'string' ? lede : undefined);

  /** Primero las cifras que el panel declara a mano, y detrás las de sus figuras. */
  const cifras = (): DatosDeFigura[] => {
    const propias = typeof data === 'function' ? data() : data;
    return [...(propias ? [propias] : []), ...almacen.todos()];
  };

  // El informe de la pestaña pregunta por las cifras de cada panel montado desde su elemento.
  const cifrasRef = useRef(cifras);
  cifrasRef.current = cifras;
  useEffect(() => {
    if (raiz.current) registrarPanel(raiz.current, () => cifrasRef.current());
  }, []);

  return (
    <section
      ref={raiz}
      id={id}
      data-panel-id={id}
      className={className ? `panel panel-x ${className}` : 'panel panel-x'}
      aria-labelledby={`${id}-titulo`}
    >
      <header className="panel-top">
        <div className="panel-top-text">
          <h3 id={`${id}-titulo`}>{title}</h3>
          {lede ? <p className="panel-lede">{lede}</p> : null}
        </div>
        <div className="panel-top-side" data-export="skip">
          {meta ? <span className="panel-meta">{meta}</span> : null}
          {downloadable ? (
            <DownloadMenu
              panel={raiz}
              id={id}
              titulo={title}
              entradilla={entradilla}
              fuente={source}
              datos={cifras}
            />
          ) : null}
        </div>
      </header>
      <ProveedorDePanel almacen={almacen}>
        <div className="panel-body">{children}</div>
      </ProveedorDePanel>
      <p className="panel-source">
        Fuente: {source}
        {updated ? <> · actualizado {updated}</> : null}
      </p>
    </section>
  );
}
