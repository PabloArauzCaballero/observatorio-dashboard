'use client';

import { Icon } from './icons';
import { describeVisit, report } from '@/lib/analytics';

/**
 * Las pruebas econométricas del tipo de cambio, como una oferta y no como un panel.
 *
 * Hasta el 2026-09-23 la batería se leía entera debajo de los gráficos del
 * capítulo: frases, una tabla de dieciocho pruebas, los momentos por régimen y
 * tres figuras. Es material de consulta, y en la pantalla empujaba el capítulo
 * hacia abajo para quien solo venía por el precio. Ahora se descarga como
 * informe (`/api/econometria`) y aquí queda lo justo para saber que existe y
 * qué trae.
 *
 * No lee nada, y por eso ya no va detrás de un `Suspense`: el cálculo corre
 * cuando alguien pide el documento, no cuando alguien abre la pestaña. El clic
 * registra una intención, igual que las demás descargas (`download.tsx`).
 */
export function FxEconometricsCard() {
  const announce = (): void => {
    const visit = describeVisit('DOWNLOAD_INTENT');
    if (visit) report({ ...visit, route: '/descarga/econometria' });
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Pruebas econométricas del tipo de cambio</h2>
        <p className="panel-sub">
          Raíz unitaria del paralelo y de la brecha, cointegración entre oficial y paralelo,
          causalidad de Granger, quiebre estructural, volatilidad GARCH y traspaso a precios.
        </p>
        <p className="panel-sub">
          Cada prueba con su estadístico, su valor crítico o p-valor, la ventana y la decisión, y
          las conclusiones que se derivan de ellas.
        </p>
      </div>
      <div className="download">
        <a
          className="download-btn download-btn-on"
          href="/api/econometria"
          download
          onClick={announce}
        >
          <Icon name="descarga" size={13} /> Descargar el informe (PDF)
        </a>
      </div>
    </div>
  );
}
