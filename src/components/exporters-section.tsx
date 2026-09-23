'use client';

import { ExportersExplorer } from './exporters-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import { ReputationExplorer } from './reputation-explorer';
import type { ExportersBoard } from '@/lib/exporters-board';

/**
 * Las dos páginas que nacen del mismo registro: exportadoras y reputación.
 *
 * Eran una sola —«Exportadoras y reputación»— y se partieron porque son dos
 * medidas que no se explican entre sí: el orden exportador sale de registros
 * aduaneros y la reputación de encuestas de percepción. Un lector que las
 * viera en el mismo scroll supondría que el puesto de una dice algo del puesto
 * de la otra. Dos pestañas dicen que son dos corpus, igual que la bolsa está
 * aparte de las dos.
 *
 * Están en un archivo y no en dos porque **comparten la lectura**. El núcleo
 * las sirve juntas en `/api/exportadoras` —el cruce entre ambas se calcula ahí
 * y necesita las dos mitades—, y no vale la pena abrir dos rutas para
 * repartirlas: cada página pide la misma dirección al montarse, y como el
 * cuerpo viaja con `Cache-Control: private, max-age=600`, pasar de una pestaña
 * a la otra lo saca de la caché del navegador sin volver al servidor. `SubTabs`
 * monta únicamente la página activa, así que abrir «Empresas» sigue sin pedir
 * nada de esto.
 *
 * Vacío no es un fallo. El tablero se despliega desde un repositorio distinto
 * del que migra y siembra: entre un despliegue y el otro estas series no están
 * todavía, y el lector merece saber que la página espera datos en vez de
 * encontrarse una pantalla en blanco que parece rota. Cada página avisa de lo
 * suyo: la de exportadoras no tiene por qué callar porque falte Merco, ni al
 * revés.
 */

const ROUTE = '/api/exportadoras';

/** El ránking de exportadoras, pedido al abrir su página. */
export function ExportersSection() {
  const { payload, failed } = useOnOpen<{ board: ExportersBoard }>(ROUTE);

  if (!payload) return <OnOpenNotice what="el registro de exportadoras" failed={failed} />;

  if (!payload.board.exporters.length) {
    return (
      <div className="callout">
        Todavía no hay registro de exportadoras cargado. La página se llena sola cuando el núcleo
        haya sembrado el ránking.
      </div>
    );
  }

  return <ExportersExplorer board={payload.board} />;
}

/** El monitor de reputación, pedido al abrir su página. */
export function ReputationSection() {
  const { payload, failed } = useOnOpen<{ board: ExportersBoard }>(ROUTE);

  if (!payload) return <OnOpenNotice what="el monitor de reputación empresarial" failed={failed} />;

  if (!payload.board.general.length && !payload.board.sectors.length) {
    return (
      <div className="callout">
        Todavía no hay monitor de reputación cargado. La página se llena sola cuando el núcleo haya
        sembrado las ediciones de Merco.
      </div>
    );
  }

  return <ReputationExplorer board={payload.board} />;
}
