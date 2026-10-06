/**
 * Los videos de los vendedores de TikTok (ADR 0031 del núcleo), listos para dibujar. Catálogo aparte de los
 * lives: un video no es un live y aquí no se mezcla ninguna cifra de los lives.
 *
 * Puro y sin importar módulos propios, para que `node --test` lo pruebe. Sin sesión, cada perfil entrega
 * sus videos más recientes: la serie larga está cargada hacia lo reciente y la página lo dice.
 */

export interface VideoAccount {
  seller: string;
  origin: 'LIVE' | 'SIMILAR';
  kind: 'VENTA' | 'GASTRONOMIA' | 'ENTRETENIMIENTO';
  rubro: string;
  city: string | null;
  followers: number | null;
  videosRead: number;
  firstVideo: string | null;
  lastVideo: string | null;
}

export interface SellerVideo {
  key: string;
  seller: string;
  kind: VideoAccount['kind'];
  date: string;
  hour: number;
  weekday: number;
  rubro: string;
  product: string | null;
  prices: number[];
  plays: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  duration: number | null;
  photo: boolean;
  tactics: string[];
}

export interface VideoCoverage {
  accountsRead: number;
  accountsIncluded: number;
  excludedNotBolivia: number;
  excludedNoActivity: number;
  videos: number;
  videosByYear: Record<string, number>;
}

export interface VideoBoard {
  analyzedAt: string | null;
  rubros: Record<string, string>;
  departments: Record<string, string>;
  accounts: VideoAccount[];
  videos: SellerVideo[];
  terms: { rubro: string; term: string; count: number }[];
  coverage: VideoCoverage | null;
}

export const EMPTY_VIDEO_BOARD: VideoBoard = {
  analyzedAt: null,
  rubros: {},
  departments: {},
  accounts: [],
  videos: [],
  terms: [],
  coverage: null,
};

export const KIND_LABEL: Record<string, string> = {
  VENTA: 'Venta',
  GASTRONOMIA: 'Gastronomía',
  ENTRETENIMIENTO: 'Entretenimiento',
};

export const ORIGIN_LABEL: Record<string, string> = {
  LIVE: 'Vista vendiendo en un live',
  SIMILAR: 'Cuenta parecida (sugerida por TikTok)',
};

export const TACTIC_LABEL: Record<string, string> = {
  PRECIO: 'Dice el precio',
  ENVIO: 'Ofrece envío o delivery',
  CONTACTO: 'Pide contacto (WhatsApp, privado)',
  PROMO: 'Promoción, oferta o remate',
  LIVE: 'Anuncia o recorta un live',
  SORTEO: 'Sorteo o premio',
  MAYOR: 'Por mayor o por docena',
  NUEVO_STOCK: 'Mercadería nueva',
  UNBOXING: 'Abre cajas en cámara',
  PEDIDOS: 'Muestra pedidos empacados',
};

export type VideoDimension = 'kind' | 'origin' | 'rubro' | 'city';

export interface VideoFilters {
  kind: ReadonlySet<string>;
  origin: ReadonlySet<string>;
  rubro: ReadonlySet<string>;
  city: ReadonlySet<string>;
  fromYear: string;
  toYear: string;
}

export const NO_VIDEO_FILTERS: VideoFilters = {
  kind: new Set(),
  origin: new Set(),
  rubro: new Set(),
  city: new Set(),
  fromYear: '',
  toYear: '',
};

const DIMENSIONS: readonly VideoDimension[] = ['kind', 'origin', 'rubro', 'city'];

function valueOf(video: SellerVideo, account: VideoAccount | undefined, dimension: VideoDimension): string {
  switch (dimension) {
    case 'kind':
      return video.kind;
    case 'origin':
      return account?.origin ?? 'LIVE';
    case 'rubro':
      return video.rubro;
    case 'city':
      return account?.city ?? 'SIN_DATO';
  }
}

export function accountIndex(board: VideoBoard): Map<string, VideoAccount> {
  return new Map(board.accounts.map((account) => [account.seller, account]));
}

/** Los videos del recorte. `except` deja libre una dimensión para contar sus opciones (filtro cruzado). */
export function filterVideos(board: VideoBoard, filters: VideoFilters, except?: VideoDimension): SellerVideo[] {
  const accounts = accountIndex(board);
  return board.videos.filter((video) => {
    const year = video.date.slice(0, 4);
    if (filters.fromYear && year < filters.fromYear) return false;
    if (filters.toYear && year > filters.toYear) return false;
    return DIMENSIONS.every((dimension) => {
      if (dimension === except) return true;
      const choice = filters[dimension];
      return choice.size === 0 || choice.has(valueOf(video, accounts.get(video.seller), dimension));
    });
  });
}

export function videoOptions(
  board: VideoBoard,
  filters: VideoFilters,
  dimension: VideoDimension,
): { value: string; count: number }[] {
  const accounts = accountIndex(board);
  const all = new Set(board.videos.map((video) => valueOf(video, accounts.get(video.seller), dimension)));
  const counts = new Map<string, number>();
  for (const video of filterVideos(board, filters, dimension)) {
    const value = valueOf(video, accounts.get(video.seller), dimension);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...all]
    .map((value) => ({ value, count: counts.get(value) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Día a día: videos publicados por clase y vistas que esos videos tenían el día de la lectura. */
export function daily(videos: readonly SellerVideo[]): {
  date: string;
  VENTA: number;
  GASTRONOMIA: number;
  ENTRETENIMIENTO: number;
  plays: number;
}[] {
  const days = new Map<string, { VENTA: number; GASTRONOMIA: number; ENTRETENIMIENTO: number; plays: number }>();
  for (const video of videos) {
    const row = days.get(video.date) ?? { VENTA: 0, GASTRONOMIA: 0, ENTRETENIMIENTO: 0, plays: 0 };
    row[video.kind] += 1;
    row.plays += video.plays ?? 0;
    days.set(video.date, row);
  }
  const dates = [...days.keys()].sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return [];
  // Todos los días del rango, también los que no tuvieron videos: sin el cero, la línea une días
  // lejanos y parece que se publicó todos los días.
  const out = [];
  for (let day = new Date(`${first}T12:00:00Z`); day.toISOString().slice(0, 10) <= last; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    out.push({ date, ...(days.get(date) ?? { VENTA: 0, GASTRONOMIA: 0, ENTRETENIMIENTO: 0, plays: 0 }) });
  }
  return out;
}

/** Cuántos videos de cada rubro por año: qué se vendía. */
export function rubroByYear(videos: readonly SellerVideo[]): { year: string; [rubro: string]: string | number }[] {
  const years = new Map<string, Map<string, number>>();
  for (const video of videos) {
    const year = video.date.slice(0, 4);
    const row = years.get(year) ?? new Map<string, number>();
    row.set(video.rubro, (row.get(video.rubro) ?? 0) + 1);
    years.set(year, row);
  }
  return [...years.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, row]) => ({ year, ...Object.fromEntries(row) }));
}

const quantile = (sorted: readonly number[], q: number): number => {
  const position = (sorted.length - 1) * q;
  const low = sorted[Math.floor(position)] ?? 0;
  const high = sorted[Math.ceil(position)] ?? low;
  return Math.round((low + (high - low) * (position - Math.floor(position))) * 100) / 100;
};

export function videoPrices(
  videos: readonly SellerVideo[],
  minimum: number,
): { product: string; rubro: string; n: number; median: number; p25: number; p75: number }[] {
  const groups = new Map<string, { rubro: string; values: number[] }>();
  for (const video of videos) {
    if (!video.product || !video.prices.length) continue;
    const group = groups.get(video.product) ?? { rubro: video.rubro, values: [] };
    group.values.push(...video.prices);
    groups.set(video.product, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.values.length >= minimum)
    .map(([product, group]) => {
      const sorted = [...group.values].sort((a, b) => a - b);
      return { product, rubro: group.rubro, n: sorted.length, median: quantile(sorted, 0.5), p25: quantile(sorted, 0.25), p75: quantile(sorted, 0.75) };
    })
    .sort((a, b) => b.n - a.n);
}

/**
 * Cómo venden: qué parte de los videos usa cada marca y cuánta interacción logra (me gusta por cada 1.000
 * vistas, mediana de los videos con esa marca frente a la de todos).
 */
export function tactics(videos: readonly SellerVideo[]): {
  tactic: string;
  share: number;
  videos: number;
  likesPerThousand: number | null;
  baseline: number | null;
}[] {
  const rate = (video: SellerVideo): number | null =>
    video.plays && video.plays > 0 && video.likes !== null ? (1000 * video.likes) / video.plays : null;
  const median = (values: number[]): number | null => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return Math.round(quantile(sorted, 0.5) * 10) / 10;
  };
  const baseline = median(videos.map(rate).filter((value): value is number => value !== null));
  return Object.keys(TACTIC_LABEL)
    .map((tactic) => {
      const own = videos.filter((video) => video.tactics.includes(tactic));
      return {
        tactic,
        videos: own.length,
        share: videos.length ? Math.round((1000 * own.length) / videos.length) / 10 : 0,
        likesPerThousand: median(own.map(rate).filter((value): value is number => value !== null)),
        baseline,
      };
    })
    .filter((row) => row.videos > 0)
    .sort((a, b) => b.share - a.share);
}

const WEEKDAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function publishHeat(videos: readonly SellerVideo[]): { row: string; column: string; value: number }[] {
  const cells = new Map<string, number>();
  for (const video of videos) cells.set(`${video.weekday}|${video.hour}`, (cells.get(`${video.weekday}|${video.hour}`) ?? 0) + 1);
  return [...cells.entries()].map(([key, value]) => {
    const [weekday, hour] = key.split('|');
    return { row: WEEKDAYS[Number(weekday)] ?? '', column: `${String(hour).padStart(2, '0')} h`, value };
  });
}

export const DURATION_BANDS: ReadonlyArray<readonly [string, number, number]> = [
  ['Foto o carrusel', -1, -1],
  ['Menos de 15 s', 0, 15],
  ['15 a 30 s', 15, 30],
  ['30 s a 1 min', 30, 60],
  ['1 a 3 min', 60, 180],
  ['Más de 3 min', 180, Number.POSITIVE_INFINITY],
];

export function formats(videos: readonly SellerVideo[]): { band: string; videos: number; share: number }[] {
  const counts = new Map<string, number>(DURATION_BANDS.map(([band]) => [band, 0]));
  for (const video of videos) {
    const band = video.photo
      ? 'Foto o carrusel'
      : (DURATION_BANDS.find(([, low, high]) => low >= 0 && (video.duration ?? 0) >= low && (video.duration ?? 0) < high)?.[0] ??
        'Menos de 15 s');
    counts.set(band, (counts.get(band) ?? 0) + 1);
  }
  return DURATION_BANDS.map(([band]) => ({
    band,
    videos: counts.get(band) ?? 0,
    share: videos.length ? Math.round((1000 * (counts.get(band) ?? 0)) / videos.length) / 10 : 0,
  })).filter((row) => row.videos > 0);
}
