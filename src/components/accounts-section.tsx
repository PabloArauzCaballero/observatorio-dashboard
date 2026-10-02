'use client';

import { AccountsBudget } from './accounts-budget';
import { AccountsDebt } from './accounts-debt';
import { AccountsNorms } from './accounts-norms';
import { AccountsPanorama } from './accounts-panorama';
import { AccountsRevenue } from './accounts-revenue';
import { OnOpenNotice, useOnOpen } from './on-open';
import { SubTabs } from './tabs';
import type { AccountsPayload } from '@/lib/public-accounts-board';

/**
 * Las cuentas públicas: el tamaño del Estado, lo que cobra y lo que gasta, y qué dicen las
 * normas.
 *
 * Cinco páginas, como un informe y no como un solo scroll: el panorama (cuánto entra y cuánto
 * sale), qué dicen las normas (cada impuesto con su alícuota y una calculadora de cuánto de
 * un precio es impuesto), la recaudación (frente a los vecinos y por impuesto), las cuentas
 * concepto por concepto, y la deuda con el costo de los combustibles. «Qué dicen las normas»
 * no necesita datos de la base y se muestra aunque las demás páginas esperen.
 *
 * Se pide al abrirse, como el resto de los rubros del capítulo de Macroeconomía: son
 * cientos de series y la mayoría de las visitas no pasa por aquí.
 */
export function AccountsSection() {
  const { payload, failed } = useOnOpen<{ accounts: AccountsPayload }>('/api/cuentas-publicas');
  const accounts = payload?.accounts ?? null;

  return (
    <SubTabs
      labels={['Panorama', 'Qué dicen las normas', 'Recaudación', 'Ingresos y gastos', 'Deuda y combustibles']}
      icons={['balanza', 'escudo', 'monedas', 'barras', 'banco']}
    >
      <Loaded accounts={accounts} failed={failed}>
        {(data) => <AccountsPanorama accounts={data} />}
      </Loaded>
      <AccountsNorms />
      <Loaded accounts={accounts} failed={failed}>
        {(data) => <AccountsRevenue accounts={data} />}
      </Loaded>
      <Loaded accounts={accounts} failed={failed}>
        {(data) => <AccountsBudget accounts={data} />}
      </Loaded>
      <Loaded accounts={accounts} failed={failed}>
        {(data) => <AccountsDebt accounts={data} />}
      </Loaded>
    </SubTabs>
  );
}

function Loaded({
  accounts,
  failed,
  children,
}: {
  accounts: AccountsPayload | null;
  failed: boolean;
  children: (accounts: AccountsPayload) => React.ReactNode;
}) {
  if (!accounts) return <OnOpenNotice what="las cuentas públicas" failed={failed} />;
  if (accounts.series.length === 0) {
    return (
      <div className="callout">
        Todavía no hay cuentas públicas cargadas en esta base. El núcleo las siembra al arrancar:
        recaudación por impuesto, ingresos y gastos del Estado, deuda y subvenciones. «Qué dicen
        las normas» no depende de ellas.
      </div>
    );
  }
  return <>{children(accounts)}</>;
}
