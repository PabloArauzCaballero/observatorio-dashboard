'use client';

import { Icon } from './icons';
import { Panel } from '@/components/ui/panel';
import { reportDownloadIntent } from '@/lib/analytics';

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
  const announce = (): void => reportDownloadIntent('econometria');

  return (
    <Panel
      id="pruebas-econometricas"
      title="Pruebas econométricas del tipo de cambio (informe en PDF)"
      lede="Raíz unitaria del paralelo y de la brecha, cointegración entre oficial y paralelo, causalidad de Granger, quiebre estructural, volatilidad GARCH y traspaso a precios."
      source="Cálculo del Observatorio sobre el oficial del Banco Central, el paralelo de los mercados P2P en bolivianos y la UFV"
      downloadable={false}
      className="fx-econ"
    >
      <p className="panel-note">
        Cada prueba con su estadístico, su valor crítico o p-valor, la ventana y la decisión, y las
        conclusiones que se derivan de ellas.
      </p>
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
    </Panel>
  );
}
