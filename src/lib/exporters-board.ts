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
  /** El año de la edición; dos ediciones dan dos asientos de la misma empresa. */
  year: number;
  /** El sector, cuando el puesto es dentro de uno y no del ránking general. */
  sector: string | null;
}

/** Una empresa que está en las dos listas, que es lo que el capítulo busca. */
export interface Crossing {
  slug: string;
  name: string;
  exportRank: number;
  share: number;
  reputationRank: number;
  sector: string | null;
}

export interface ExportersBoard {
  exporters: Exporter[];
  /** El ránking general, por edición y de mejor a peor puesto. */
  general: ReputationSeat[];
  /** El primero —o los tres primeros— de cada sector, en la última edición. */
  sectors: ReputationSeat[];
  crossings: Crossing[];
  /** La gestión del ránking de exportadoras y la edición del monitor. */
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

const newest = (seats: readonly ReputationSeat[]): number | null => {
  const years = seats.map((seat) => seat.year);
  return years.length ? Math.max(...years) : null;
};

/**
 * Arma el capítulo con las filas que la vista anual marcó como empresariales.
 *
 * Una empresa puede traer el puesto sin la cuota o al revés —son dos series y
 * cada una tiene su propia cobertura—, así que se juntan por código y sólo
 * salen al tablero las que tienen las dos. Una barra de cuota sin puesto no se
 * puede ordenar y un puesto sin cuota no se puede dibujar.
 */
export function buildExportersBoard(points: readonly MacroPoint[]): ExportersBoard {
  const ranks = new Map<string, { name: string; rank: number }>();
  const shares = new Map<string, number>();
  const general: ReputationSeat[] = [];
  const sectors: ReputationSeat[] = [];

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
    if (code.startsWith('REPUTATION_MERCO_GEN_')) {
      const slug = code.slice('REPUTATION_MERCO_GEN_'.length);
      general.push({
        slug,
        name: companyName(point.name, slug),
        rank: point.value,
        year,
        sector: null,
      });
      continue;
    }
    if (code.startsWith('REPUTATION_MERCO_SEC_')) {
      const slug = code.slice('REPUTATION_MERCO_SEC_'.length);
      sectors.push({
        slug,
        name: companyName(point.name, slug),
        rank: point.value,
        year,
        sector: sectorOf(point.name),
      });
    }
  }

  const exporters: Exporter[] = [...ranks.entries()]
    .map(([slug, row]) => ({ slug, name: row.name, rank: row.rank, share: shares.get(slug) ?? 0 }))
    .filter((row) => row.share > 0)
    .sort((left, right) => left.rank - right.rank);

  general.sort((left, right) => right.year - left.year || left.rank - right.rank);
  sectors.sort(
    (left, right) =>
      (left.sector ?? '').localeCompare(right.sector ?? '', 'es') || left.rank - right.rank,
  );

  /*
   * El cruce se busca contra las dos mitades del monitor y no sólo contra la
   * general. Ninguna exportadora está en el top diez nacional —son marcas de
   * consumo— pero varias son las primeras de su sector, y quedarse en el
   * ránking general daría cero coincidencias y la conclusión falsa de que las
   * exportadoras no están medidas.
   */
  const best = new Map<string, ReputationSeat>();
  for (const seat of [...general, ...sectors]) {
    const current = best.get(seat.slug);
    if (!current || seat.rank < current.rank) best.set(seat.slug, seat);
  }

  const crossings: Crossing[] = exporters
    .map((exporter) => {
      const seat = best.get(exporter.slug);
      if (!seat) return null;
      return {
        slug: exporter.slug,
        name: exporter.name,
        exportRank: exporter.rank,
        share: exporter.share,
        reputationRank: seat.rank,
        sector: seat.sector,
      } satisfies Crossing;
    })
    .filter((row): row is Crossing => row !== null)
    .sort((left, right) => left.exportRank - right.exportRank);

  const exportYear = points
    .filter((point) => point.indicatorCode.startsWith('EXPORTER_'))
    .map((point) => Number(point.period))
    .filter((year) => Number.isInteger(year))
    .at(0);

  return {
    exporters,
    general,
    sectors,
    crossings,
    exportYear: exportYear ?? null,
    reputationYear: newest([...general, ...sectors]),
  };
}

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
