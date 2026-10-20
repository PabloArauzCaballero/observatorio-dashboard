/**
 * La curva de las líneas que el tablero dibuja a mano (sin Recharts), igual a la que
 * Recharts traza con `type="monotone"`: la monótona en x de Fritsch-Carlson, la misma
 * fórmula que `curveMonotoneX` de d3.
 *
 * Pasa por cada punto y, entre dos puntos, no sube por encima del mayor ni baja por
 * debajo del menor: suaviza el quiebre sin inventar un pico ni un valle.
 *
 * Puro, sin dependencias, para probarlo con `node --test`.
 */

export type Punto = readonly [number, number];

const signo = (n: number): number => (n < 0 ? -1 : 1);

/** Pendiente en el punto central de tres (d3: `slope3`). */
function pendienteInterior(a: Punto, b: Punto, c: Punto): number {
  const h0 = b[0] - a[0];
  const h1 = c[0] - b[0];
  const s0 = (b[1] - a[1]) / (h0 || (h1 < 0 ? -0 : 0));
  const s1 = (c[1] - b[1]) / (h1 || (h0 < 0 ? -0 : 0));
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (signo(s0) + signo(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

/** Pendiente en un extremo, a partir de la del vecino (d3: `slope2`). */
function pendienteExtremo(a: Punto, b: Punto, vecina: number): number {
  const h = b[0] - a[0];
  return h ? ((3 * (b[1] - a[1])) / h - vecina) / 2 : vecina;
}

const n = (valor: number): string => String(Math.round(valor * 100) / 100);

/** El atributo `d` de un `<path>` que une los puntos (ordenados por x) con la curva monótona. */
export function trazoMonotono(puntos: readonly Punto[]): string {
  const primero = puntos[0];
  if (!primero) return '';
  if (puntos.length < 3) {
    return puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${n(p[0])},${n(p[1])}`).join(' ');
  }
  const ultimo = puntos.length - 1;
  const m = puntos.map((p, i) =>
    i === 0 || i === ultimo ? 0 : pendienteInterior(puntos[i - 1]!, p, puntos[i + 1]!),
  );
  m[0] = pendienteExtremo(puntos[0]!, puntos[1]!, m[1]!);
  m[ultimo] = pendienteExtremo(puntos[ultimo - 1]!, puntos[ultimo]!, m[ultimo - 1]!);

  let d = `M${n(primero[0])},${n(primero[1])}`;
  for (let i = 0; i < ultimo; i += 1) {
    const [x0, y0] = puntos[i]!;
    const [x1, y1] = puntos[i + 1]!;
    const dx = (x1 - x0) / 3;
    d +=
      ` C${n(x0 + dx)},${n(y0 + dx * m[i]!)}` +
      ` ${n(x1 - dx)},${n(y1 - dx * m[i + 1]!)}` +
      ` ${n(x1)},${n(y1)}`;
  }
  return d;
}
