'use client';

import { ForeignTradeExplorer } from './foreign-trade-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { DepartmentBoard } from '@/lib/departments-board';
import type { ForeignTradeBoard } from '@/lib/foreign-trade-board';

/**
 * «Comercio exterior», pedida al abrir su página dentro de «Empresas».
 *
 * Lee dos direcciones y no una. El total nacional por producto sale de
 * `/api/departamentos` —el mismo capítulo que abre «Bolivia por
 * departamento», y ya en la caché del navegador si esa pestaña se abrió
 * antes— porque de ahí sale `nationalProductMix`; el agregado de Comtrade
 * sale de `/api/comercio-exterior`, su propia lectura, porque es un sector
 * distinto (`EXTERNO`) y una migración distinta. Las dos pueden llegar vacías
 * si el núcleo aún no las sembró, y cada una lo dice por su lado: el panel de
 * producto no espera a Comtrade ni al revés.
 */
export function ForeignTradeSection() {
  const departments = useOnOpen<{ board: DepartmentBoard }>('/api/departamentos');
  const trade = useOnOpen<{ board: ForeignTradeBoard }>('/api/comercio-exterior');

  if (!departments.payload) {
    return <OnOpenNotice what="el comercio exterior por producto" failed={departments.failed} />;
  }

  return (
    <ForeignTradeExplorer
      departmentBoard={departments.payload.board}
      tradeBoard={trade.payload?.board ?? null}
      tradeFailed={trade.failed}
    />
  );
}
