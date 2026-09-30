'use client';

import { DepartmentsExplorer } from './departments-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { DepartmentBoard } from '@/lib/departments-board';

/**
 * El capítulo departamental, pedido al abrirse.
 *
 * Componente de cliente y no de servidor, por la razón que da `on-open`: un
 * panel escondido se dibuja en el servidor igual que uno visible, así que
 * escrito como componente de servidor su consulta correría en cada carga de la
 * portada aunque nadie abriera «Macroeconomía».
 *
 * Vacío no es un fallo y por eso se dice aparte. El tablero se despliega desde
 * un repositorio distinto del que migra y siembra: entre un despliegue y el
 * otro estas series sencillamente no están todavía, y el lector merece saber
 * que el capítulo existe y está esperando datos en vez de encontrarse una
 * pantalla en blanco que parece rota.
 */
export function DepartmentsSection() {
  const { payload, failed } = useOnOpen<{ board: DepartmentBoard }>('/api/departamentos');

  if (!payload) return <OnOpenNotice what="el capítulo departamental" failed={failed} />;

  if (!Object.keys(payload.board.series).length) {
    return (
      <div className="callout">
        Todavía no hay cuentas departamentales cargadas. El capítulo se llena solo cuando el núcleo
        haya sembrado los cuadros del INE.
      </div>
    );
  }

  return <DepartmentsExplorer board={payload.board} />;
}
