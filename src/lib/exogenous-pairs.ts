/**
 * «Comparativos»: los pares de lecturas que tiene sentido poner frente a frente, y lo que se puede
 * decir de cada par sin inventar.
 *
 * La comparación vivía al pie de «Precios por producto» con dos listas de las 157 lecturas: el
 * lector terminaba comparando arroz de La Paz con crudo WTI, que no responde ninguna pregunta.
 * Cada par de aquí es una pregunta sobre Bolivia —¿el precio de adentro sigue al de afuera?, ¿lo
 * que exporta Bolivia se cobra al precio del mundo?—, y la elección libre sigue debajo para quien
 * tenga otra.
 *
 * Puro —sin React ni base— para probarse con `node --test`.
 */

export interface ExogenousPair {
  key: string;
  theme: 'MESA' | 'VENDE' | 'COMPRA';
  /** La pregunta, como la leería alguien que no sabe qué es una base 100. */
  question: string;
  left: string;
  right: string;
  /** Por qué este par y qué mirar en el gráfico. */
  why: string;
}

export const THEMES: ReadonlyArray<{ key: ExogenousPair['theme']; label: string }> = [
  { key: 'MESA', label: 'Lo que se come: adentro frente a afuera' },
  { key: 'VENDE', label: 'Lo que Bolivia vende frente a su cotización' },
  { key: 'COMPRA', label: 'Lo que Bolivia compra frente a su referencia' },
];

export const PAIRS: readonly ExogenousPair[] = [
  {
    key: 'arroz',
    theme: 'MESA',
    question: '¿El arroz en Bolivia sigue al precio mundial?',
    left: 'EXO_BO_RICE_NATIONAL',
    right: 'EXO_RICE_THAI',
    why: 'Bolivia produce casi todo el arroz que come. Si el precio mayorista no acompaña al de Tailandia, la cosecha local manda más que el mercado mundial.',
  },
  {
    key: 'harina',
    theme: 'MESA',
    question: '¿La harina en Bolivia sigue al trigo argentino?',
    left: 'EXO_BO_WHEAT_FLOUR_NATIONAL',
    right: 'EXO_WHEAT_ARGENTINA',
    why: 'Bolivia importa la mayor parte de su trigo y harina, sobre todo de Argentina: es el caso donde el precio de afuera debería pasar más directo.',
  },
  {
    key: 'maiz',
    theme: 'MESA',
    question: '¿El maíz cruceño se mueve con el de Argentina?',
    left: 'EXO_BO_MAIZE_SANTA_CRUZ',
    right: 'EXO_MAIZE_ARGENTINA',
    why: 'Santa Cruz produce el maíz que alimenta a pollos y cerdos; Argentina es el vecino que fija la referencia regional.',
  },
  {
    key: 'pollo-maiz',
    theme: 'MESA',
    question: '¿El pollo sube cuando sube el maíz?',
    left: 'EXO_BO_CHICKEN_NATIONAL',
    right: 'EXO_BO_MAIZE_NATIONAL',
    why: 'El alimento es el grueso del costo de criar un pollo, y el alimento es sobre todo maíz: si los dos van juntos, el precio del pollo lo explica su insumo.',
  },
  {
    key: 'azucar',
    theme: 'MESA',
    question: '¿El azúcar en Santa Cruz sigue al precio mundial?',
    left: 'EXO_BO_SUGAR_SANTA_CRUZ',
    right: 'EXO_SUGAR_WORLD',
    why: 'Bolivia produce y exporta azúcar; el precio interno puede separarse del mundial cuando se restringe la exportación.',
  },
  {
    key: 'aceite',
    theme: 'MESA',
    question: '¿El aceite en Santa Cruz sigue al aceite de girasol mundial?',
    left: 'EXO_BO_SUNFLOWER_OIL_SANTA_CRUZ',
    right: 'EXO_SUNFLOWER_OIL',
    why: 'El aceite comestible se produce en el oriente con grano local, pero su precio de exportación es el mundial.',
  },
  {
    key: 'leche',
    theme: 'MESA',
    question: '¿La leche cruda cruceña sigue a la leche en polvo mundial?',
    left: 'EXO_BO_MILK_SANTA_CRUZ',
    right: 'EXO_WHOLE_MILK_POWDER',
    why: 'La leche en polvo importada es la alternativa de la industria a la leche cruda local: su precio pone un techo.',
  },
  {
    key: 'gas-crudo',
    theme: 'VENDE',
    question: '¿El gas que exporta Bolivia sigue al petróleo?',
    left: 'EXO_BO_EXPORT_NATURAL_GAS',
    right: 'EXO_CRUDE_BRENT',
    why: 'Los contratos con Brasil y Argentina indexan el precio del gas a una canasta de combustibles: debería seguir al crudo, con unos meses de rezago.',
  },
  {
    key: 'oro',
    theme: 'VENDE',
    question: '¿El oro que exporta Bolivia se cobra al precio de Londres?',
    left: 'EXO_BO_EXPORT_GOLD',
    right: 'EXO_GOLD',
    why: 'El valor unitario de aduana dividido por el peso: si se separa de la cotización, cambió la ley del metal exportado o lo que se declara.',
  },
  {
    key: 'plata',
    theme: 'VENDE',
    question: '¿La plata exportada sigue a la cotización?',
    left: 'EXO_BO_EXPORT_SILVER',
    right: 'EXO_SILVER',
    why: 'Bolivia es de los mayores productores de plata; el valor unitario de su exportación debería ir con Londres.',
  },
  {
    key: 'estano',
    theme: 'VENDE',
    question: '¿El estaño de Vinto se vende al precio de Londres?',
    left: 'EXO_BO_EXPORT_TIN',
    right: 'EXO_TIN',
    why: 'Vinto exporta estaño metálico refinado: es el caso más limpio para ver si el exportador boliviano cobra la cotización.',
  },
  {
    key: 'soya',
    theme: 'VENDE',
    question: '¿La torta de soya exportada sigue al precio mundial?',
    left: 'EXO_BO_EXPORT_SOYBEAN_MEAL',
    right: 'EXO_SOYBEAN_MEAL',
    why: 'La torta es el primer producto agroindustrial de exportación; el flete hasta el puerto separa los dos niveles, no las trayectorias.',
  },
  {
    key: 'urea',
    theme: 'VENDE',
    question: '¿Bulo Bulo vende la urea al precio del mundo?',
    left: 'EXO_BO_EXPORT_UREA',
    right: 'EXO_UREA',
    why: 'La planta de urea exporta a Brasil y Argentina; su valor unitario frente a la referencia mundial dice cuánto descuento cobra la distancia.',
  },
  {
    key: 'quinua',
    theme: 'VENDE',
    question: '¿Lo que se paga afuera por la quinua llega al mercado local?',
    left: 'EXO_BO_EXPORT_QUINOA',
    right: 'EXO_BO_QUINOA_NATIONAL',
    why: 'El valor unitario de exportación frente al precio mayorista en Bolivia: si el de afuera cae y el de adentro no, el productor quedó entre los dos.',
  },
  {
    key: 'diesel',
    theme: 'COMPRA',
    question: '¿Cuánto sigue el diésel importado al precio del Golfo?',
    left: 'EXO_BO_IMPORT_DIESEL',
    right: 'EXO_DIESEL_GULF',
    why: 'Lo que el país paga por el diésel que luego vende a precio fijo: la distancia entre las dos líneas es parte de la subvención.',
  },
  {
    key: 'fierro',
    theme: 'COMPRA',
    question: '¿El fierro importado sigue al acero de EE. UU.?',
    left: 'EXO_BO_IMPORT_REBAR',
    right: 'EXO_REBAR',
    why: 'Las barras corrugadas importadas frente al índice de productor del acero laminado: el costo de construir que viene de afuera.',
  },
  {
    key: 'cemento',
    theme: 'COMPRA',
    question: '¿El cemento importado sigue al índice de EE. UU.?',
    left: 'EXO_BO_IMPORT_CEMENT',
    right: 'EXO_CEMENT',
    why: 'Bolivia importa poco cemento: su valor unitario se mueve con lo que se compra cada año tanto como con el precio.',
  },
  {
    key: 'crudos',
    theme: 'COMPRA',
    question: '¿Brent y WTI cuentan lo mismo?',
    left: 'EXO_CRUDE_BRENT',
    right: 'EXO_CRUDE_WTI',
    why: 'Los dos crudos de referencia. Van casi juntos; la brecha se abre cuando EE. UU. no puede sacar su crudo al mar.',
  },
];

/** Los pares cuyas dos lecturas existen en el tablero. */
export function availablePairs(codes: ReadonlySet<string>): ExogenousPair[] {
  return PAIRS.filter((pair) => codes.has(pair.left) && codes.has(pair.right));
}

export interface ComparedPoint {
  period: string;
  left: number | null;
  right: number | null;
}

export interface PairReading {
  /** Primer y último período con las dos lecturas. */
  first: string | null;
  last: string | null;
  /** Cambio en % entre esos dos períodos, de cada lectura. */
  leftChange: number | null;
  rightChange: number | null;
  /** Correlación de las variaciones (de `horizon` períodos), sin rezago. */
  together: number | null;
  /** Cuántas variaciones entraron en la correlación. */
  pairs: number;
  /** El rezago (en períodos) en que la primera lectura sigue mejor a la segunda, si mejora. */
  lag: { periods: number; correlation: number } | null;
}

/** Variación logarítmica de cada período contra `horizon` períodos antes, o nada si falta uno. */
function changes(values: ReadonlyArray<number | null>, horizon: number): Array<number | null> {
  return values.map((value, index) => {
    const before = index >= horizon ? values[index - horizon] : null;
    return value !== null && before !== null && before !== undefined && value > 0 && before > 0
      ? Math.log(value / before)
      : null;
  });
}

function correlation(left: ReadonlyArray<number | null>, right: ReadonlyArray<number | null>) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < left.length; index += 1) {
    const x = left[index];
    const y = right[index];
    if (typeof x === 'number' && typeof y === 'number') {
      xs.push(x);
      ys.push(y);
    }
  }
  const n = xs.length;
  if (n < 8) return { r: null, n };
  const mean = (list: number[]) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let index = 0; index < n; index += 1) {
    const dx = (xs[index] ?? 0) - mx;
    const dy = (ys[index] ?? 0) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return { r: null, n };
  return { r: sxy / Math.sqrt(sxx * syy), n };
}

/**
 * Lo que se puede decir de un par ya alineado (mismos períodos, misma frecuencia).
 *
 * Se correlacionan las variaciones y no los niveles: dos precios que suben con la inflación dan
 * una correlación de niveles altísima sin tener nada que ver. En series mensuales la variación es
 * interanual (`horizon` = 12): mes a mes, el precio mayorista de un mercado boliviano es casi todo
 * ruido y daba «relación nula» incluso entre la harina y el trigo; a doce meses aparece lo que se
 * mueve de verdad. El rezago se busca hasta `maxLag` períodos y sólo se informa si da una relación
 * positiva de 0,3 o más que mejore en 0,1 la de sin rezago: «−0,09 con seis meses» no es seguir a
 * nadie aunque sea mayor que −0,58. Con pocas variaciones no se busca.
 */
export function readPair(
  points: readonly ComparedPoint[],
  maxLag: number,
  horizon = 1,
): PairReading {
  const both = points.filter((point) => point.left !== null && point.right !== null);
  const first = both[0];
  const last = both.at(-1);
  const pct = (from: number | null | undefined, to: number | null | undefined) =>
    typeof from === 'number' && typeof to === 'number' && from > 0 ? (to / from - 1) * 100 : null;
  const dl = changes(
    points.map((point) => point.left),
    horizon,
  );
  const dr = changes(
    points.map((point) => point.right),
    horizon,
  );
  const base = correlation(dl, dr);
  let lag: PairReading['lag'] = null;
  if (base.r !== null && base.n >= 24) {
    for (let periods = 1; periods <= maxLag; periods += 1) {
      // La primera lectura hoy contra la segunda `periods` atrás: ¿la de adentro sigue a la de afuera?
      const shifted = correlation(dl.slice(periods), dr.slice(0, dr.length - periods));
      if (
        shifted.r !== null &&
        shifted.n >= 24 &&
        shifted.r >= 0.3 &&
        shifted.r >= base.r + 0.1 &&
        (lag === null || shifted.r > lag.correlation)
      ) {
        lag = { periods, correlation: shifted.r };
      }
    }
  }
  return {
    first: first?.period ?? null,
    last: last?.period ?? null,
    leftChange: pct(first?.left, last?.left),
    rightChange: pct(first?.right, last?.right),
    together: base.r,
    pairs: base.n,
    lag,
  };
}

/** La correlación dicha en palabras, sin prometer más de lo que mide. */
export function sayTogether(r: number | null): string {
  if (r === null) return 'sin variaciones suficientes para medirlo';
  const strength =
    Math.abs(r) >= 0.7
      ? 'fuerte'
      : Math.abs(r) >= 0.4
        ? 'moderada'
        : Math.abs(r) >= 0.2
          ? 'débil'
          : 'casi nula';
  return r < -0.2 ? `relación ${strength}, en sentido contrario` : `relación ${strength}`;
}
