'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/icons';

export type Vista = 'grafico' | 'tabla';

/**
 * Gráfico y tabla del mismo dato, a elección de quien lee.
 *
 * Una clasificación, una serie o un desglose se entienden de un vistazo como barras o
 * líneas; una tabla obliga a leer fila por fila. Pero la cifra exacta, la fecha o la fuente
 * de cada fila sí piden la tabla. Por eso el panel enseña primero el gráfico y deja la tabla
 * a un clic, dentro del mismo panel: sigue siendo la misma figura y se baja igual (la imagen
 * es la de la vista que está abierta; los datos, los mismos en las dos).
 *
 * Se usa dentro de `Panel`, donde iría el gráfico o la tabla sola:
 *
 *   <ViewToggle chart={<ShareBars … />} table={<table className="table">…</table>} />
 *
 * Los dos lados se pasan ya armados; sólo se monta el que está abierto, así la tabla no
 * paga el dibujo de un gráfico que nadie ve ni al revés. El control reutiliza los chips de
 * `ChartKindSwitch` para que los dos selectores se vean igual.
 */
export function ViewToggle({
  chart,
  table,
  initial = 'grafico',
  label = 'Vista de los datos',
  chartLabel = 'Gráfico',
  tableLabel = 'Tabla',
}: {
  chart: ReactNode;
  table: ReactNode;
  initial?: Vista;
  label?: string;
  chartLabel?: string;
  tableLabel?: string;
}) {
  const [vista, setVista] = useState<Vista>(initial);
  const opciones: ReadonlyArray<{ id: Vista; etiqueta: string; icono: 'barras' | 'ventana' }> = [
    { id: 'grafico', etiqueta: chartLabel, icono: 'barras' },
    { id: 'tabla', etiqueta: tableLabel, icono: 'ventana' },
  ];

  return (
    <div className="view-toggle">
      <div className="chart-kind view-toggle-bar" role="group" aria-label={label}>
        {opciones.map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            className={opcion.id === vista ? 'chip chip-on' : 'chip'}
            aria-pressed={opcion.id === vista}
            onClick={() => setVista(opcion.id)}
          >
            <Icon name={opcion.icono} size={13} />
            {opcion.etiqueta}
          </button>
        ))}
      </div>
      <div className="view-toggle-body" data-vista={vista}>
        {vista === 'grafico' ? chart : table}
      </div>
    </div>
  );
}
