import type { MacroPoint } from './series';

/**
 * The macro panel, packed for the wire.
 *
 * The annual panel is 59.071 lecturas de 1.620 indicadores, y un `MacroPoint`
 * lleva seis campos que no cambian dentro de un indicador: su codigo, su
 * nombre, su sector, su unidad, quien lo publica y de donde sale. Mandarlos
 * fila a fila los repite 59.071 veces —el nombre de un indicador del Banco
 * Mundial pasa de los cien caracteres— y esa repeticion era ella sola 33 de los
 * 35 MB que pesaba la portada.
 *
 * Aqui van una vez, en un catalogo, y cada lectura guarda el indice de su
 * indicador. Lo que viaja despues son cinco valores sueltos por fila y ningun
 * nombre de campo, porque una tupla no serializa sus claves.
 *
 * El lector no pierde ni una fila: el catalogo y las lecturas se vuelven a unir
 * en el navegador, y `MacroExplorer` recibe exactamente los mismos
 * `MacroPoint[]` que recibia antes.
 */

/** Lo que no cambia dentro de un indicador, dicho una vez. */
export interface MacroIndicator {
  code: string;
  name: string | null;
  sector: string;
  unit: string;
  publisher: string | null;
  sourceUrl: string | null;
}

/**
 * Una lectura: indicador, periodo, valor, valor anterior y variacion.
 *
 * Tupla y no objeto a proposito. Es la unica forma de que las claves no viajen
 * una vez por fila, que es justo lo que hacia grande a la portada.
 */
export type MacroReading = [
  indicator: number,
  period: string,
  value: number,
  previousValue: number | null,
  changePercent: number | null,
];

export interface MacroBundle {
  indicators: MacroIndicator[];
  readings: MacroReading[];
}

/** Server side: separa el catalogo de las lecturas. */
export function packMacro(points: MacroPoint[]): MacroBundle {
  const indicators: MacroIndicator[] = [];
  const index = new Map<string, number>();
  const readings: MacroReading[] = [];

  for (const point of points) {
    let position = index.get(point.indicatorCode);
    if (position === undefined) {
      position = indicators.length;
      index.set(point.indicatorCode, position);
      indicators.push({
        code: point.indicatorCode,
        name: point.name,
        sector: point.sector,
        unit: point.unit,
        publisher: point.publisher,
        sourceUrl: point.sourceUrl,
      });
    }
    readings.push([position, point.period, point.value, point.previousValue, point.changePercent]);
  }

  return { indicators, readings };
}

/**
 * Client side: vuelve a unir las dos mitades.
 *
 * Conserva el orden en que llegaron las filas —`readMacroAnnual` las ordena por
 * indicador y periodo, y las series dibujadas dependen de ese orden— asi que la
 * salida es la misma lista que entro en `packMacro`.
 */
export function unpackMacro(bundle: MacroBundle): MacroPoint[] {
  const { indicators, readings } = bundle;
  const points: MacroPoint[] = [];

  for (const [position, period, value, previousValue, changePercent] of readings) {
    const indicator = indicators[position];
    // Una lectura que apunta fuera del catalogo solo puede venir de un paquete
    // que no armo `packMacro`. Se descarta esa fila en vez de tumbar el
    // capitulo entero, que es lo que haria lanzar aqui.
    if (!indicator) continue;
    points.push({
      indicatorCode: indicator.code,
      sector: indicator.sector,
      name: indicator.name,
      period,
      unit: indicator.unit,
      value,
      previousValue,
      changePercent,
      publisher: indicator.publisher,
      sourceUrl: indicator.sourceUrl,
    });
  }

  return points;
}
