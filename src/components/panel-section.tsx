'use client';

import { useEffect, useState } from 'react';
import { MacroExplorer } from './macro-explorer';
import type { MacroBundle } from '@/lib/macro-transport';

/**
 * El catálogo del Banco Mundial, traído cuando se abre su pestaña.
 *
 * Son treinta mil lecturas de mil quinientas series. Puestas en la portada
 * serían más peso que todo el resto del informe junto, para un capítulo al que
 * se entra a buscar una cifra concreta —no es una lectura de corrido, es un
 * índice—. Así que la portada no las lleva: se piden a `/api/panel` en el
 * momento en que alguien elige esta subpestaña, y no antes.
 *
 * Lo que llega es el mismo paquete que el panel macro recibe ya armado desde el
 * servidor, y lo dibuja el mismo explorador. Dos corpus, un solo instrumento:
 * los filtros, la paginación, la tabla y la descarga se comportan igual en los
 * dos, que es lo que permite compararlos sin volver a aprender la herramienta.
 */
export function PanelSection() {
  const [bundle, setBundle] = useState<MacroBundle | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/panel')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('sin catálogo'))))
      .then((payload: { bundle?: MacroBundle }) => {
        if (!alive) return;
        if (payload.bundle) setBundle(payload.bundle);
        else setFailed(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="callout">
        No se pudo leer el catálogo del Banco Mundial. El resto del capítulo sigue al día.
      </div>
    );
  }

  // Un aviso y no una retícula vacía: mil quinientas series tardan lo suyo en
  // llegar, y una pantalla en blanco durante ese rato se lee como un fallo.
  if (!bundle) return <div className="callout">Cargando el catálogo del Banco Mundial…</div>;

  return <MacroExplorer bundle={bundle} corpus="catalogo" />;
}
