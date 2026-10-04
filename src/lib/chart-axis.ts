/**
 * Matemática de los ejes de los gráficos: pura, para poder probarla.
 */

interface Escala {
  /** Marcas que se dibujan: los intervalos más una. */
  tickCount: number;
  /** El paso entre dos marcas. */
  paso: number;
}

/**
 * Qué escala eligió cada dominio. Recharts solo recibe el dominio; el número de marcas
 * y los decimales que necesita el paso se consultan aquí por el mismo objeto.
 */
const ESCALAS = new WeakMap<object, Escala>();

/**
 * El eje vertical de una serie: ajustado a los datos y con marcas redondas.
 *
 * Recharts reparte las marcas por igual entre los dos extremos del dominio que
 * se le da. Con extremos «ajustados» (el mínimo menos un 12 %…) las marcas salían
 * en 121 %, 87 %, 52 %, 17 % y −18 %: legibles como números y imposibles de
 * leer como escala. Aquí el dominio son de cuatro o cinco intervalos iguales de un
 * paso redondo (1, 2, 2,5 o 5 por una potencia de diez), el conjunto más
 * estrecho que cubre los datos con un margen del 4 %, así que las marcas que se
 * dibujan son números que una persona dice en voz alta. Una serie que no baja de
 * cero no dibuja marcas negativas.
 *
 * Quien dibuja el eje pasa también `tickCount={tickCountOf(dominio)}`.
 */
export function fittedDomain(values: number[]): [number, number] {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return registrar([0, 1], { tickCount: 5, paso: 0.25 });
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

  let mejor: { low: number; high: number; intervalos: number; paso: number } | null = null;
  for (let power = first - 1; power <= first + 2; power += 1) {
    for (const factor of [1, 2, 2.5, 5]) {
      const paso = factor * 10 ** power;
      for (const intervalos of [4, 5]) {
        let low = Math.floor(floor / paso) * paso;
        let high = low + intervalos * paso;
        if (high < ceiling) continue;
        if (low < 0 && min >= 0) {
          low = 0;
          high = intervalos * paso;
        }
        // El más estrecho; a igual anchura, menos marcas y el paso más grande.
        const ancho = high - low;
        const mejorAncho = mejor ? mejor.high - mejor.low : Infinity;
        if (
          ancho < mejorAncho - 1e-9 ||
          (Math.abs(ancho - mejorAncho) <= 1e-9 && mejor && intervalos < mejor.intervalos)
        ) {
          mejor = { low, high, intervalos, paso };
        }
      }
    }
  }
  if (!mejor)
    return registrar([Number(floor.toFixed(4)), Number(ceiling.toFixed(4))], {
      tickCount: 5,
      paso: (ceiling - floor) / 4,
    });
  return registrar([Number(mejor.low.toFixed(10)), Number(mejor.high.toFixed(10))], {
    tickCount: mejor.intervalos + 1,
    paso: mejor.paso,
  });
}

function registrar(dominio: [number, number], escala: Escala): [number, number] {
  ESCALAS.set(dominio, escala);
  return dominio;
}

/** Cuántas marcas dibujar para que caigan en múltiplos del paso (5 si el dominio no es de `fittedDomain`). */
export function tickCountOf(dominio: readonly [number, number] | undefined): number {
  return (dominio && ESCALAS.get(dominio)?.tickCount) || 5;
}

/**
 * Los decimales que hacen falta para que dos marcas vecinas no se lean igual: un
 * paso de 0,05 con una etiqueta de un decimal imprimía «12,3 · 12,3 · 12,2 · 12,2».
 * `base` es lo que el gráfico ya pedía; nunca baja de ahí.
 */
export function axisDecimals(dominio: readonly [number, number] | undefined, base: number): number {
  const paso = dominio ? ESCALAS.get(dominio)?.paso : undefined;
  if (!paso || paso <= 0) return base;
  const hacen = Math.max(0, Math.ceil(-Math.log10(paso) - 1e-9));
  return Math.min(4, Math.max(base, hacen));
}
