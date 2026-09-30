import type { ReactNode } from 'react';
import type { CoreResult } from '@/lib/admin/core-client';
import { Icon } from '@/components/icons';

/**
 * Las tres cosas que una sección puede ser cuando no tiene filas, dichas
 * distinto: vacía (la consulta corrió y no trajo nada), rechazada (alguien dijo
 * que no) y caída (el núcleo no contestó). Una tabla sin filas y una tabla que
 * no cargó se ven igual si nada dice cuál es, y quien no puede distinguirlas
 * supone la más amable.
 */
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-note" role="status">
      <Icon name="info" size={22} />
      <strong>{title}</strong>
      <span>{detail}</span>
      {action}
    </div>
  );
}

export function ErrorState({ problem }: { problem: Extract<CoreResult<unknown>, { ok: false }> }) {
  const title =
    problem.status === 403
      ? 'No tiene permiso para ver esto'
      : problem.status === 401
        ? 'La sesión ya no es válida'
        : problem.status === 503
          ? 'El núcleo no respondió'
          : 'No se pudo leer';
  return (
    <div className="admin-note" role="alert">
      <Icon name="campana" size={22} />
      <strong>{title}</strong>
      <span>{problem.message}</span>
      <span className="admin-mono">{problem.code}</span>
    </div>
  );
}
