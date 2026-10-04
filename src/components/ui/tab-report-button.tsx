'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { fechaLarga } from '@/lib/export/entrega';
import { componerInforme, imprimirDocumento } from '@/lib/export/informe';
import { nombreDeArchivo } from '@/lib/export/datos';
import { hoyEnLaPaz } from '@/lib/export/entrega';

const textoDe = (nodo: Element | null | undefined): string =>
  (nodo?.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * «Descargar informe (PDF)» de lo que está abierto.
 *
 * Recoge los paneles de la sección y página que se están leyendo —con los filtros que el
 * lector tiene puestos— y abre el diálogo de impresión sobre un documento que los
 * reúne. Lo que sale es lo que se ve.
 */
export function TabReportButton() {
  const boton = useRef<HTMLButtonElement>(null);
  const [estado, setEstado] = useState<string | null>(null);

  const generar = async () => {
    const pestana = boton.current?.closest<HTMLElement>('[data-site-id][data-site-kind="seccion"]');
    if (!pestana) return;
    // Los paneles de primer nivel que se ven: uno dentro de otro ya viaja con su padre.
    const paneles = [...pestana.querySelectorAll<HTMLElement>('[data-panel-id]')].filter(
      (panel) => panel.offsetParent !== null && !panel.parentElement?.closest('[data-panel-id]'),
    );
    if (paneles.length === 0) {
      setEstado('Esta pestaña aún no tiene paneles que incluir.');
      return;
    }
    const pagina = textoDe(pestana.querySelector('[data-site-kind="pagina"] .sub-title'));
    const nombre = pestana.dataset.label ?? textoDe(pestana.querySelector('h2'));
    const titulo = [nombre, pagina].filter(Boolean).join(' · ');
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
