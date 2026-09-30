import type { ReactNode } from 'react';
import { instant } from '@/components/admin/format';

/**
 * Título, bajada y, debajo, cuándo se observó lo que hay en pantalla.
 *
 * Es el único sitio donde se escribe la cabecera de una página: antes cada
 * pantalla armaba la suya y ninguna decía lo mismo con las mismas palabras. El
 * identificador de la petición queda en la última línea, en gris y en mono,
 * porque sirve para buscar el registro del servidor y no para leerlo.
 */
export function PageHeader({
  title,
  lead,
  observedAt,
  requestId,
  actions,
}: {
  title: string;
  lead?: ReactNode;
  observedAt?: string | null;
  requestId?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-head">
      <div>
        <h1>{title}</h1>
        {lead ? <p>{lead}</p> : null}
        {observedAt !== undefined || requestId ? (
          <ul className="admin-head-meta">
            {observedAt !== undefined ? <li>Observado: {instant(observedAt)}</li> : null}
            {requestId ? <li className="admin-mono">{requestId}</li> : null}
          </ul>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
