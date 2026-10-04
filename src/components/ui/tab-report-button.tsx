'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { fechaLarga } from '@/lib/export/entrega';
import { componerInforme, imprimirDocumento } from '@/lib/export/informe';
import { nombreDeArchivo } from '@/lib/export/datos';
import { hoyEnLaPaz } from '@/lib/export/entrega';

const textoDe = (nodo: Element | null | undefined): string =>
  (nodo?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Espera a que los bloques recién montados terminen de leer, sin pasar de veinte segundos. */
async function esperarCarga(raiz: Element): Promise<void> {
  const limite = Date.now() + 20_000;
  await new Promise((resolver) => setTimeout(resolver, 400));
  while (Date.now() < limite && raiz.querySelector('.loading-note, [data-montado="no"]')) {
    await new Promise((resolver) => setTimeout(resolver, 300));
  }
}

/**
 * «Descargar informe (PDF)» de la sección.
 *
 * Recoge los paneles de todas las páginas de la sección —con los filtros que el
 * lector tiene puestos— y abre el diálogo de impresión sobre un documento que los
 * reúne. Lo que sale es lo que se ve.
 */
export function TabReportButton() {
  const boton = useRef<HTMLButtonElement>(null);
  const [estado, setEstado] = useState<string | null>(null);

  const generar = async () => {
    const pestana = boton.current?.closest<HTMLElement>('[data-site-id][data-site-kind="seccion"]');
    if (!pestana) return;
    // Las páginas que el lector todavía no alcanzó se piden ahora: el informe es de toda la sección.
    const sinMontar = [
      ...pestana.querySelectorAll<HTMLElement>('[data-site-kind="pagina"][data-montado="no"]'),
    ].map((bloque) => bloque.dataset.siteId ?? '');
    if (sinMontar.length > 0) {
      setEstado('Cargando las páginas de la sección…');
      window.dispatchEvent(new CustomEvent('observatorio:montar', { detail: sinMontar }));
      await esperarCarga(pestana);
    }
    // Los paneles de primer nivel que se ven: uno dentro de otro ya viaja con su padre.
    const paneles = [...pestana.querySelectorAll<HTMLElement>('[data-panel-id]')].filter(
      (panel) => panel.offsetParent !== null && !panel.parentElement?.closest('[data-panel-id]'),
    );
    if (paneles.length === 0) {
      setEstado('Esta pestaña aún no tiene paneles que incluir.');
      return;
    }
    const titulo = pestana.dataset.label ?? textoDe(pestana.querySelector('h2'));
    try {
      setEstado('Preparando el informe…');
      const html = await componerInforme({
        titulo: titulo || 'Informe',
        fecha: fechaLarga(),
        paneles,
        progreso: (hecho, total) =>
          setEstado(`Preparando ${Math.min(hecho + 1, total)} de ${total}…`),
      });
      imprimirDocumento(
        html,
        nombreDeArchivo(titulo || 'informe', hoyEnLaPaz(), 'pdf').replace(/\.pdf$/, ''),
      );
      setEstado(null);
    } catch (error) {
      console.error('Informe de la pestaña', error);
      setEstado('No se pudo preparar el informe.');
    }
  };

  return (
    <div className="tab-report">
      <button
        ref={boton}
        type="button"
        className="menu-btn"
        onClick={() => void generar()}
        disabled={estado?.startsWith('Preparando') ?? false}
        aria-describedby="informe-estado"
      >
        <Icon name="descargar" size={15} />
        <span>Descargar informe (PDF)</span>
      </button>
      <span id="informe-estado" className="tab-report-estado" role="status">
        {estado ?? ''}
      </span>
    </div>
  );
}
