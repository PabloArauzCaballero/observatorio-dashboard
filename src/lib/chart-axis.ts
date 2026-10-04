/**
 * Matemática de los ejes de los gráficos: pura, para poder probarla.
 */

/**
 * El eje vertical de una serie: ajustado a los datos y con marcas redondas.
 *
 * Recharts reparte las marcas por igual entre los dos extremos del dominio que
 * se le da. Con extremos «ajustados» (el mínimo menos un 12 %…) las marcas salían
 * en 121 %, 87 %, 52 %, 17 % y −18 %: legibles como números y imposibles de
 * leer como escala. Aquí el dominio son cuatro intervalos iguales de un paso
 * redondo (1, 2, 2,5 o 5 por una potencia de diez), el más chico que cubre los
 * datos con un margen del 4 %, así que las cinco marcas que se dibujan son
 * números que una persona dice en voz alta. Una serie que no baja de cero no
 * dibuja marcas negativas.
 */
export function fittedDomain(values: number[]): [number, number] {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return [0, 1];
  let min = Math.min(...clean);
  let max = Math.max(...clean);
  if (min === max) {
    const flat = Math.max(Math.abs(min) * 0.05, 0.5);
    min -= flat;
    max += flat;
  }
  const margin = (max - min) * 0.04;
  // Una serie que no baja de cero no necesita margen por debajo de cero: pedirlo ensanchaba el eje.
  const floor = min >= 0 ? Math.max(0, min - margin) : min - margin;
  const ceiling = max + margin;
  const first = Math.floor(Math.log10((ceiling - floor) / 4));
  for (let power = first - 1; power <= first + 2; power += 1) {
    for (const factor of [1, 2, 2.5, 5]) {
      const step = factor * 10 ** power;
      let low = Math.floor(floor / step) * step;
      let high = low + 4 * step;
      if (high < ceiling) continue;
      if (low < 0 && min >= 0) {
        low = 0;
        high = 4 * step;
      }
      return [Number(low.toFixed(10)), Number(high.toFixed(10))];
    }
  }
  return [Number(floor.toFixed(4)), Number(ceiling.toFixed(4))];
}
