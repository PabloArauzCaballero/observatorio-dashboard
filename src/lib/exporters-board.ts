import type { MacroPoint } from './series';

/**
 * Quién vende Bolivia al exterior, y quién está mejor visto dentro.
 *
 * Dos preguntas en un capítulo, y conviene decir de entrada por qué están
 * juntas: porque casi no se tocan, y esa es la lectura.
 *
 * **Bolivia no publica sus exportaciones por empresa.** Se comprobó fuente por
 * fuente: el INE llega a producto, departamento y país de destino; la Aduana
 * Nacional publica agregados; el portal de comercio exterior del Ministerio de
 * Desarrollo Productivo desglosa por partida arancelaria; el Anuario de Minería
 * separa por actor productivo —estatal, privado, cooperativo— pero nunca por
 * razón social. La declaración aduanera individual está amparada por reserva.
 * No es una laguna de este tablero: es una decisión del Estado boliviano, y el
 * capítulo la dice en lugar de taparla con una cifra de otro sitio.
 *
 * **De lo que hay se publica el orden y la cuota, no los dólares.** La única
 * lista completa con nombres es la de un agregador comercial de registros
 * aduaneros, y su total de 2024 no cuadra con el del INE —cuarenta y dos mil
 * millones contra ocho mil novecientos— sin que la publicación declare sobre
 * qué base está calculado. El orden es consistente con lo que se sabe del país
 * y la cuota suma; los dólares son un número que este observatorio no puede
 * sostener. Quedan en la prueba guardada junto a cada fila, no en el tablero.
 *
 * **La reputación es otra cosa y se mide de otra manera.** Merco publica desde
 * hace trece ediciones un monitor con metodología declarada y revisión externa.
 * Mide reputación percibida entre públicos que conocen la marca, y por eso su
 * cabeza son cerveceras, bancos y farmacias mientras la de las exportadoras son
 * mineras y aceiteras. El cruce entre las dos listas es corto a propósito, y
 * ese número corto es el hallazgo del capítulo: lo que Bolivia vende lo extraen
 * y lo muelen empresas que ningún consumidor sabría nombrar.
 */

export interface Exporter {
  slug: string;
  name: string;
  rank: number;
  /** Parte de las exportaciones del año que la fuente le atribuye. */
  share: number;
}

/** Un puesto en un monitor de reputación, con su edición. */
export interface ReputationSeat {
  slug: string;
  name: string;
  rank: number;
  /** El año de la edición; trece ediciones dan hasta trece asientos de la misma empresa. */
  year: number;
  /** El sector, cuando el puesto es dentro de uno y no del ránking general. */
  sector: string | null;
  /**
   * La puntuación de Merco en su escala —10.000 el primero, 3.000 el centésimo—.
   * Sólo la trae el ránking general; el sectorial publica el orden y nada más.
   */
  score: number | null;
}

/** Una empresa que está en las dos listas, que es lo que el capítulo busca. */
export interface Crossing {
  slug: string;
  name: string;
  exportRank: number;
  share: number;
  /** El mejor puesto que tuvo en la última edición en que Merco la midió. */
  reputationRank: number;
  sector: string | null;
  /** La última edición en que aparece: una exportadora medida en 2013 no es una de hoy. */
  reputationYear: number;
}

export interface ExportersBoard {
  exporters: Exporter[];
  /** El ránking general de todas las ediciones, de la más nueva a la más vieja. */
  general: ReputationSeat[];
  /** Los puestos por sector de todas las ediciones. */
  sectors: ReputationSeat[];
  crossings: Crossing[];
  /** Las ediciones publicadas del monitor, de la más nueva a la más vieja. */
  editions: number[];
  /** La gestión del ránking de exportadoras y la última edición del monitor. */
  exportYear: number | null;
  reputationYear: number | null;
}

/**
 * El nombre de la empresa, tomado del rótulo de la serie.
 *
 * El núcleo escribe `indicator_name` como «Minera San Cristóbal: puesto entre
 * las exportadoras», así que el nombre es lo que va antes de los dos puntos.
 * Reconstruirlo del código daría «MINERA_SAN_CRISTOBAL», que no es un nombre
 * sino un identificador.
 */
function companyName(indicatorName: string | null, slug: string): string {
  const cut = indicatorName?.split(':')[0]?.trim();
  if (cut && cut.length > 1) return cut;
  return slug
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLocaleLowerCase('es'))
    .join(' ');
}

/** El sector, que el rótulo del puesto sectorial lleva entre «en» y «(Merco)». */
function sectorOf(indicatorName: string | null): string | null {
  const match = /puesto en (.+?) \(Merco\)/u.exec(indicatorName ?? '');
  const sector = match?.[1]?.trim();
  return sector && sector.length > 1 ? sector : null;
}

const GENERAL = 'REPUTATION_MERCO_GEN_';
const SCORE = 'REPUTATION_MERCO_SCORE_';
const SECTOR = 'REPUTATION_MERCO_SEC_';

/**
 * Arma el capítulo con las filas que la vista anual marcó como empresariales.
 *
 * Una empresa puede traer el puesto sin la cuota o al revés —son dos series y
 * cada una tiene su propia cobertura—, así que se juntan por código y sólo
 * salen al tablero las que tienen las dos. Una barra de cuota sin puesto no se
 * puede ordenar y un puesto sin cuota no se puede dibujar.
 *
 * Con la reputación pasa lo mismo a otra escala: el puesto y la puntuación son
 * dos series y se unen por empresa y edición. El nombre que se dibuja es el de
 * la serie de puntuación cuando existe, porque es la que el núcleo escribió con
 * la tabla de nombres corregida; la vista se queda con el mayor de los rótulos
 * de una misma celda, y entre «Ic Norte» e «IC Norte» gana el viejo.
 */
export function buildExportersBoard(points: readonly MacroPoint[]): ExportersBoard {
  const ranks = new Map<string, { name: string; rank: number }>();
  const shares = new Map<string, number>();
  const general: ReputationSeat[] = [];
  const sectors: ReputationSeat[] = [];
  const scores = new Map<string, number>();
  const names = new Map<string, string>();

  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const year = Number(point.period);
    const code = point.indicatorCode;

    if (code.startsWith('EXPORTER_RANK_')) {
      const slug = code.slice('EXPORTER_RANK_'.length);
      ranks.set(slug, { name: companyName(point.name, slug), rank: point.value });
      continue;
    }
    if (code.startsWith('EXPORTER_SHARE_PCT_')) {
      shares.set(code.slice('EXPORTER_SHARE_PCT_'.length), point.value);
      continue;
    }
    if (code.startsWith(SCORE)) {
      const slug = code.slice(SCORE.length);
      scores.set(`${slug}|${year}`, point.value);
      names.set(slug, companyName(point.name, slug));
      continue;
    }
    const kind = code.startsWith(GENERAL) ? GENERAL : code.startsWith(SECTOR) ? SECTOR : null;
    if (!kind) continue;
    const slug = code.slice(kind.length);
    (kind === GENERAL ? general : sectors).push({
      slug,
      name: companyName(point.name, slug),
      rank: point.value,
      year,
      sector: kind === SECTOR ? sectorOf(point.name) : null,
      score: null,
    });
  }

  for (const seat of [...general, ...sectors]) seat.name = names.get(seat.slug) ?? seat.name;
  for (const seat of general) seat.score = scores.get(`${seat.slug}|${seat.year}`) ?? null;

  const exporters: Exporter[] = [...ranks.entries()]
    .map(([slug, row]) => ({ slug, name: row.name, rank: row.rank, share: shares.get(slug) ?? 0 }))
    .filter((row) => row.share > 0)
    .sort((left, right) => left.rank - right.rank);

  general.sort((left, right) => right.year - left.year || left.rank - right.rank);
  sectors.sort(
    (left, right) =>
      right.year - left.year ||
      (left.sector ?? '').localeCompare(right.sector ?? '', 'es') ||
      left.rank - right.rank,
  );

  /*
   * El cruce se busca contra las dos mitades del monitor y no sólo contra la
   * general. Muy pocas exportadoras llegan al ránking general —son marcas de
   * consumo— pero varias son las primeras de su sector, y quedarse en el
   * general daría la conclusión falsa de que las exportadoras no están
   * medidas. De cada empresa vale su última edición: que Comibol estuviera en
   * 2015 no dice nada de cómo se la ve hoy, y el tablero lo muestra con el año.
   */
  const latest = new Map<string, ReputationSeat>();
  for (const seat of [...general, ...sectors]) {
    const current = latest.get(seat.slug);
    /*
     * Dentro de una misma edición manda el puesto general: que PIL Andina sea
     * segunda de «Alimentación» es cierto, pero lo que la sitúa entre las
     * empresas del país es que es séptima de las cien.
     */
    const better =
      !current ||
      seat.year > current.year ||
      (seat.year === current.year &&
        (seat.sector === null) !== (current.sector === null) &&
        seat.sector === null) ||
      (seat.year === current.year &&
        (seat.sector === null) === (current.sector === null) &&
        seat.rank < current.rank);
    if (better) {
      latest.set(seat.slug, seat);
    }
  }

  const crossings: Crossing[] = exporters
    .map((exporter) => {
      const seat = latest.get(exporter.slug);
      if (!seat) return null;
      return {
        slug: exporter.slug,
        name: exporter.name,
        exportRank: exporter.rank,
        share: exporter.share,
        reputationRank: seat.rank,
        sector: seat.sector,
        reputationYear: seat.year,
      } satisfies Crossing;
    })
    .filter((row): row is Crossing => row !== null)
    .sort((left, right) => left.exportRank - right.exportRank);

  const exportYear = points
    .filter((point) => point.indicatorCode.startsWith('EXPORTER_'))
    .map((point) => Number(point.period))
    .filter((year) => Number.isInteger(year))
    .at(0);

  const editions = [...new Set([...general, ...sectors].map((seat) => seat.year))]
    .filter((year) => Number.isInteger(year))
    .sort((left, right) => right - left);

  return {
    exporters,
    general,
    sectors,
    crossings,
    editions,
    exportYear: exportYear ?? null,
    reputationYear: editions[0] ?? null,
  };
}

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** La cuota, con una decimal y el signo separado como se escribe en Bolivia. */
export const percent = (value: number): string => `${number(value, 1)} %`;

/**
 * Cuánto de lo que el país vende está en manos de las diez primeras.
 *
 * Se suma la cuota publicada y no se calcula de los dólares, que es lo único
 * coherente con no publicarlos: la cuota es la magnitud que la fuente declara
 * consistente consigo misma.
 */
export function concentration(board: ExportersBoard, top = 10): number {
  return board.exporters.slice(0, top).reduce((sum, row) => sum + row.share, 0);
}
